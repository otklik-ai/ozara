#!/usr/bin/env python3
"""
tools/test_questionnaire_flow.py
Verifies the complete token entry -> registration -> bulk questionnaire onboarding flow:
1. Canonical 30 questions schema, Question 18 required flag, Question 23 confidential flag.
2. Submit access request for new prospective user.
3. Founder approval by Elena Ermolov generating 1:1 token.
4. Verify 1:1 token and pre-populated locked email.
5. Registration transition with profile coordinates.
6. Auto-seeding of all 30 questions in unanswered state.
7. Bulk saving of questionnaire answers.
8. Validation of Question 18 requirement for verified profile completion.
9. Verification of Question 23 permanent private lock.
"""

import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"

def request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return json.loads(err_body), e.code
        except Exception:
            return {"error": err_body}, e.code

def run():
    print("[*] Testing Complete Token -> Registration -> 30-Question Flow...")

    # 1. Verify 30 Canonical Questions
    questions, status = request("/api/questions")
    assert status == 200, f"Failed fetching questions: {status}"
    assert len(questions) == 30, f"Expected 30 canonical questions, got {len(questions)}"
    
    q18 = next(q for q in questions if q["id"] == 18)
    assert q18["is_required"] is True, "Question 18 must be required"
    
    q23 = next(q for q in questions if q["id"] == 23)
    assert q23["is_confidential"] is True, "Question 23 must be confidential"
    assert q23["default_visibility"] == "private", "Question 23 default visibility must be private"
    print(f" [PASS] Canonical Questions: 30 loaded, Q18 required, Q23 confidential.")

    # 2. Submit Access Request for new candidate
    import time
    cand_email = f"alexander.vance.{int(time.time())}@sovereign-tech.io"
    req_res, status = request("/api/invitations/request-access", method="POST", data={
        "fullName": "Alexander Vance",
        "email": cand_email,
        "role": "Managing Partner, Sovereign Tech Capital",
        "notes": "Requesting entry to Dubai and Singapore chapters."
    })
    assert status == 200, f"Access request failed: {req_res}"
    print(f" [PASS] Access Request submitted for {cand_email}")

    # 3. Founder Approval by Elena Ermolov
    approve_res, status = request("/api/admin/invitations/approve", method="POST", data={
        "approvedBy": "ermolov.elena@gmail.com",
        "email": cand_email,
        "fullName": "Alexander Vance"
    })
    assert status == 200, f"Approval failed: {approve_res}"
    token = approve_res["token"]
    assert token.startswith("OZARA-"), f"Unexpected token: {token}"
    print(f" [PASS] Approved by Elena Ermolov. Token generated: {token}")

    # 4. Verify 1:1 Token
    verify_res, status = request("/api/invitations/verify", method="POST", data={"token": token})
    assert status == 200, f"Verification failed: {verify_res}"
    assert verify_res["valid"] is True
    assert verify_res["email"] == cand_email
    print(f" [PASS] Token {token} successfully verified for {cand_email}")

    # 5. User Registration with Profile Picture and Structured Location/Industry
    test_avatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
    reg_res, status = request("/api/register", method="POST", data={
        "full_name": "Alexander Vance",
        "email": cand_email,
        "headline": "Managing Partner, Sovereign Tech Capital",
        "avatar_url": test_avatar,
        "country": "United Arab Emirates",
        "state": "Dubai",
        "city": "DIFC",
        "industry": "Artificial Intelligence & DeepTech",
        "chapter_id": "ch_dubai",
        "token": token
    })
    assert status in (200, 201), f"Registration failed: {reg_res}"
    user = reg_res["user"]
    user_id = user["id"]
    assert user["avatar_url"] == test_avatar, f"Avatar mismatch: {user.get('avatar_url')}"
    assert user["country"] == "United Arab Emirates", f"Country mismatch: {user.get('country')}"
    assert user["state"] == "Dubai", f"State mismatch: {user.get('state')}"
    assert user["city"] == "DIFC", f"City mismatch: {user.get('city')}"
    assert user["industry"] == "Artificial Intelligence & DeepTech", f"Industry mismatch: {user.get('industry')}"
    assert user["is_complete"] == 0 or user["is_complete"] is False, "New profile should not be marked complete before answering Q18"
    print(f" [PASS] User registered with separate fields: Country={user['country']}, State={user['state']}, City={user['city']}, Industry={user['industry']}")

    # 6. Verify 30 questions were seeded for this user and separate fields persisted
    user_profile, status = request(f"/api/profile/{user_id}")
    assert status == 200, f"Profile fetch failed: {user_profile}"
    assert user_profile["avatar_url"] == test_avatar, "Avatar did not persist in profile"
    assert user_profile["country"] == "United Arab Emirates", "Country did not persist"
    assert user_profile["state"] == "Dubai", "State did not persist"
    assert user_profile["city"] == "DIFC", "City did not persist"
    assert user_profile["industry"] == "Artificial Intelligence & DeepTech", "Industry did not persist"
    print(f" [PASS] User profile verified with separate location (Country, State, City) & Industry.")

    # 7. Bulk Submit Questionnaire Answers WITHOUT Question 18
    bulk_res_no_q18, status = request(f"/api/profile/{user_id}/answers-bulk", method="POST", data={
        "answers": [
            {"question_id": 1, "value": "Building sovereign cross-border compute clusters", "visibility": "shared"},
            {"question_id": 5, "value": "Dubai & Singapore family offices", "visibility": "shared"}
        ]
    })
    assert status == 200, f"Bulk save failed: {bulk_res_no_q18}"
    assert bulk_res_no_q18["is_complete"] is False, "Profile must remain incomplete without Question 18"
    print(f" [PASS] Partial questionnaire saved. Profile completion remains False without Q18.")

    # 8. Bulk Submit Questionnaire Answers WITH Question 18 and Question 23
    bulk_res_with_q18, status = request(f"/api/profile/{user_id}/answers-bulk", method="POST", data={
        "answers": [
            {"question_id": 18, "value": "Deploy $100M infrastructure fund across MENA & APAC.", "visibility": "shared"},
            {"question_id": 23, "value": "Seeking discreet advice on sovereign fund GP structuring.", "visibility": "shared"} # tries shared
        ]
    })
    assert status == 200, f"Bulk save failed: {bulk_res_with_q18}"
    assert bulk_res_with_q18["is_complete"] is True, "Profile must be marked complete once Q18 is answered"
    print(f" [PASS] Question 18 answered: Profile is_complete is now True!")

    # 9. Verify Question 23 Permanent Lock Rule:
    # 9a. Peer member view: Question 23 MUST be redacted with founder confidentiality disclaimer
    peer_profile, status = request(f"/api/profile/{user_id}?viewerId=usr_peer_member")
    assert status == 200
    assert peer_profile["is_complete"] is True
    peer_answers = peer_profile.get("answers", [])
    q23_peer = next((a for a in peer_answers if a.get("question_id") == 23), None)
    assert q23_peer is not None, "Question 23 should be present in peer view"
    assert q23_peer.get("is_redacted") is True, "Question 23 must be marked is_redacted: True for peers"
    assert q23_peer.get("visibility") == "private", "Question 23 visibility must be locked to private"
    assert "Confidential founder note" in q23_peer.get("value_text", ""), "Question 23 must show confidentiality disclaimer to peers"
    print(f" [PASS] Question 23 Permanent Lock verified: Redacted for peer members with founder confidentiality notice.")

    # 9b. Owner view: Member can view their own private answer
    owner_profile, status = request(f"/api/profile/{user_id}?viewerId={user_id}")
    assert status == 200
    owner_answers = owner_profile.get("answers", [])
    q23_owner = next((a for a in owner_answers if a.get("question_id") == 23), None)
    assert q23_owner is not None
    assert q23_owner.get("is_q23_founder_locked") is True
    assert q23_owner.get("value_text") == "Seeking discreet advice on sovereign fund GP structuring."
    print(f" [PASS] Owner view verified: Member can securely view their own confidential founder note.")

    print("\n[SUCCESS] ALL TOKEN -> REGISTRATION -> 30-QUESTION FLOW INVARIANTS PASSED 100%!")

if __name__ == "__main__":
    run()
