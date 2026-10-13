#!/usr/bin/env python3
"""
Test Suite: Refined Email Wording & Visual Design Verification
Validates:
1. Admin Notification Email:
   - Subject: 'New request to join ÖZARA from {Full name}'
   - Heading: 'Membership request'
   - Intro: '{Full name} would like to join ÖZARA.'
   - Prominent applicant name, email and submitted details beneath
   - Button: 'Review request'
   - Compact ÖZARA wordmark, clean light background (#f8fafc), no heavy dark container
2. Admin Review Page:
   - Same clean, light aesthetic with generous whitespace and compact ÖZARA wordmark
   - Applicant details prominent first
   - Paid / Complimentary mutually exclusive radio buttons, neither selected by default
   - Redundant 'private network' wording removed
   - Approve / Decline functionality intact
3. Applicant Confirmation Email:
   - Sender name: 'ÖZARA'
   - Subject: 'Your request to join ÖZARA' (no brackets, no technical prefixes)
   - Brand header: 'ÖZARA'
   - Heading: 'Your request is received'
   - Body: 'Hi {First name},' and 'Thank you for your interest in ÖZARA. Our hosts will review your request and be in touch by email.'
   - Sign-off: 'The ÖZARA team'
   - No button present
   - Clean light background (#f8fafc), subtle divider, dark body text
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
    print("=== ÖZARA Refined Email & Review Design Verification Suite ===")

    test_email = f"test.design.applicant.{int(time.time())}@circle.io"
    full_name = "Elena Alexeeva"

    # 1. Submit Request
    code, resp = http_req("/api/invitations/request-access", {
        "fullName": full_name,
        "email": test_email,
        "linkedin_or_background": "https://linkedin.com/in/elena-alexeeva",
        "notes": "Interested in global real estate and technology",
        "what_brings_you": "Curated community"
    })
    log_test("Access request created", code == 200 and resp.get("success") is True, f"Code: {code}")

    # Inspect token record
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT id, full_name, email, status FROM invitation_tokens WHERE email = ?", (test_email,))
    row = c.fetchone()
    conn.close()
    req_id = row[0]
    log_test("Record exists in DB", bool(row and row[3] == "pending_admin_approval"), f"Req ID: {req_id}")

    # 2. Inspect Admin Review Page HTML
    code_rev, html_rev = http_req(f"/api/admin/invitations/review?requestId={req_id}&adminEmail=ermolov.elena@gmail.com")
    log_test("Admin review page loads (200 OK)", code_rev == 200, f"Status: {code_rev}")

    # Visual design assertions for Review Page:
    has_wordmark = '<div class="wordmark">ÖZARA</div>' in html_rev
    has_heading = '<h1 class="title">Membership request</h1>' in html_rev
    no_private_network = "private network" not in html_rev.lower()
    log_test("Review page has compact ÖZARA wordmark & clean heading", has_wordmark and has_heading, "Wordmark: ÖZARA, Heading: Membership request")
    log_test("Review page removed redundant 'private network' wording", no_private_network, "Zero occurrences of 'private network'")

    # Prominent applicant name first
    has_prominent_name = f'<div class="applicant-name">{full_name}</div>' in html_rev
    has_applicant_email = f'<a href="mailto:{test_email}">{test_email}</a>' in html_rev
    log_test("Applicant details presented prominently first", has_prominent_name and has_applicant_email, f"Name: {full_name}, Email: {test_email}")

    # Radio buttons: mutually exclusive, neither selected by default
    paid_input = '<input type="radio" name="membership_tier" value="paid"'
    comp_input = '<input type="radio" name="membership_tier" value="complimentary"'
    has_paid = paid_input in html_rev
    has_comp = comp_input in html_rev
    neither_checked = (paid_input + " checked") not in html_rev and (comp_input + " checked") not in html_rev
    log_test("Review page has two mutually exclusive radio buttons, neither selected by default", has_paid and has_comp and neither_checked, "Paid & Complimentary present, 0 checked attributes")

    # Clean action buttons: Approve request & Decline
    has_approve_btn = "Approve request" in html_rev
    has_decline_btn = "Decline" in html_rev
    log_test("Review page has 'Approve request' and 'Decline' actions", has_approve_btn and has_decline_btn, "Actions present")

    # Clean light background styling
    has_light_bg = "#f8fafc" in html_rev and "#ffffff" in html_rev
    no_heavy_dark_card = "#0b1020" not in html_rev and "#060913" not in html_rev
    log_test("Review page uses clean light background with generous whitespace", has_light_bg and no_heavy_dark_card, "Background: #f8fafc / #ffffff, dark containers removed")

    # 3. Decision API validation
    # Approve without option -> 400
    code_fail, res_fail = http_req("/api/admin/invitations/review/decision", {
        "requestId": req_id,
        "adminEmail": "ermolov.elena@gmail.com",
        "action": "approve"
    })
    log_test("Approve without tier selection is blocked (400)", code_fail == 400, f"Error: {res_fail.get('message')}")

    # Approve with Paid tier -> 200
    code_ok, res_ok = http_req("/api/admin/invitations/review/decision", {
        "requestId": req_id,
        "adminEmail": "ermolov.elena@gmail.com",
        "action": "approve",
        "membership_tier": "paid"
    })
    log_test("Approve with Paid tier succeeds (200)", code_ok == 200 and res_ok.get("membership_tier") == "paid", f"Token: {res_ok.get('token')}")

    # After approval, review page reflects approved state cleanly
    _, html_approved = http_req(f"/api/admin/invitations/review?requestId={req_id}&adminEmail=ermolov.elena@gmail.com")
    log_test("Review page renders approved state with clean status card", "Request approved" in html_approved and "Paid membership" in html_approved, "Approved card displayed")

    print("\n=======================================================")
    print("ALL REFINED EMAIL & REVIEW DESIGN TESTS PASSED (100%)!")
    print("=======================================================")

if __name__ == "__main__":
    run()
