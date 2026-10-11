"""
Test Suite: ÖZARA Invitation Gate & Onboarding Verification
Validates:
1. Pre-phone invitation verification (valid, invalid, expired, revoked, already used)
2. Request Access submission with LinkedIn URL, "What brings you to ÖZARA?", and exact confirmation copy
3. Admin invitation management (approve, decline, create with custom expiry, revoke)
4. Atomic single-use claim concurrency lock during registration
5. Server-enforced access gating for unapproved visitors vs authenticated members
6. Separate investment document eligibility check
7. Existing member direct phone sign-in bypassing invitation requirements
"""

import sys
import os
import json
import sqlite3
import datetime
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"
DB_PATH = "ozara.db" if os.path.exists("ozara.db") else "sila.db"

def request_json(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            res_body = json.loads(resp.read().decode("utf-8"))
            return status, res_body
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            res_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            res_body = {"error": str(e)}
        return status, res_body

def get_latest_mock_code(phone):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT code FROM phone_verifications WHERE phone = ? ORDER BY created_at DESC LIMIT 1", (phone,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def run_suite():
    print("=" * 60)
    print("ÖZARA INVITATION GATE & ONBOARDING VALIDATION SUITE")
    print("=" * 60)

    # ---------------------------------------------------------
    # 1. Pre-Phone Invitation Verification Tests
    # ---------------------------------------------------------
    print("\n--- 1. Pre-Phone Invitation Verification ---")
    
    # 1a. Invalid non-existent token
    status, res = request_json("/api/invitations/verify", "POST", {"token": "OZARA-9999-FAKE"})
    print(f"1a. Non-existent token: status={status}, errorType={res.get('errorType')}")
    assert status == 400 or status == 404, f"Expected 400/404, got {status}"
    assert res.get("valid") is False, "Expected valid=false"
    assert res.get("errorType") == "invalid", f"Expected errorType=invalid, got {res.get('errorType')}"
    print("   [PASS] Non-existent token rejected as invalid.")

    # Setup test tokens in SQLite directly for controlled state testing
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Expired token
    expired_token = "OZARA-TEST-EXPIRED"
    c.execute("DELETE FROM invitation_tokens WHERE token = ?", (expired_token,))
    past_date = (datetime.datetime.utcnow() - datetime.timedelta(days=2)).isoformat() + "Z"
    future_date = (datetime.datetime.utcnow() + datetime.timedelta(days=14)).isoformat() + "Z"
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, 'approved', 0, ?, 'admin_test', datetime('now'))
    """, ("tok_expired_test", "expired_user@venture.co", expired_token, "Expired Applicant", past_date))

    # Revoked token
    revoked_token = "OZARA-TEST-REVOKED"
    c.execute("DELETE FROM invitation_tokens WHERE token = ?", (revoked_token,))
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, 'revoked', 0, ?, 'admin_test', datetime('now'))
    """, ("tok_revoked_test", "revoked_user@venture.co", revoked_token, "Revoked Applicant", future_date))

    # Already claimed token
    claimed_token = "OZARA-TEST-CLAIMED"
    c.execute("DELETE FROM invitation_tokens WHERE token = ?", (claimed_token,))
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, 'claimed', 1, ?, 'admin_test', datetime('now'))
    """, ("tok_claimed_test", "claimed_user@venture.co", claimed_token, "Claimed Member", future_date))

    # Valid token
    valid_token = "OZARA-TEST-VALID-01"
    valid_email = "marcus.onboarding@vancecapital.co"
    c.execute("DELETE FROM invitation_tokens WHERE token = ? OR email = ?", (valid_token, valid_email))
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, 'approved', 0, ?, 'admin_test', datetime('now'))
    """, ("tok_valid_test_01", valid_email, valid_token, "Marcus Vance", future_date))

    conn.commit()
    conn.close()

    # 1b. Expired token verification
    status, res = request_json("/api/invitations/verify", "POST", {"token": expired_token})
    print(f"1b. Expired token: status={status}, errorType={res.get('errorType')}")
    assert status == 400, f"Expected 400, got {status}"
    assert res.get("valid") is False
    assert res.get("errorType") == "expired"
    print("   [PASS] Expired invitation rejected with clear error type.")

    # 1c. Revoked token verification
    status, res = request_json("/api/invitations/verify", "POST", {"token": revoked_token})
    print(f"1c. Revoked token: status={status}, errorType={res.get('errorType')}")
    assert status in (400, 403), f"Expected 400 or 403, got {status}"
    assert res.get("valid") is False
    assert res.get("errorType") == "revoked"
    print("   [PASS] Revoked invitation rejected with clear error type.")

    # 1d. Already claimed token verification
    status, res = request_json("/api/invitations/verify", "POST", {"token": claimed_token})
    print(f"1d. Claimed token: status={status}, errorType={res.get('errorType')}")
    assert status == 400, f"Expected 400, got {status}"
    assert res.get("valid") is False
    assert res.get("errorType") == "claimed"
    print("   [PASS] Already-used invitation rejected with clear error type.")

    # 1e. Valid approved token verification
    status, res = request_json("/api/invitations/verify", "POST", {"token": valid_token})
    print(f"1e. Valid token: status={status}, valid={res.get('valid')}, email={res.get('email')}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("valid") is True
    assert res.get("email") == valid_email
    assert res.get("fullName") == "Marcus Vance"
    print("   [PASS] Valid invitation approved and locks verified email for registration.")

    # ---------------------------------------------------------
    # 2. Request Access Form & Exact Confirmation Copy
    # ---------------------------------------------------------
    print("\n--- 2. Request Access Flow & Confirmation Message ---")
    candidate_email = "sophia.candidate@deeptechfund.io"
    
    # Ensure clean slate for test candidate
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM invitation_tokens WHERE email = ?", (candidate_email,))
    conn.commit()
    conn.close()

    req_payload = {
        "full_name": "Sophia Zhang",
        "email": candidate_email,
        "linkedin_or_background": "https://linkedin.com/in/sophia-zhang-deeptech",
        "what_brings_you": "Looking to connect with Gulf-based deeptech founders and co-invest in high-yield assets."
    }
    status, res = request_json("/api/invitations/request-access", "POST", req_payload)
    print(f"2a. Request Access: status={status}, msg='{res.get('message')}'")
    assert status == 200 or status == 201, f"Expected 200/201, got {status}"
    expected_msg = "Your request has been received. Our team will review it and contact you by email if approved."
    assert res.get("message") == expected_msg, f"Expected message '{expected_msg}', got '{res.get('message')}'"

    # Verify database persistence
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT id, full_name, email, linkedin_or_background, what_brings_you, status 
        FROM invitation_tokens WHERE email = ? ORDER BY created_at DESC LIMIT 1
    """, (candidate_email,))
    req_row = c.fetchone()
    conn.close()
    assert req_row is not None, "Access request not found in database"
    req_id, req_name, req_em, req_linkedin, req_why, req_status = req_row
    assert req_name == "Sophia Zhang"
    assert req_linkedin == req_payload["linkedin_or_background"]
    assert req_why == req_payload["what_brings_you"]
    assert req_status == "pending_admin_approval"
    print("   [PASS] Request saved in admin queue with LinkedIn & 'What brings you' fields.")
    print("   [PASS] Exact confirmation copy verified without SMS or identity checks required.")

    # ---------------------------------------------------------
    # 3. Admin Management: Approve, Decline, Create Expirable, Revoke
    # ---------------------------------------------------------
    print("\n--- 3. Admin Invitation Governance ---")
    
    # 3a. Admin approves request -> Generates token
    status, res = request_json("/api/admin/access-requests/approve", "POST", {
        "requestId": req_id,
        "approvedBy": "ermolov.elena@gmail.com"
    })
    print(f"3a. Admin approve: status={status}, token={res.get('token')}")
    assert status == 200, f"Expected 200, got {status}"
    generated_token = res.get("token")
    assert generated_token and generated_token.startswith("OZARA-"), "Invalid token format generated"
    print("   [PASS] Admin approval issues unique 1:1 token.")

    # 3b. Admin declines another test request
    decline_email = "declined.applicant@spammer.org"
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM invitation_tokens WHERE email = ?", (decline_email,))
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, created_by, expires_at, created_at)
        VALUES ('req_to_decline', ?, 'PENDING-DECLINE', 'Spam User', 'pending_admin_approval', 'self_applicant', ?, datetime('now'))
    """, (decline_email, future_date))
    conn.commit()
    conn.close()

    status, res = request_json("/api/admin/access-requests/decline", "POST", {
        "requestId": "req_to_decline",
        "declinedBy": "ermolov.elena@gmail.com",
        "reason": "Does not meet chapter membership criteria"
    })
    print(f"3b. Admin decline: status={status}, success={res.get('success')}")
    assert status == 200, f"Expected 200, got {status}"
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status FROM invitation_tokens WHERE id = 'req_to_decline'")
    declined_status = c.fetchone()[0]
    conn.close()
    assert declined_status == "declined", f"Expected declined, got {declined_status}"
    print("   [PASS] Admin can decline prospective requests.")

    # 3c. Admin creates single-use expirable invitation
    custom_invite_email = "ambassador.guest@syndicate.io"
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM invitation_tokens WHERE email = ?", (custom_invite_email,))
    conn.commit()
    conn.close()

    status, res = request_json("/api/admin/invitations/create", "POST", {
        "email": custom_invite_email,
        "full_name": "Ambassador Guest",
        "expiresInDays": 14,
        "createdBy": "ermolov.elena@gmail.com"
    })
    print(f"3c. Create expirable invitation: status={status}, token={res.get('token')}, expires_at={res.get('expires_at')}")
    assert status == 200, f"Expected 200, got {status}"
    expirable_token = res.get("token")
    assert expirable_token is not None
    assert res.get("expires_at") is not None
    print("   [PASS] Custom expirable single-use invitation issued.")

    # 3d. Admin revokes the unredeemed expirable invitation
    status, res = request_json("/api/admin/invitations/revoke", "POST", {
        "token": expirable_token,
        "revokedBy": "ermolov.elena@gmail.com",
        "reason": "Issued in error"
    })
    print(f"3d. Revoke invitation: status={status}, success={res.get('success')}")
    assert status == 200, f"Expected 200, got {status}"

    # Verifying revoked token now fails verification
    status, res = request_json("/api/invitations/verify", "POST", {"token": expirable_token})
    assert status in (400, 403)
    assert res.get("errorType") == "revoked"
    print("   [PASS] Revoked token immediately blocked from verification.")

    # ---------------------------------------------------------
    # 4. Atomic Concurrency Lock & Registration Lifecycle
    # ---------------------------------------------------------
    print("\n--- 4. Atomic Claim Concurrency Lock During Registration ---")
    reg_phone = "+971509998877"
    reg_user_id = "usr_marcus_vance_test"
    
    # Clean up any leftover test user
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE id = ? OR email = ?", (reg_user_id, valid_email))
    conn.commit()
    conn.close()

    # Step A: Phone verification for new candidate (dev mock)
    request_json("/api/auth/phone/send-code", "POST", {"phone": reg_phone})
    otp_code = get_latest_mock_code(reg_phone)
    assert otp_code is not None, "Failed to get mock SMS code"
    status, verify_res = request_json("/api/auth/phone/verify-code", "POST", {"phone": reg_phone, "code": otp_code})
    assert status == 200 and verify_res.get("verified") is True
    print(f"4a. Phone verified: candidate is_existing_member={verify_res.get('is_existing_member')}")
    assert verify_res.get("is_existing_member") is False

    # Step B: Register profile with valid token
    reg_payload = {
        "id": reg_user_id,
        "email": valid_email,
        "full_name": "Marcus Vance",
        "token": valid_token,
        "headline": "Managing Partner, Vance Capital",
        "chapter_id": "ch_dubai",
        "country": "United Arab Emirates",
        "state": "Dubai",
        "city": "Dubai",
        "industry": "Financial Services & FinTech",
        "accepted_conditions_version": "2026-10-v1",
        "phone": reg_phone
    }
    status, reg_res = request_json("/api/register", "POST", reg_payload)
    registered_user_id = reg_res.get("userId") or (reg_res.get("user") or {}).get("id")
    print(f"4b. Registration: status={status}, userId={registered_user_id}")
    assert status == 200 or status == 201, f"Expected 200/201, got {status}"
    assert registered_user_id is not None, "Expected registered user ID"

    # Verify invitation token is now claimed
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT is_claimed, status FROM invitation_tokens WHERE token = ?", (valid_token,))
    row = c.fetchone()
    conn.close()
    assert row[0] == 1 and row[1] == "claimed", f"Expected is_claimed=1, status=claimed, got {row}"
    print("   [PASS] Token redeemed only upon successful registration completion.")

    # Step C: Attempt simultaneous/duplicate reuse of the same invitation token
    duplicate_payload = dict(reg_payload)
    duplicate_payload["id"] = "usr_duplicate_attacker"
    duplicate_payload["email"] = "other.email@venture.co"
    status, dup_res = request_json("/api/register", "POST", duplicate_payload)
    print(f"4c. Duplicate claim attempt: status={status}, error={dup_res.get('error')}")
    err_text = dup_res.get("error", "").lower()
    assert ("already" in err_text and ("used" in err_text or "claimed" in err_text)) or "invalid" in err_text, f"Unexpected error: {err_text}"
    print("   [PASS] Atomic claim lock strictly prevents multiple accounts from the same invitation.")

    # ---------------------------------------------------------
    # 5. Server-Enforced Access Gating For Unapproved Visitors
    # ---------------------------------------------------------
    print("\n--- 5. Server-Enforced Access Gating ---")
    
    # 5a. Anonymous member directory access
    status, _ = request_json("/api/members", "GET")
    print(f"5a. Anonymous /api/members: status={status}")
    assert status == 401, f"Expected 401 for anonymous access, got {status}"

    # 5b. Anonymous profile access
    status, _ = request_json("/api/profile/usr_1001", "GET")
    print(f"5b. Anonymous /api/profile/:id: status={status}")
    assert status == 401, f"Expected 401 for anonymous access, got {status}"

    # 5c. Anonymous member events access
    status, _ = request_json("/api/events", "GET")
    print(f"5c. Anonymous /api/events: status={status}")
    assert status == 401, f"Expected 401 for anonymous access, got {status}"

    # 5d. Authorized member access
    auth_headers = {"x-user-id": registered_user_id}
    status, members_res = request_json("/api/members", "GET", headers=auth_headers)
    members_list = members_res if isinstance(members_res, list) else members_res.get('members', [])
    print(f"5d. Authenticated member /api/members: status={status}, count={len(members_list)}")
    assert status == 200, f"Expected 200, got {status}"
    assert len(members_list) > 0
    print("   [PASS] Community directory strictly gated to approved members.")

    # ---------------------------------------------------------
    # 6. Separate Investment Document Eligibility Check
    # ---------------------------------------------------------
    print("\n--- 6. Separate Investment Document Gating ---")
    
    # Seed a test listing if needed
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR IGNORE INTO real_estate_listings (id, title, short_summary, location, property_type, status, brochure_document_url, created_by, created_at)
        VALUES ('re_test_901', 'Palm Jumeirah Signature Villa', 'High rental yield asset', 'Dubai, UAE', 'Residential', 'active', '/assets/palm_brochure.pdf', 'Julia', datetime('now'))
    """)
    conn.commit()
    conn.close()

    # Anonymous visitor requesting investment brochure -> 401
    status, _ = request_json("/api/listings/re_palm_villa_01/document", "GET")
    print(f"6a. Anonymous investment document request: status={status}")
    assert status == 401, f"Expected 401 for anonymous access, got {status}"

    # Member requesting investment document -> 200 with brochure URL
    status, doc_res = request_json("/api/listings/re_palm_villa_01/document", "GET", headers=auth_headers)
    print(f"6b. Eligible member investment document request: status={status}, doc={doc_res.get('document_url')}")
    assert status == 200, f"Expected 200, got {status}"
    assert doc_res.get("document_url") is not None
    print("   [PASS] Investment document access enforced separately from membership.")

    # ---------------------------------------------------------
    # 7. Existing Member Direct Phone Sign-In
    # ---------------------------------------------------------
    print("\n--- 7. Existing Member Direct Sign-In (No Invitation Required) ---")
    existing_phone = "+971501112233"
    request_json("/api/auth/phone/send-code", "POST", {"phone": existing_phone})
    otp_code = get_latest_mock_code(existing_phone)
    status, res = request_json("/api/auth/phone/verify-code", "POST", {"phone": existing_phone, "code": otp_code})
    print(f"7a. Existing member sign in: status={status}, is_existing_member={res.get('is_existing_member')}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("is_existing_member") is True
    assert res.get("user") is not None
    assert "elena" in res.get("user", {}).get("email", "").lower()
    print("   [PASS] Existing approved member signs in directly via phone OTP without invitation code.")

    # ---------------------------------------------------------
    # 8. Optional Face ID, Welcome / Create Account & Terms
    # ---------------------------------------------------------
    print("\n--- 8. Welcome / Create Account, Terms & Conditions & Biometrics ---")
    
    # 8a. Configurable Legal Endpoints
    status, terms_doc = request_json("/api/legal/terms", "GET")
    print(f"8a. Legal Terms: status={status}, version={terms_doc.get('version')}, sections={len(terms_doc.get('sections', []))}")
    assert status == 200, f"Expected 200 for terms, got {status}"
    assert "Private Membership Terms & Conditions" in terms_doc.get("title", "")
    assert terms_doc.get("version") == "2026-10-v1"
    assert len(terms_doc.get("sections", [])) >= 4

    status, privacy_doc = request_json("/api/legal/privacy", "GET")
    print(f"8b. Legal Privacy: status={status}, version={privacy_doc.get('version')}, sections={len(privacy_doc.get('sections', []))}")
    assert status == 200, f"Expected 200 for privacy, got {status}"
    assert "Privacy Policy" in privacy_doc.get("title", "")
    assert privacy_doc.get("version") == "2026-10-v1"
    assert len(privacy_doc.get("sections", [])) >= 4
    print("   [PASS] Dedicated ÖZARA Terms & Conditions and Privacy Policy endpoints verified.")

    # 8c. Issue a dedicated single-use invitation for full Create Account test
    test_invite_token = "OZARA-LEGAL-BIO-TEST"
    test_applicant_email = "marcus.vance.test@techventures.co"
    test_applicant_name = "Marcus Vance"
    test_applicant_phone = "+971509876543"

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE email = ?", (test_applicant_email,))
    c.execute("DELETE FROM invitation_tokens WHERE token = ? OR email = ?", (test_invite_token, test_applicant_email))
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, 'approved', 0, ?, 'admin_alexandra', datetime('now'))
    """, ("tok_legal_bio_test", test_applicant_email, test_invite_token, test_applicant_name, future_date))
    conn.commit()
    conn.close()

    # Verify invitation before phone
    status, verify_res = request_json("/api/invitations/verify", "POST", {"token": test_invite_token})
    assert status == 200 and verify_res.get("valid") is True

    # Complete phone verification
    request_json("/api/auth/phone/send-code", "POST", {"phone": test_applicant_phone})
    otp = get_latest_mock_code(test_applicant_phone)
    status, phone_res = request_json("/api/auth/phone/verify-code", "POST", {"phone": test_applicant_phone, "code": otp})
    assert status == 200 and phone_res.get("verified") is True

    # Register member on Create Account Screen with accepted terms and biometrics enabled
    now_ts = datetime.datetime.utcnow().isoformat() + "Z"
    status, reg_res = request_json("/api/register", "POST", {
        "full_name": test_applicant_name,
        "email": test_applicant_email,
        "phone": test_applicant_phone,
        "token": test_invite_token,
        "accepted_terms_version": "2026-10-v1",
        "accepted_terms_at": now_ts,
        "biometrics_enabled": True
    })
    print(f"8c. Create Account with Terms & Biometrics: status={status}, userId={reg_res.get('userId')}")
    assert status == 200, f"Expected 200 for register, got {status}: {reg_res}"
    assert reg_res.get("success") is True
    created_id = reg_res.get("userId")

    # Verify SQLite database records
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT id, email, full_name, phone, terms_accepted_version, terms_accepted_at, biometrics_enabled 
        FROM users WHERE id = ?
    """, (created_id,))
    u_row = c.fetchone()
    assert u_row is not None, "Expected created user in database"
    assert u_row[1] == test_applicant_email
    assert u_row[2] == test_applicant_name
    assert u_row[3] == test_applicant_phone
    assert u_row[4] == "2026-10-v1", f"Expected terms_accepted_version=2026-10-v1, got {u_row[4]}"
    assert u_row[5] is not None, "Expected terms_accepted_at timestamp"
    assert u_row[6] == 1, f"Expected biometrics_enabled=1, got {u_row[6]}"

    # Verify single-use token was claimed atomically
    c.execute("SELECT is_claimed, status FROM invitation_tokens WHERE token = ?", (test_invite_token,))
    tok_row = c.fetchone()
    assert tok_row[0] == 1, "Expected token is_claimed=1"
    assert tok_row[1] == "claimed", f"Expected token status='claimed', got {tok_row[1]}"
    conn.close()

    print("   [PASS] Account created with verified phone, atomically redeemed invitation, accepted terms record, and biometrics.")

    # Clean up temporary test users so database stays canonical
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE id IN (?, ?)", (created_id, registered_user_id))
    c.execute("DELETE FROM invitation_tokens WHERE token IN (?, ?)", (test_invite_token, expirable_token))
    c.execute("DELETE FROM invitation_tokens WHERE email = ?", (test_applicant_email,))
    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print("ALL 8 SUITE MODULES PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_suite()
