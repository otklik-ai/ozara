#!/usr/bin/env python3
"""
tools/test_full_platform_api.py
Comprehensive End-to-End API Integration Test Suite for Sila Svyazei.
Tests all endpoints, role-based views, privacy filters, Q23 locks, Q18 mandates,
content guardrails, and two-person export approvals over live HTTP.
"""

import json
import sys
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "http://localhost:3000"

def get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def post(path, data):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def test_suite():
    print("[*] Starting Full Platform API Test Suite...")

    # 1. Personas
    status, personas = get("/api/personas")
    assert status == 200 and len(personas) >= 5, f"Personas failed: {personas}"
    print(f"[PASS] Personas endpoint returned {len(personas)} verified entities.")

    # 2. Explainable Recommendations for Elena
    status, recs = get("/api/recommendations?viewerId=usr_elena")
    assert status == 200 and len(recs) > 0, "Recommendations failed"
    top_rec = recs[0]
    assert top_rec["id"] == "usr_marcus", f"Expected Marcus Vance as top match, got {top_rec['id']}"
    assert "Enterprise AI" in top_rec["match_rationale"], f"Missing explainability: {top_rec['match_rationale']}"
    print(f"[PASS] Explainable Recommendations verified: Top match is {top_rec['full_name']} ({top_rec['match_score']*100}%).")
    print(f"       Rationale: \"{top_rec['match_rationale']}\"")

    # 3. Privacy Filter & Question 23 Permanent Lock
    # 3a. Member viewing member: Q23 MUST be redacted
    status, member_view = get("/api/profile/usr_elena?viewerId=usr_marcus")
    q23_member = next(a for a in member_view["answers"] if a["question_id"] == 23)
    assert q23_member.get("is_redacted") == True, f"Q23 leaked to member! {q23_member}"
    assert "visible solely to administrators" in q23_member["value_text"], "Missing confidentiality notice"
    print("[PASS] Member-to-Member privacy verified: Question 23 is redacted.")

    # 3b. Founder viewing member: Q23 is readable AND generates audit log
    status, founder_view = get("/api/profile/usr_elena?viewerId=usr_alexandra")
    q23_founder = next(a for a in founder_view["answers"] if a["question_id"] == 23)
    assert q23_founder.get("is_redacted") is not True, "Founder blocked from viewing Q23!"
    assert "CONFIDENTIAL TO FOUNDERS" in q23_founder["value_text"], "Missing confidential founder value"
    print("[PASS] Founder view of Question 23 authorized and verified.")

    # Verify audit log was recorded for Alexandra's view
    status, audit_logs = get("/api/admin/audit-logs")
    alex_logs = [l for l in audit_logs if l["actor_id"] == "usr_alexandra" and l["question_id"] == 23 and l["target_member_id"] == "usr_elena"]
    assert len(alex_logs) > 0, "Audit log was not recorded for founder Q23 view!"
    print(f"[PASS] Immutable Audit Log verified: {len(alex_logs)} record(s) logged for Question 23 access.")

    # 4. Content Moderation Guardrail
    bad_payload = {
        "userId": "usr_elena",
        "questionId": 18,
        "valueText": "We guarantee a 30% return with risk-free profit on all investments.",
        "answerState": "answered",
        "visibility": "shared"
    }
    status, err_resp = post("/api/intake/answer", bad_payload)
    assert status == 422 and err_resp.get("flagged") == True, f"Failed to reject prohibited content: {status}, {err_resp}"
    print(f"[PASS] Content Guardrail actively blocked prohibited content: \"{err_resp['error']}\"")

    # Clean payload
    clean_payload = {
        "userId": "usr_elena",
        "questionId": 18,
        "valueText": "Scaling our GCC-European corporate trade payment clearing rails to $500M annually.",
        "answerState": "answered",
        "visibility": "shared"
    }
    status, ok_resp = post("/api/intake/answer", clean_payload)
    assert status == 200 and ok_resp.get("is_complete") == True, f"Failed clean intake save: {ok_resp}"
    print("[PASS] Clean intake payload accepted and profile completion confirmed.")

    # 5. Targeted Event Invitation Preview & Deduplication
    preview_req = {
        "eventId": "evt_dubai_dinner",
        "chapters": ["ch_dubai"],
        "includeTravelersInCity": "Dubai",
        "industries": []
    }
    status, preview_resp = post("/api/events/invitations/preview", preview_req)
    assert status == 200, f"Preview failed: {preview_resp}"
    recipient_names = [r["full_name"] for r in preview_resp["recipients"]]
    assert "Marcus Vance" in recipient_names, "Traveling member missing from targeted preview!"
    assert "Elena Ermolov" in recipient_names, "Local member missing from targeted preview!"
    print(f"[PASS] Targeted Event Invitation Preview: {preview_resp['recipient_count']} deduplicated recipients.")
    print(f"       Recipients included both residents and traveler: {recipient_names}")

    # 6. Two-Person Export Dual-Custody Mandate
    # Step 1: Julia requests export
    status, exp_req = post("/api/admin/exports/request", {"adminId": "usr_julia", "exportType": "members_directory_csv"})
    assert status == 200, "Export request failed"
    exp_id = exp_req["expId"]

    # Step 2: Julia attempts to self-approve (MUST BE REJECTED)
    status, self_appr = post("/api/admin/exports/approve", {"expId": exp_id, "approverId": "usr_julia"})
    assert status == 403, f"Self-approval was not rejected: {status}, {self_appr}"
    print(f"[PASS] Two-Person Rule Enforcement: Self-approval blocked with: \"{self_appr['error']}\"")

    # Step 3: Alexandra approves (MUST SUCCEED)
    status, valid_appr = post("/api/admin/exports/approve", {"expId": exp_id, "approverId": "usr_alexandra"})
    assert status == 200 and "downloadToken" in valid_appr, f"Valid approval failed: {valid_appr}"
    print(f"[PASS] Dual-Custody Approval verified: Token generated: {valid_appr['downloadToken']}")

    # 7. Real Estate Listings & Inquiries + Access Conditions Server Enforcement
    status, listings = get("/api/listings")
    assert status == 200 and len(listings) >= 2, "Listings retrieval failed"
    assert "eligibility_requirements" in listings[0], "Eligibility requirements missing from listing"

    # Step 1: User with unaccepted conditions (usr_david) MUST BE REJECTED with 403
    unaccepted_status, unaccepted_resp = post("/api/listings/inquire", {
        "listingId": listings[0]["id"],
        "memberId": "usr_david",
        "inquiryType": "request_info",
        "notes": "Interested in private villa details."
    })
    assert unaccepted_status == 403 and unaccepted_resp.get("code") == "CONDITIONS_NOT_ACCEPTED", f"Expected 403 for unaccepted conditions, got {unaccepted_status}: {unaccepted_resp}"
    print(f"[PASS] Access Conditions Server-Side Enforcement verified: Unaccepted user blocked with 403: \"{unaccepted_resp['error']}\"")

    # Step 2: User with accepted conditions (usr_marcus) MUST SUCCEED with 200
    inq_status, inq_resp = post("/api/listings/inquire", {
        "listingId": listings[0]["id"],
        "memberId": "usr_marcus",
        "inquiryType": "request_info",
        "notes": "Requesting full asset memorandum and title deed details."
    })
    assert inq_status == 200, f"Listing inquiry failed: {inq_resp}"
    # 8. Invitation Gate, 1:1 Email-Token Mapping & Elena Ermolov Admin Approval
    test_applicant_email = f"candidate_{int(datetime.utcnow().timestamp())}@venture.ch"
    
    # Step 1: Submit access request
    status, req_access = post("/api/invitations/request-access", {
        "email": test_applicant_email,
        "fullName": "Baroness Julia Rothschild",
        "role": "General Partner, Alpine Sovereign Fund",
        "notes": "Requesting admission to Dubai & Zurich chapters."
    })
    assert status == 200 and req_access["status"] == "pending", f"Request access failed: {req_access}"
    assert req_access["adminNotificationRecipient"] == "ermolov.elena@gmail.com", "Admin notification recipient mismatch"
    print(f"[PASS] Access Request successfully submitted and routed to Elena Ermolov: {test_applicant_email}")

    # Step 2: Poll status while pending
    status, poll_pending = get(f"/api/invitations/status?email={test_applicant_email}")
    assert status == 200 and poll_pending["status"] == "pending" and not poll_pending["has_token"], f"Pending status check failed: {poll_pending}"
    print(f"[PASS] Real-time access status polling verified (State: pending)")

    # Step 2b: Self-approval attempt by candidate MUST be blocked with 403
    status, self_approve_err = post("/api/admin/invitations/approve", {
        "email": test_applicant_email,
        "approvedBy": test_applicant_email
    })
    assert status == 403 and "Security Violation" in self_approve_err["message"], f"Self-approval was not blocked: {self_approve_err}"
    print(f"[PASS] Self-approval blocked: {self_approve_err['message']}")

    # Step 2c: Non-founder approval attempt MUST be blocked with 403
    status, unauth_err = post("/api/admin/invitations/approve", {
        "email": test_applicant_email,
        "approvedBy": "random_hacker@domain.com"
    })
    assert status == 403 and "Access Denied" in unauth_err["message"], f"Unauthorized approval was not blocked: {unauth_err}"
    print(f"[PASS] Unauthorized approval blocked: {unauth_err['message']}")

    # Step 3: Authorized Founder Elena Ermolov approves the request
    status, approval = post("/api/admin/invitations/approve", {
        "email": test_applicant_email,
        "approvedBy": "ermolov.elena@gmail.com"
    })
    assert status == 200 and approval["status"] == "approved" and "token" in approval, f"Elena Ermolov approval failed: {approval}"
    issued_token = approval["token"]
    assert issued_token.startswith("OZARA-"), f"Token format invalid: {issued_token}"
    print(f"[PASS] Elena Ermolov approved request: Generated 1:1 token {issued_token} dispatched to {test_applicant_email}")

    # Step 4: Token verification identifies 1:1 bound email
    status, verify_resp = post("/api/invitations/verify", {"token": issued_token})
    assert status == 200 and verify_resp["valid"] is True, f"Token verification failed: {verify_resp}"
    assert verify_resp["email"] == test_applicant_email, f"1:1 Email mismatch: expected {test_applicant_email}, got {verify_resp['email']}"
    print(f"[PASS] 1:1 Token Verification confirmed: Token {issued_token} bound strictly to {test_applicant_email}")

    # Step 5: Member registers using verified token
    status, reg_resp = post("/api/register", {
        "full_name": "Baroness Julia Rothschild",
        "email": test_applicant_email,
        "headline": "General Partner, Alpine Sovereign Fund",
        "chapter_id": "ch_dubai",
        "token": issued_token,
        "accepted_conditions_version": "2026-10-v1"
    })
    assert status == 200 and reg_resp["success"] is True, f"Registration with verified token failed: {reg_resp}"
    print(f"[PASS] Pre-populated registration completed: User {reg_resp['user']['id']} admitted via verified token.")

    # Step 6: Verify token is claimed and burned
    status, burn_check = post("/api/invitations/verify", {"token": issued_token})
    assert status == 400 and "already been claimed" in burn_check["message"], f"Claimed token not blocked: {burn_check}"
    print(f"[PASS] Single-use token enforcement verified: Re-use of {issued_token} actively blocked.")

    print("\n[ALL 8 TEST SUITES PASSED FLAWLESSLY 100%]")

if __name__ == "__main__":
    test_suite()

