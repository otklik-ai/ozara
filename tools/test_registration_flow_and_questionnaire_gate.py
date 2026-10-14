#!/usr/bin/env python3
"""
Test Suite: Registration Flow, Questionnaire Gate & Onboarding Progress Persistence
Verifies the complete 10-step flow:
1. "Join the circle"
2. Enter / request invite token
3. Requester completes application form
4. Admin receives notification email linking to secure approval page
5. Admin approves and selects Paid vs Complimentary tier
6. Validate invitation token
7. Verify phone number using SMS code
8. Show membership questionnaire (existing 24 canonical questions)
9. Paid member subscription payment (complimentary skips payment)
10. Open main app only after all required steps complete

Also verifies:
- Server-side persistence of onboarding progress
- Resuming at next incomplete step after reload/restart
- Backend gate: incomplete accounts are blocked from member features
- Preserving existing completed members and their access
"""

import sys
import time
import requests
import json

BASE_URL = "http://localhost:3000"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def assert_true(condition, err_msg):
    if not condition:
        log(err_msg, "FAIL")
        sys.exit(1)
    else:
        log("Assertion passed: " + err_msg, "PASS")

def main():
    log("================================================================================")
    log("STARTING TEST: Registration Flow, Questionnaire Gate & Onboarding Persistence")
    log("================================================================================")

    ts = int(time.time())
    
    # -------------------------------------------------------------------------
    # TEST 1: PAID MEMBERSHIP PATH
    # -------------------------------------------------------------------------
    log("\n--- TEST 1: Paid Membership Path ---")
    paid_email = f"test.paid.{ts}@circle.io"
    paid_phone = f"+1555{ts % 10000000:07d}"
    paid_name = f"Paid Test Candidate {ts % 1000}"

    # Step 3: Requester completes short application form
    log(f"1. Requester submits access request: {paid_email}")
    res = requests.post(f"{BASE_URL}/api/invitations/request-access", json={
        "email": paid_email,
        "fullName": paid_name,
        "role": "Managing Director",
        "notes": "Looking for tech co-investors",
        "phone": paid_phone
    })
    assert_true(res.status_code in [200, 201], f"Request access returned {res.status_code}")
    req_data = res.json()
    assert_true(req_data.get("success") == True, "Access request created")

    # Step 4 & 5: Admin approves with Paid membership tier
    log("2. Admin approves access request with Paid membership tier")
    res = requests.post(f"{BASE_URL}/api/admin/invitations/review/decision", json={
        "email": paid_email,
        "action": "approve",
        "membership_tier": "paid",
        "adminEmail": "ermolov.elena@gmail.com"
    })
    assert_true(res.status_code == 200, f"Admin approval returned {res.status_code}: {res.text}")
    appr_data = res.json()
    paid_token = appr_data.get("token")
    assert_true(bool(paid_token), f"Received official token: {paid_token}")
    assert_true(appr_data.get("membership_tier") == "paid", "Membership tier is paid")

    # Step 6: Validate invitation code
    log(f"3. Validate invitation code: {paid_token}")
    res = requests.post(f"{BASE_URL}/api/invitations/verify", json={"token": paid_token})
    assert_true(res.status_code == 200, f"Token verify returned {res.status_code}")
    token_data = res.json()
    assert_true(token_data.get("valid") == True, "Token is valid")
    assert_true(token_data.get("email") == paid_email, "Token bound 1:1 to email")

    # Step 7: Verify phone number using SMS code
    log(f"4. Send SMS code to phone: {paid_phone}")
    res = requests.post(f"{BASE_URL}/api/auth/phone/send-code", json={"phone": paid_phone})
    assert_true(res.status_code == 200, f"Send code returned {res.status_code}")
    send_data = res.json()
    sms_code = send_data.get("demoCode") or send_data.get("mock_code") or "123456"

    log(f"5. Verify SMS code with token {paid_token}")
    res = requests.post(f"{BASE_URL}/api/auth/phone/verify-code", json={
        "phone": paid_phone,
        "code": sms_code,
        "token": paid_token
    })
    assert_true(res.status_code == 200, f"Verify code returned {res.status_code}")
    verify_data = res.json()
    assert_true(verify_data.get("verified") == True, "Phone verified")
    assert_true(verify_data.get("is_new_member") == True, "Flagged as new member")
    assert_true(verify_data.get("onboarding_completed") == False, "Onboarding is NOT completed")
    assert_true(verify_data.get("onboarding_step") == "questionnaire", "Onboarding step is questionnaire")

    paid_user = verify_data.get("user")
    assert_true(bool(paid_user), "User record created in database")
    paid_user_id = paid_user.get("id")
    session_token = verify_data.get("token") or verify_data.get("session_token")
    assert_true(bool(session_token), f"Received session token: {session_token}")

    auth_headers = {
        "Authorization": f"Bearer {session_token}",
        "x-user-id": paid_user_id
    }

    # Verify backend feature gate: Incomplete member cannot access member features!
    log("6. Verify backend gate: Incomplete member cannot access member directory or feed")
    res = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
    assert_true(res.status_code == 403, f"Directory correctly blocked with 403 (got {res.status_code})")
    assert_true("onboarding_incomplete" in res.text, "Error indicates onboarding_incomplete")

    res = requests.get(f"{BASE_URL}/api/community/posts", headers=auth_headers)
    assert_true(res.status_code == 403, f"Community feed correctly blocked with 403 (got {res.status_code})")

    res = requests.get(f"{BASE_URL}/api/events", headers=auth_headers)
    assert_true(res.status_code == 403, f"Events correctly blocked with 403 (got {res.status_code})")

    # Step 8: Answering questionnaire questions midway
    log("7. User answers Question 2, Question 7, Question 14 (partial questionnaire)")
    res = requests.post(f"{BASE_URL}/api/profile/{paid_user_id}/answers-bulk", headers=auth_headers, json={
        "answers": [
            {"question_id": 2, "value": "Dubai, United Arab Emirates", "visibility": "shared"},
            {"question_id": 7, "value": "Founder & CEO", "visibility": "shared"},
            {"question_id": 14, "value": "Scaling AI venture", "visibility": "shared"}
        ]
    })
    assert_true(res.status_code == 200, f"Bulk answers returned {res.status_code}")
    assert_true(res.json().get("is_complete") == False, "Profile is still not complete (Question 18 not yet answered)")

    # Simulate app restart / session reload midway
    log("8. Simulate reload midway: Check onboarding status & persisted answers")
    res = requests.get(f"{BASE_URL}/api/onboarding/progress?userId={paid_user_id}", headers=auth_headers)
    assert_true(res.status_code == 200, f"Onboarding progress returned {res.status_code}")
    prog = res.json()
    assert_true(prog.get("onboarding_completed") == False, "Progress still indicates incomplete")
    assert_true(prog.get("onboarding_step") == "questionnaire", "Progress step is questionnaire")
    assert_true(prog.get("answered_count") >= 3, "Draft answers persisted in database")

    res = requests.get(f"{BASE_URL}/api/profile/{paid_user_id}?viewerId={paid_user_id}", headers=auth_headers)
    assert_true(res.status_code == 200, f"Profile hydration returned {res.status_code}")
    prof = res.json()
    assert_true(prof.get("onboarding_step") == "questionnaire", "Profile indicates onboarding_step=questionnaire")

    # Complete the questionnaire with required Question 18
    log("9. Submit required Question 18 ('What can you offer other members?')")
    res = requests.post(f"{BASE_URL}/api/profile/{paid_user_id}/answers-bulk", headers=auth_headers, json={
        "answers": [
            {"question_id": 18, "value": "Executive introductions & FinTech advisory", "visibility": "shared"}
        ]
    })
    assert_true(res.status_code == 200, f"Question 18 submit returned {res.status_code}")
    ans_data = res.json()
    assert_true(ans_data.get("is_complete") == True, "Profile is marked complete (is_complete = true)")
    assert_true(ans_data.get("onboarding_step") == "subscription_payment", "Paid member step is subscription_payment")

    # Step 9: Membership is Paid -> Verify that subscription payment is required before member features unlock
    log("10. Verify that Paid member is still blocked from member features until subscription payment")
    res = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
    assert_true(res.status_code == 403, f"Directory blocked awaiting payment (got {res.status_code})")

    # Complete subscription payment
    log("11. Paid member completes subscription payment")
    res = requests.post(f"{BASE_URL}/api/membership/activate-subscription", headers=auth_headers, json={
        "userId": paid_user_id
    })
    assert_true(res.status_code == 200, f"Activate subscription returned {res.status_code}")
    sub_data = res.json()
    assert_true(sub_data.get("subscription_status") == "active", "Subscription status is active")
    assert_true(sub_data.get("onboarding_step") == "completed", "Onboarding step is completed")

    # Step 10: Open main app -> Member features are now fully accessible!
    log("12. Verify that member features are now fully accessible")
    res = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
    assert_true(res.status_code == 200, f"Directory accessible after payment (got {res.status_code})")
    assert_true(len(res.json()) > 0, "Member directory returned listings")

    res = requests.get(f"{BASE_URL}/api/community/posts", headers=auth_headers)
    assert_true(res.status_code == 200, f"Community feed accessible (got {res.status_code})")

    # -------------------------------------------------------------------------
    # TEST 2: COMPLIMENTARY MEMBERSHIP PATH
    # -------------------------------------------------------------------------
    log("\n--- TEST 2: Complimentary Membership Path ---")
    comp_email = f"test.comp.{ts}@circle.io"
    comp_phone = f"+1556{ts % 10000000:07d}"
    comp_name = f"Complimentary VIP {ts % 1000}"

    log(f"1. Requester submits access request: {comp_email}")
    res = requests.post(f"{BASE_URL}/api/invitations/request-access", json={
        "email": comp_email,
        "fullName": comp_name,
        "role": "Philanthropist & Board Member",
        "phone": comp_phone
    })
    assert_true(res.status_code in [200, 201], "Access request created")

    log("2. Admin approves as Complimentary membership")
    res = requests.post(f"{BASE_URL}/api/admin/invitations/review/decision", json={
        "email": comp_email,
        "action": "approve",
        "membership_tier": "complimentary",
        "adminEmail": "ermolov.elena@gmail.com"
    })
    assert_true(res.status_code == 200, "Approved as complimentary")
    comp_token = res.json().get("token")
    assert_true(bool(comp_token), f"Received token: {comp_token}")

    log("3. Validate invitation code")
    res = requests.post(f"{BASE_URL}/api/invitations/verify", json={"token": comp_token})
    assert_true(res.status_code == 200 and res.json().get("valid") == True, "Token valid")

    log("4. Verify phone number")
    requests.post(f"{BASE_URL}/api/auth/phone/send-code", json={"phone": comp_phone})
    res = requests.post(f"{BASE_URL}/api/auth/phone/verify-code", json={
        "phone": comp_phone,
        "code": "123456",
        "token": comp_token
    })
    assert_true(res.status_code == 200, "Phone verified")
    comp_verify = res.json()
    assert_true(comp_verify.get("onboarding_completed") == False, "Complimentary member must still answer questionnaire")
    assert_true(comp_verify.get("onboarding_step") == "questionnaire", "Complimentary member starts at questionnaire")

    comp_user_id = comp_verify.get("user", {}).get("id")
    comp_session = comp_verify.get("token") or comp_verify.get("session_token")
    comp_headers = {
        "Authorization": f"Bearer {comp_session}",
        "x-user-id": comp_user_id
    }

    log("5. Answer Question 18 to complete profile")
    res = requests.post(f"{BASE_URL}/api/profile/{comp_user_id}/answers-bulk", headers=comp_headers, json={
        "answers": [
            {"question_id": 18, "value": "Non-profit governance & global health connections", "visibility": "shared"}
        ]
    })
    assert_true(res.status_code == 200, "Answers saved")
    comp_ans = res.json()
    assert_true(comp_ans.get("is_complete") == True, "Profile is marked complete")
    # Complimentary members skip subscription payment!
    assert_true(comp_ans.get("onboarding_step") == "completed", "Complimentary member skips payment -> step is 'completed'")

    log("6. Verify complimentary member enters club immediately")
    res = requests.get(f"{BASE_URL}/api/members", headers=comp_headers)
    assert_true(res.status_code == 200, "Complimentary member accesses directory immediately without payment")

    # -------------------------------------------------------------------------
    # TEST 3: RETURNING COMPLETED MEMBER SIGN-IN
    # -------------------------------------------------------------------------
    log("\n--- TEST 3: Returning Member Sign-In ---")
    log("1. Completed member signs in via phone verification")
    requests.post(f"{BASE_URL}/api/auth/phone/send-code", json={"phone": comp_phone})
    res = requests.post(f"{BASE_URL}/api/auth/phone/verify-code", json={
        "phone": comp_phone,
        "code": "123456"
    })
    assert_true(res.status_code == 200, "Returning member verified")
    ret_data = res.json()
    assert_true(ret_data.get("is_existing_member") == True, "Recognized as existing member")
    assert_true(ret_data.get("onboarding_completed") == True, "Onboarding is recognized as completed")
    assert_true(ret_data.get("onboarding_step") == "completed", "Step is completed")

    # -------------------------------------------------------------------------
    # TEST 4: PRESERVE EXISTING FOUNDERS & MEMBERS
    # -------------------------------------------------------------------------
    log("\n--- TEST 4: Existing Founders & Completed Members Preserved ---")
    res = requests.get(f"{BASE_URL}/api/members?viewerId=usr_alexandra")
    assert_true(res.status_code == 200, "Founder usr_alexandra has full access")

    res = requests.get(f"{BASE_URL}/api/members?viewerId=usr_elena")
    assert_true(res.status_code == 200, "Founder usr_elena has full access")

    log("\n================================================================================")
    log("ALL TESTS COMPLETED SUCCESSFULLY! Registration flow & questionnaire gate verified.")
    log("================================================================================")

if __name__ == "__main__":
    main()
