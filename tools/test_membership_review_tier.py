#!/usr/bin/env python3
"""
Test Suite: ÖZARA Membership Request Review Flow & Subscription Tiers
Validates:
1. elena.alexeeva@hotmail.com cleaned from DB
2. Access request submission & subject line format
3. Secure Admin Review Page HTML: 2 mutually exclusive radio buttons, neither selected by default
4. Decision API:
   - Approve requires membership_tier ('paid' or 'complimentary')
   - Decline does not require membership_tier
5. Onboarding / Registration:
   - Paid members receive subscription_status = 'pending_payment'
   - Complimentary members receive subscription_status = 'active'
   - Activation API marks subscription as active
6. Admin-only visibility & tier toggling:
   - Anonymous/other members cannot see tier on profiles
   - Admins can view and toggle tier
"""

import sys
import json
import sqlite3
import urllib.request
import urllib.error
import time

BASE_URL = "http://localhost:3000"

def log_test(name, passed, detail=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"[{status}] {name}")
    if detail:
        print(f"       {detail}")
    if not passed:
        sys.exit(1)

def http_req(path, data=None, headers=None, method=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return resp.status, json.loads(raw.decode("utf-8"))
            return resp.status, raw.decode("utf-8")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw.decode("utf-8"))
        except:
            return e.code, raw.decode("utf-8")

