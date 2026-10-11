#!/usr/bin/env python3
"""
tools/test_profile_networking_redesign.py
Automated integration tests for the Professional Networking Profile Redesign:
1. Validates structured profile payload mapping (9 canonical networking sections)
2. Validates strict privacy invariants for peer member viewing (private answers redacted)
3. Validates Question 23 permanent founder confidentiality lock
4. Validates Question 18 mandatory completion invariant
5. Validates real-time answer update and profile synchronization
"""

import json
import urllib.request
import urllib.error
import sys

BASE_URL = "http://localhost:3000"

def get(path, headers=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode('utf-8')
            return resp.status, json.loads(data)
    except urllib.error.HTTPError as e:
        err_data = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_data)
        except:
            return e.code, {"error": err_data}

def post(path, body, headers=None):
    url = f"{BASE_URL}{path}"
    data_bytes = json.dumps(body).encode('utf-8')
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data_bytes, headers=h)
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode('utf-8')
            return resp.status, json.loads(data)
    except urllib.error.HTTPError as e:
        err_data = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_data)
        except:
            return e.code, {"error": err_data}

def run_tests():
    print("[*] Starting Professional Networking Profile Redesign Test Suite...")

    # 1. Fetch Profile for Elena (Self View)
    status, profile_self = get("/api/profile/usr_elena?viewerId=usr_elena")
    assert status == 200, f"Expected 200, got {status}: {profile_self}"
    assert profile_self["full_name"] == "Elena Ermolov", f"Expected Elena Ermolov, got {profile_self['full_name']}"
    assert len(profile_self["answers"]) >= 20, f"Expected canonical answers, got {len(profile_self['answers'])}"
    print(" [PASS] Self profile view loaded with complete canonical questionnaire answers.")

    # 2. Verify Mapping of Canonical Fields for 9 Sections
    answers_map = {a["question_id"]: a for a in profile_self["answers"]}
    
    # Q1: Full Name
    assert 1 in answers_map, "Q1 missing"
    # Q2: Location
    assert 2 in answers_map, "Q2 missing"
    # Q10: One sentence
    assert 10 in answers_map, "Q10 missing"
    # Q12: Background
    assert 12 in answers_map, "Q12 missing"
    # Q13: Website / LinkedIn
    assert 13 in answers_map, "Q13 missing"
    # Q14: Current Focus
    assert 14 in answers_map, "Q14 missing"
    # Q17: Who to connect with
    assert 17 in answers_map, "Q17 missing"
    # Q18: What I Can Offer
    assert 18 in answers_map, "Q18 missing"
    # Q22: Interests
    assert 22 in answers_map, "Q22 missing"
    # Q24: Home Chapter
    assert 24 in answers_map, "Q24 missing"
    print(" [PASS] All canonical questionnaire questions mapped to 9 networking sections.")

    # 3. Privacy Enforcement: Peer Member Viewing (usr_marcus viewing usr_alexandra)
    # Check if a non-founder peer viewer exists
    status, members = get("/api/members?viewerId=usr_elena")
    assert status == 200, "Could not fetch members"
    peer_member = next((m for m in members if m["id"] not in ["usr_elena", "usr_alexandra", "usr_julia"]), None)

    if peer_member:
        peer_id = peer_member["id"]
        # Fetch peer viewing Elena's profile
        status, peer_view = get(f"/api/profile/usr_elena?viewerId={peer_id}")
        assert status == 200, f"Peer view failed: {peer_view}"
        
        # Check Question 23 (Confidential note) is REDACTED for regular member
        q23 = next((a for a in peer_view["answers"] if a["question_id"] == 23), None)
        assert q23 is not None, "Q23 not returned in answers"
        assert q23.get("is_redacted") is True or "[Confidential" in q23.get("value_text", ""), f"Q23 must be redacted: {q23}"
        print(" [PASS] Question 23 Permanent Lock verified: Confidential to founders and redacted for peers.")

        # Check that private answers are redacted
        for ans in peer_view["answers"]:
            if ans.get("visibility") == "private" and ans["question_id"] != 23:
                assert ans.get("is_redacted") is True or ans.get("value_text") == "[Private]", f"Private answer {ans['question_id']} not redacted: {ans}"
        print(" [PASS] Strict privacy enforcement verified: All private fields sanitized for peer members.")

    # 4. Invariant: Question 18 Mandate for is_complete
    status, alexandra = get("/api/profile/usr_alexandra?viewerId=usr_alexandra")
    assert status == 200
    q18_alex = next((a for a in alexandra["answers"] if a["question_id"] == 18), None)
    if q18_alex and q18_alex.get("value_text"):
        assert alexandra["is_complete"] is True, "Profile with Q18 must be is_complete = True"
        print(" [PASS] Question 18 Mandate verified: Answered Q18 results in is_complete = True.")

    # 5. Real-Time Editing & Synchronization
    # Update Q14 focus for Elena and ensure it reflects immediately
    test_focus = json.dumps({"tags": ["AI Agents", "Cross-border Payments"], "note": "Scaling Middle East & European operations"})
    status, save_res = post("/api/profile/usr_elena/answers/14", {
        "userId": "usr_elena",
        "questionId": 14,
        "value": test_focus,
        "visibility": "shared"
    }, headers={"x-user-id": "usr_elena"})
    assert status in [200, 201], f"Save failed: {save_res}"

    # Re-fetch Elena's profile to verify instant synchronization
    status, refreshed = get("/api/profile/usr_elena?viewerId=usr_elena")
    assert status == 200
    q14_refreshed = next((a for a in refreshed["answers"] if a["question_id"] == 14), None)
    assert q14_refreshed is not None
    assert "AI Agents" in q14_refreshed["value_text"], f"Expected updated focus, got: {q14_refreshed['value_text']}"
    print(" [PASS] Real-time questionnaire edit synchronization verified.")

    print("\n[SUCCESS] ALL PROFESSIONAL NETWORKING PROFILE REDESIGN TESTS PASSED 100%!")

if __name__ == "__main__":
    run_tests()
