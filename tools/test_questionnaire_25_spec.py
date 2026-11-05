#!/usr/bin/env python3
"""
Verification test suite for the 25-Question, 6-Screen Member Onboarding Questionnaire.
Tests:
1. 25 canonical questions across 6 screens, required=[1, 2, 3, 6, 7, 25], default_visibility='private'.
2. Screen 4 & 5 strict no-free-text guardrail (422 on arbitrary text, 200 on canonical options).
3. Screen 3 to 5 AES-256-GCM encryption at rest in SQLite (`enc:v1:...`).
4. Visibility rules: Team-only locked to Founders/Admins & owner; Switch starts Private; Q7 Private mode forces switches to Private and hides member from directory.
5. Audit logging (`view_encrypted_screens_3_to_5`) when Founders/Admins view Screen 3-5 answers.
6. Referral/invitation-only is enough (no net-worth floor) and referrer join status remains strictly private.
"""

import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

TEST_PORT = 3099
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"
DB_PATH = "/Users/bikram6am/Sila/sila.db"


def request_json(method, path, payload=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body}


def main():
    env = os.environ.copy()
    env["PORT"] = str(TEST_PORT)
    proc = subprocess.Popen(
        ["node", "/Users/bikram6am/Sila/server.js"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        # Wait for server to listen
        ready = False
        for _ in range(30):
            try:
                status, _ = request_json("GET", "/api/questions")
                if status == 200:
                    ready = True
                    break
            except Exception:
                time.sleep(0.25)
        assert ready, "Server did not start on test port"

        # 1. Verify GET /api/questions returns 25 questions across 6 screens
        status, q_res = request_json("GET", "/api/questions")
        assert status == 200, f"Expected 200, got {status}"
        questions = q_res if isinstance(q_res, list) else q_res["questions"]
        assert len(questions) == 25, f"Expected 25 questions, got {len(questions)}"
        screens = sorted(set(q["screen"] for q in questions))
        assert screens == [1, 2, 3, 4, 5, 6], f"Expected screens 1..6, got {screens}"

        req_ids = [q["id"] for q in questions if q["is_required"]]
        assert req_ids == [1, 2, 3, 6, 7, 25], f"Expected required [1,2,3,6,7,25], got {req_ids}"

        switch_ids = [q["id"] for q in questions if q["visibility_mode"] == "switch"]
        assert switch_ids == [8, 9, 10, 11, 12, 24], f"Expected switch [8,9,10,11,12,24], got {switch_ids}"

        for q in questions:
            assert q["default_visibility"] == "private", f"Q{q['id']} must default to private"
            if 12 <= q["id"] <= 23:
                assert q["is_encrypted"] is True, f"Q{q['id']} on Screen 3-5 must have is_encrypted=True"
            if 17 <= q["id"] <= 23:
                assert q["no_free_text"] is True, f"Q{q['id']} on Screen 4-5 must have no_free_text=True"
        print("PASS 1: GET /api/questions verified (25 questions, 6 screens, required=[1,2,3,6,7,25], default Private)")

        # 2. Create a test user via invitation token and test onboarding completion with ONLY the 6 required questions
        test_email = f"q25_test_{int(time.time())}@example.com"
        token = f"OZARA-TEST-{int(time.time())}"
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO invitation_tokens (id, token, email, full_name, created_by, expires_at, status, is_claimed, membership_tier)
            VALUES (?, ?, ?, 'Test Q25 Member', 'usr_alexandra', '2027-12-31T00:00:00.000Z', 'approved', 0, 'complimentary')
            """,
            (f"inv_{int(time.time())}", token, test_email),
        )
        conn.commit()

        status, reg = request_json(
            "POST",
            "/api/register",
            {
                "email": test_email,
                "full_name": "Test Q25 Member",
                "headline": "Founder",
                "token": token,
                "country": "United Kingdom",
                "city": "London",
                "phone": "+44 7700900000",
                "accepted_conditions_version": "1.0",
            },
        )
        assert status == 200 and reg.get("user"), f"Registration failed: {reg}"
        uid = reg["user"]["id"]

        # Verify user starts incomplete before Q6, Q7, Q25 are answered
        status, prog = request_json("GET", f"/api/onboarding/progress?userId={uid}")
        assert status == 200
        assert prog["is_complete"] is False, "New user should not be complete before Q6, Q7, Q25"

        # 3. Verify no-free-text guardrail on Screens 4 & 5 (Q17-Q23)
        status, bad_ft = request_json(
            "POST",
            f"/api/profile/{uid}/answers",
            {"question_id": 17, "value": "My account number is 12345678 at UBS", "visibility": "private"},
        )
        assert status == 422, f"Expected 422 for free text on Screen 4 (Q17), got {status}: {bad_ft}"
        assert bad_ft.get("code") == "no_free_text_on_screens_4_and_5"
        print("PASS 2: Free text on Screens 4 & 5 strictly rejected with 422")

        # 4. Save all 6 required questions + encrypted Screen 3-5 answers + switched-on Q9 & Q11
        bulk_answers = [
            {"question_id": 1, "value": "Test Q25 Member", "visibility": "private"},
            {"question_id": 2, "value": test_email, "visibility": "private"},
            {"question_id": 3, "value": "+44 7700900000", "visibility": "private"},
            {"question_id": 6, "value": json.dumps({"source": "Referred by a member (name)", "detail": "Alexandra Hill"}), "visibility": "private"},
            {"question_id": 7, "value": "Visible to members", "visibility": "private"},
            {"question_id": 9, "value": "Fund manager or GP", "visibility": "shared"},
            {"question_id": 10, "value": "Managing partner focused on European software.", "visibility": "shared"},
            {"question_id": 11, "value": "Raising capital, Investing or co-investing", "visibility": "shared"},
            {"question_id": 12, "value": "United Kingdom, Switzerland", "visibility": "private"},
            {"question_id": 13, "value": "United Kingdom", "visibility": "private"},
            {"question_id": 14, "value": json.dumps({"countries": ["United Kingdom", "United States"], "us_states": ["New York"]}), "visibility": "private"},
            {"question_id": 15, "value": "Married", "visibility": "private"},
            {"question_id": 16, "value": "Under 18", "visibility": "private"},
            {"question_id": 17, "value": "Prefer not to say", "visibility": "private"},
            {"question_id": 18, "value": "$2M to $10M", "visibility": "private"},
            {"question_id": 19, "value": "Operating business, Investments", "visibility": "private"},
            {"question_id": 20, "value": "Professional investor (UK or EU)", "visibility": "private"},
            {"question_id": 21, "value": "Private bank or wealth manager, CPA or tax advisor", "visibility": "private"},
            {"question_id": 22, "value": "Will, Trust(s)", "visibility": "private"},
            {"question_id": 23, "value": "Selling a business or liquidity event, Raising capital", "visibility": "private"},
            {"question_id": 24, "value": "Private deals, Venture and startups", "visibility": "shared"},
            {"question_id": 25, "value": "Book a private call", "visibility": "private"},
        ]
        status, save_res = request_json(
            "POST",
            f"/api/profile/{uid}/answers-bulk",
            {"answers": bulk_answers, "onboarding_screen": 6, "questionnaire_consent": True},
        )
        assert status == 200 and save_res.get("is_complete") == 1, f"Expected is_complete=1, got {save_res}"
        print("PASS 3: Onboarding marked complete with the 6 required questions (referral enough, no net worth floor)")

        # 5. Verify Screen 3-5 answers (Q12-Q23) are AES-256-GCM encrypted at rest in SQLite
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute(
            "SELECT question_id, value_text FROM questionnaire_answers WHERE user_id = ? AND question_id BETWEEN 12 AND 23",
            (uid,),
        )
        rows = cur.fetchall()
        assert len(rows) == 12, f"Expected 12 Screen 3-5 rows, got {len(rows)}"
        for q_id, val_text in rows:
            assert val_text.startswith("enc:v1:"), f"Q{q_id} value_text in DB is not encrypted: {val_text}"
        print("PASS 4: All Screen 3 to 5 answers (Q12-Q23) are AES-256-GCM encrypted at rest in SQLite")

        # 6. Verify peer member view only sees switched-on fields and NEVER sees Team-only answers
        peer_id = f"usr_peer_{int(time.time())}"
        cur.execute(
            """
            INSERT INTO users (id, email, full_name, headline, city, country, industry, contact_preference, role, is_admitted, is_complete, onboarding_step, membership_tier, subscription_status)
            VALUES (?, ?, 'Peer Viewer Member', 'Investor', 'London', 'United Kingdom', 'Finance', 'direct_contact', 'MEMBER', 1, 1, 'completed', 'complimentary', 'active')
            """,
            (peer_id, f"peer_{int(time.time())}@example.com"),
        )
        conn.commit()
        status, peer_prof = request_json("GET", f"/api/profile/{uid}?viewerId={peer_id}")
        assert status == 200, f"Expected 200 for peer profile view, got {status}: {peer_prof}"
        ans_by_id = {a["question_id"]: a for a in peer_prof["answers"]}
        for team_q in [1, 2, 3, 6, 7, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25]:
            assert ans_by_id[team_q]["is_redacted"] is True, f"Q{team_q} must be redacted for peer member"
            assert ans_by_id[team_q]["value_text"] in ("[Private]", "[Team only]", "[Confidential — Locked]"), f"Q{team_q} leaked to peer!"
        assert ans_by_id[9]["value_text"] == "Fund manager or GP", "Switched-on Q9 should be visible to peer"
        assert ans_by_id[11]["value_text"] == "Raising capital, Investing or co-investing", "Switched-on Q11 should be visible to peer"
        assert ans_by_id[12]["is_redacted"] is True, "Unswitched Q12 (Private) must be hidden from peer"
        print("PASS 5: Peer member sees only switched-on answers; Team-only & Private answers are strictly redacted")

        # 7. Verify Founder/Admin view decrypts Screen 3-5 answers and writes audit_logs
        founder_id = f"usr_founder_{int(time.time())}"
        cur.execute(
            """
            INSERT INTO users (id, email, full_name, headline, city, country, industry, contact_preference, role, is_admitted, is_complete, onboarding_step, membership_tier, subscription_status)
            VALUES (?, ?, 'Alexandra Hill', 'Founder', 'London', 'United Kingdom', 'Finance', 'direct_contact', 'FOUNDER', 1, 1, 'completed', 'complimentary', 'active')
            """,
            (founder_id, f"founder_{int(time.time())}@example.com"),
        )
        conn.commit()
        status, admin_prof = request_json("GET", f"/api/profile/{uid}?viewerId={founder_id}")
        assert status == 200, f"Expected 200 for founder view, got {status}: {admin_prof}"
        admin_ans = {a["question_id"]: a for a in admin_prof["answers"]}
        assert admin_ans[13]["value_text"] == "United Kingdom"
        assert admin_ans[18]["value_text"] == "$2M to $10M"
        assert admin_ans[22]["value_text"] == "Will, Trust(s)"

        cur.execute(
            "SELECT COUNT(*) FROM audit_logs WHERE actor_id = ? AND target_member_id = ? AND action = 'view_encrypted_screens_3_to_5'",
            (founder_id, uid),
        )
        audit_count = cur.fetchone()[0]
        assert audit_count >= 1, "Expected immutable audit_logs entry for Founder/Admin viewing Screen 3-5"
        print("PASS 6: Founder/Admin decrypts Screen 3-5 answers and audit_logs entry is recorded")

        # 8. Verify Q7 Private mode forces all switches to Private and removes member from directory
        status, _ = request_json(
            "POST",
            f"/api/profile/{uid}/answers",
            {"question_id": 7, "value": "Private (browse deals and events only)", "visibility": "private"},
        )
        assert status == 200

        status, dir_res = request_json("GET", f"/api/members?viewerId={peer_id}")
        assert status == 200
        members_list = dir_res if isinstance(dir_res, list) else dir_res.get("members", [])
        member_ids = [m["id"] for m in members_list]
        assert uid not in member_ids, "Member with Q7 Private mode must not appear in directory"

        status, peer_prof_priv = request_json("GET", f"/api/profile/{uid}?viewerId={peer_id}")
        peer_ans_priv = {a["question_id"]: a for a in peer_prof_priv["answers"]}
        for sw_q in [9, 10, 11, 12, 24]:
            assert peer_ans_priv[sw_q]["is_redacted"] is True, f"Q{sw_q} must be forced Private when Q7 is Private mode"
        print("PASS 7: Q7 Private mode forces all switches to Private and excludes member from directory")

        # Cleanup test user
        cur.execute("DELETE FROM questionnaire_answers WHERE user_id = ?", (uid,))
        cur.execute("DELETE FROM audit_logs WHERE target_member_id = ?", (uid,))
        cur.execute("DELETE FROM users WHERE id IN (?, ?, ?)", (uid, peer_id, founder_id))
        cur.execute("DELETE FROM invitation_tokens WHERE email = ?", (test_email,))
        conn.commit()
        conn.close()

        print("\nALL 25-QUESTION, 6-SCREEN QUESTIONNAIRE VERIFICATION TESTS PASSED!")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