def run():
    print("=== ÖZARA Membership Review & Subscription Tier Test Suite ===")

    # 1. Verify elena.alexeeva@hotmail.com is cleaned from DB
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users WHERE LOWER(email) = 'elena.alexeeva@hotmail.com'")
    u_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM invitation_tokens WHERE LOWER(email) = 'elena.alexeeva@hotmail.com'")
    r_count = c.fetchone()[0]
    conn.close()
    log_test(
        "DB Cleanup: elena.alexeeva@hotmail.com removed from DB",
        u_count == 0 and r_count == 0,
        f"Users: {u_count}, Tokens/Requests: {r_count}"
    )

    # 2. Submit access request and verify request creation
    test_email_paid = f"test.applicant.paid.{int(time.time())}@circle.io"
    applicant_name = "Elena Alexeeva"
    code, resp = http_req("/api/invitations/request-access", {
        "fullName": applicant_name,
        "email": test_email_paid,
        "linkedin_or_background": "https://linkedin.com/in/elena-alexeeva",
        "notes": "Requesting access for private test"
    }, headers={"x-test-suite": "true"})
    log_test("Submit Access Request", code == 200 and resp.get("success") is True, f"Code: {code}")

    # Inspect DB to get request ID from invitation_tokens
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT id, full_name, email, status FROM invitation_tokens WHERE email = ?", (test_email_paid,))
    row = c.fetchone()
    conn.close()
    req_id = row[0]
    log_test("Access Request Record Created", bool(row and row[3] == "pending_admin_approval"), f"ID: {req_id}")

    # 3. Test Secure Admin Review Page GET
    # Fetch review page with admin email
    code_page, html_page = http_req(f"/api/admin/invitations/review?requestId={req_id}&adminEmail=ermolov.elena@gmail.com")
    log_test("Review Page loads with 200 OK", code_page == 200, f"Status: {code_page}")

    # Verify 2 mutually exclusive radio buttons and neither checked by default
    paid_input = '<input type="radio" name="membership_tier" value="paid"'
    comp_input = '<input type="radio" name="membership_tier" value="complimentary"'
    has_paid_radio = paid_input in html_page
    has_comp_radio = comp_input in html_page
    neither_checked = (paid_input + " checked") not in html_page and (comp_input + " checked") not in html_page
    log_test(
        "Review Page has 2 radio buttons, neither selected by default",
        has_paid_radio and has_comp_radio and neither_checked,
        "Paid & Complimentary radio buttons present, neither checked"
    )

    # 4. Test Review Decision API
    # 4a. Approve without tier -> must fail 400
    code_err, res_err = http_req("/api/admin/invitations/review/decision", {
        "requestId": req_id,
        "adminEmail": "ermolov.elena@gmail.com",
        "action": "approve"
        # membership_tier missing
    })
    log_test(
        "Approve without tier selection is rejected (400)",
        code_err == 400 and "either paid membership or complimentary membership" in str(res_err).lower(),
        f"Response: {res_err}"
    )

    # 4b. Approve with tier = 'paid' -> must succeed 200
    code_app, res_app = http_req("/api/admin/invitations/review/decision", {
        "requestId": req_id,
        "adminEmail": "ermolov.elena@gmail.com",
        "action": "approve",
        "membership_tier": "paid"
    })
    log_test(
        "Approve with Paid tier succeeds (200)",
        code_app == 200 and res_app.get("success") is True,
        f"Token: {res_app.get('token')}, Tier: {res_app.get('membership_tier')}"
    )
    paid_token = res_app.get("token")

    # Verify in DB that invitation_tokens has membership_tier = 'paid'
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT membership_tier, email FROM invitation_tokens WHERE token = ?", (paid_token,))
    tok_row = c.fetchone()
    conn.close()
    log_test(
        "Token saved in DB with membership_tier = 'paid'",
        tok_row and tok_row[0] == "paid",
        f"DB tier: {tok_row[0] if tok_row else None}"
    )

    # 5. Test Registering Paid Member
    user_id_paid = f"usr_test_paid_{int(time.time())}"
    code_reg, res_reg = http_req("/api/register", {
        "id": user_id_paid,
        "token": paid_token,
        "full_name": applicant_name,
        "email": test_email_paid,
        "headline": "Managing Director at Global Capital",
        "chapter_id": "ch_dubai",
        "city": "Dubai",
        "country": "United Arab Emirates",
        "contact_preference": "email"
    })
    user_id_paid = res_reg.get("userId") or (res_reg.get("user") or {}).get("id")
    log_test(
        "Paid Member registration succeeds",
        code_reg in (200, 201) and user_id_paid is not None,
        f"User ID: {user_id_paid}"
    )

    # Verify subscription status is pending_payment in DB
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT membership_tier, subscription_status FROM users WHERE id = ?", (user_id_paid,))
    u_paid_row = c.fetchone()
    conn.close()
    log_test(
        "Paid member account has membership_tier='paid' and subscription_status='pending_payment'",
        u_paid_row and u_paid_row[0] == "paid" and u_paid_row[1] == "pending_payment",
        f"DB Tier: {u_paid_row[0] if u_paid_row else None}, Sub Status: {u_paid_row[1] if u_paid_row else None}"
    )

    # 6. Test Activate Subscription API
    code_act, res_act = http_req("/api/membership/activate-subscription", {
        "userId": user_id_paid
    })
    log_test(
        "Paid Member activates subscription dues",
        code_act == 200 and res_act.get("success") is True,
        f"New Sub Status: {res_act.get('subscription_status')}"
    )

    # Verify subscription status is now active in DB
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT subscription_status FROM users WHERE id = ?", (user_id_paid,))
    u_act_row = c.fetchone()
    conn.close()
    log_test(
        "Paid member account subscription_status updated to 'active'",
        u_act_row and u_act_row[0] == "active",
        f"DB Sub Status: {u_act_row[0] if u_act_row else None}"
    )

    # 7. Test Complimentary Flow
    test_email_comp = f"test.applicant.comp.{int(time.time())}@circle.io"
    http_req("/api/invitations/request-access", {
        "fullName": "Complimentary VIP Member",
        "email": test_email_comp,
        "notes": "Free access granted by founder"
    }, headers={"x-test-suite": "true"})
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT id FROM invitation_tokens WHERE email = ?", (test_email_comp,))
    req_comp_id = c.fetchone()[0]
    conn.close()

    # Approve with complimentary
    code_comp, res_comp = http_req("/api/admin/invitations/review/decision", {
        "requestId": req_comp_id,
        "adminEmail": "ermolov.elena@gmail.com",
        "action": "approve",
        "membership_tier": "complimentary"
    })
    comp_token = res_comp.get("token")
    log_test(
        "Approve with Complimentary tier succeeds",
        code_comp == 200 and res_comp.get("membership_tier") == "complimentary",
        f"Token: {comp_token}"
    )

    # Register Complimentary Member
    code_reg_comp, res_reg_comp = http_req("/api/register", {
        "token": comp_token,
        "full_name": "Complimentary VIP Member",
        "email": test_email_comp,
        "headline": "Partner at Tech Ventures",
        "chapter_id": "ch_dubai",
        "city": "Dubai",
        "country": "United Arab Emirates",
        "contact_preference": "email"
    })
    user_id_comp = res_reg_comp.get("userId") or (res_reg_comp.get("user") or {}).get("id")
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT membership_tier, subscription_status FROM users WHERE id = ?", (user_id_comp,))
    u_comp_row = c.fetchone()
    conn.close()
    log_test(
        "Complimentary member account has membership_tier='complimentary' and subscription_status='active' directly",
        u_comp_row and u_comp_row[0] == "complimentary" and u_comp_row[1] == "active",
        f"DB Tier: {u_comp_row[0] if u_comp_row else None}, Sub Status: {u_comp_row[1] if u_comp_row else None}"
    )

    # 8. Test Decline Action (does NOT require tier)
    test_email_dec = f"test.applicant.dec.{int(time.time())}@circle.io"
    http_req("/api/invitations/request-access", {
        "fullName": "Candidate To Decline",
        "email": test_email_dec,
    }, headers={"x-test-suite": "true"})
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT id FROM invitation_tokens WHERE email = ?", (test_email_dec,))
    req_dec_id = c.fetchone()[0]
    conn.close()

    code_dec, res_dec = http_req("/api/admin/invitations/review/decision", {
        "requestId": req_dec_id,
        "adminEmail": "ermolov.elena@gmail.com",
        "action": "decline"
        # No membership_tier needed
    })
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT status FROM invitation_tokens WHERE id = ?", (req_dec_id,))
    req_dec_status = c.fetchone()[0]
    conn.close()
    log_test(
        "Decline request succeeds without selecting membership tier",
        code_dec == 200 and req_dec_status == "declined",
        f"Status: {req_dec_status}"
    )

    # 9. Test Visibility Isolation (Tier visible to admin or self only)
    # Anonymous viewer
    _, anon_prof = http_req(f"/api/profile/{user_id_paid}?viewerId=someone_else")
    log_test(
        "Non-admin cannot see membership_tier or subscription_status",
        "membership_tier" not in anon_prof and "subscription_status" not in anon_prof,
        f"Anon profile keys: {list(anon_prof.keys())[:6]}..."
    )

    # Self viewer
    _, self_prof = http_req(f"/api/profile/{user_id_paid}?viewerId={user_id_paid}")
    log_test(
        "Member can see their own membership_tier and subscription_status",
        self_prof.get("membership_tier") == "paid" and self_prof.get("subscription_status") == "active",
        f"Self Tier: {self_prof.get('membership_tier')}, Status: {self_prof.get('subscription_status')}"
    )

    # Admin viewer
    _, admin_prof = http_req(f"/api/profile/{user_id_paid}?viewerId=usr_alexandra")
    log_test(
        "Admin can see member's membership_tier and subscription_status",
        admin_prof.get("membership_tier") == "paid" and admin_prof.get("subscription_status") == "active",
        f"Admin View Tier: {admin_prof.get('membership_tier')}"
    )

    # 10. Admin Toggles Tier via PATCH /api/admin/members/:id/membership-tier
    code_patch, res_patch = http_req(f"/api/admin/members/{user_id_paid}/membership-tier", {
        "membership_tier": "complimentary"
    }, headers={"x-user-id": "usr_alexandra"}, method="PATCH")
    member_data = res_patch.get("member") if isinstance(res_patch, dict) else {}
    log_test(
        "Admin can update member's membership_tier to complimentary",
        code_patch == 200 and member_data.get("membership_tier") == "complimentary",
        f"Patched tier: {member_data.get('membership_tier')}"
    )

    # Non-admin cannot toggle tier
    code_patch_fail, _ = http_req(f"/api/admin/members/{user_id_paid}/membership-tier", {
        "membership_tier": "paid"
    }, headers={"x-user-id": "someone_else"}, method="PATCH")
    log_test(
        "Non-admin blocked from toggling membership_tier (403)",
        code_patch_fail == 403,
        f"Status: {code_patch_fail}"
    )

    print("\n=======================================================")
    print("ALL 10 TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    run()
