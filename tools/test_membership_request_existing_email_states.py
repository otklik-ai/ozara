"""
Verification Suite: Membership Request Existing-Email States & Duplicate Prevention
Validates:
1. Pending request state ('Our hosts will be in touch by email.')
2. Existing account state ('Sign in to your ÖZARA account.') with active account priority
3. Declined request state ('We’re unable to offer an invitation at this time.')
4. Case-insensitive and whitespace-trimmed email normalization
5. New email path continues normal request creation
6. Backend duplicate prevention on POST /api/invitations/request-access
"""

import sys
import os
import json
import sqlite3
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"
DB_PATH = "ozara.db" if os.path.exists("ozara.db") else "sila.db"

def request_json(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
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

def run_suite():
    print("=" * 60)
    print("ÖZARA MEMBERSHIP REQUEST: EXISTING-EMAIL STATES TEST SUITE")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Setup test personas
    active_email = "marcus.vance@example.com"
    pending_email = "test.pending.applicant@circle.io"
    declined_email = "test.declined.applicant@circle.io"
    priority_email = "test.priority.overlap@circle.io"
    new_email = "test.brand.new.user@circle.io"

    # 1. Clean previous test runs
    for em in [pending_email, declined_email, priority_email, new_email]:
        c.execute("DELETE FROM invitation_tokens WHERE LOWER(email) = LOWER(?)", (em,))
        c.execute("DELETE FROM users WHERE LOWER(email) = LOWER(?)", (em,))
    conn.commit()

    # Insert Pending Invite
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES ('tok_pending_test', ?, 'PENDING-999', 'Pending Applicant', 'pending_admin_approval', 0, '2030-01-01', 'self_applicant', datetime('now'))
    """, (pending_email,))

    # Insert Declined Invite
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES ('tok_declined_test', ?, 'DECLINED-999', 'Declined Applicant', 'declined', 0, '2030-01-01', 'admin', datetime('now'))
    """, (declined_email,))

    # Insert Priority Overlap: User is active in users, but also has an older pending/declined invite
    c.execute("""
        INSERT INTO users (id, email, full_name, headline, city, country, contact_preference, role, is_admitted, is_complete)
        VALUES ('usr_priority_test', ?, 'Priority Member', 'Active Member', 'Dubai', 'UAE', 'direct_contact', 'MEMBER', 1, 1)
    """, (priority_email,))
    c.execute("""
        INSERT INTO invitation_tokens (id, email, token, full_name, status, is_claimed, expires_at, created_by, created_at)
        VALUES ('tok_overlap_test', ?, 'OLD-TOKEN', 'Priority Member', 'declined', 0, '2030-01-01', 'admin', datetime('now', '-30 days'))
    """, (priority_email,))

    conn.commit()
    conn.close()

    # -------------------------------------------------------------
    # State 1: Pending Request Check
    # -------------------------------------------------------------
    print("\n--- 1. Pending Request State ---")
    status, res = request_json("/api/invitations/check-email-status", "POST", {"email": f"  {pending_email.upper()}  "})
    print(f"Status: {status}, Response: {res}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("status") == "pending_request", f"Expected pending_request, got {res.get('status')}"
    assert res.get("message") == "Our hosts will be in touch by email."
    print("   [PASS] Pending request correctly identified with hosts message.")

    # Backend duplicate prevention on request-access for pending email
    status, res = request_json("/api/invitations/request-access", "POST", {
        "fullName": "Pending Applicant",
        "email": pending_email,
        "linkedin_or_background": "Tech"
    })
    print(f"Duplicate Submit Status: {status}, Response: {res}")
    assert status == 409, f"Expected 409 for duplicate request, got {status}"
    assert res.get("status") == "pending_request"
    print("   [PASS] Backend strictly blocked duplicate request submission for pending email.")

    # -------------------------------------------------------------
    # State 2: Existing Account Check & Priority
    # -------------------------------------------------------------
    print("\n--- 2. Existing Account State & Priority ---")
    status, res = request_json("/api/invitations/check-email-status", "POST", {"email": f"  {active_email}  "})
    print(f"Active User Status: {status}, Response: {res}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("status") == "existing_account", f"Expected existing_account, got {res.get('status')}"
    assert res.get("message") == "Sign in to your ÖZARA account."
    print("   [PASS] Active account correctly identified with Sign in message.")

    # Verify active account priority over older request
    status, res = request_json("/api/invitations/check-email-status", "POST", {"email": priority_email})
    print(f"Priority Overlap Status: {status}, Response: {res}")
    assert status == 200
    assert res.get("status") == "existing_account", "Active member must take priority over older declined request"
    print("   [PASS] Active account priority over older request strictly enforced.")

    # Backend duplicate prevention on request-access for existing account
    status, res = request_json("/api/invitations/request-access", "POST", {
        "fullName": "Active User",
        "email": active_email,
        "linkedin_or_background": "Tech"
    })
    print(f"Existing Account Submit Status: {status}, Response: {res}")
    assert status == 409
    assert res.get("status") == "existing_account"
    print("   [PASS] Backend strictly blocked new request for active account.")

    # -------------------------------------------------------------
    # State 3: Declined Request Check
    # -------------------------------------------------------------
    print("\n--- 3. Declined Request State ---")
    status, res = request_json("/api/invitations/check-email-status", "POST", {"email": f"  {declined_email.upper()}  "})
    print(f"Declined Status: {status}, Response: {res}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("status") == "declined_request", f"Expected declined_request, got {res.get('status')}"
    assert res.get("message") == "We’re unable to offer an invitation at this time."
    print("   [PASS] Declined request correctly identified.")

    # Backend duplicate prevention on request-access for declined email
    status, res = request_json("/api/invitations/request-access", "POST", {
        "fullName": "Declined Applicant",
        "email": declined_email,
        "linkedin_or_background": "Tech"
    })
    print(f"Declined Submit Status: {status}, Response: {res}")
    assert status == 409
    assert res.get("status") == "declined_request"
    assert res.get("message") == "We’re unable to offer an invitation at this time."

    # Verify status in database remains 'declined' and was not overwritten
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status FROM invitation_tokens WHERE LOWER(email) = LOWER(?)", (declined_email,))
    row = c.fetchone()
    conn.close()
    assert row[0] == "declined", f"Expected status 'declined', got {row[0]}"
    print("   [PASS] Backend strictly preserved declined status without alteration.")

    # -------------------------------------------------------------
    # State 4: New Email Path
    # -------------------------------------------------------------
    print("\n--- 4. New Email Path ---")
    status, res = request_json("/api/invitations/check-email-status", "POST", {"email": new_email})
    print(f"New Email Check Status: {status}, Response: {res}")
    assert status == 200
    assert res.get("status") == "new"
    print("   [PASS] New email correctly identified as 'new'.")

    # Submit new request
    status, res = request_json("/api/invitations/request-access", "POST", {
        "fullName": "Brand New Applicant",
        "email": new_email,
        "linkedin_or_background": "https://linkedin.com/in/brandnew"
    })
    print(f"New Request Submit Status: {status}, Response: {res}")
    assert status == 200 or status == 201
    assert res.get("success") is True
    print("   [PASS] New email successfully created membership request.")

    # Cleaning test records
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    for em in [pending_email, declined_email, priority_email, new_email]:
        c.execute("DELETE FROM invitation_tokens WHERE LOWER(email) = LOWER(?)", (em,))
        c.execute("DELETE FROM users WHERE LOWER(email) = LOWER(?)", (em,))
    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print("ALL EXISTING-EMAIL STATES AND SECURITY CHECKS PASSED (100%)")
    print("=" * 60)

if __name__ == "__main__":
    run_suite()
