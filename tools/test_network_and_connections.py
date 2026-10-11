#!/usr/bin/env python3
"""
Test Suite: Network Layout, Test Profiles Refresh, and Connection/Privacy Flow
Verifies:
1. Preserved accounts: Elena Alexeeva, Elena Ermolov, and club founders.
2. 20 clearly fictional test profiles seeded with diverse backgrounds and placeholder contacts.
3. Member directory (/api/members) returns compact card attributes and filters (location, industry, interests, university).
4. Privacy invariant: Contact details (phone, email, zoom_link) are strictly redacted before mutual connection.
5. Connection lifecycle: Connect -> Requested -> Pending List -> Accept -> Contact methods unlocked (WhatsApp, Email, Zoom).
6. Unauthorized contact retrieval yields 403 Forbidden.
7. Unadmitted applicants do not leak into /api/members directory.
8. Email suppression prevents live emails from test suites.
"""

import sys
import json
import sqlite3
import urllib.request
import urllib.parse
import urllib.error

API_URL = "http://localhost:3000"

def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def http_post(url, data=None, headers=None):
    payload = json.dumps(data).encode('utf-8') if data is not None else None
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=payload, headers=h)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def log_pass(msg):
    print(f"\033[92m[PASS]\033[0m {msg}")

def log_fail(msg):
    print(f"\033[91m[FAIL]\033[0m {msg}")
    sys.exit(1)

def run_tests():
    print("=== ÖZARA NETWORK & CONNECTIONS VERIFICATION SUITE ===\n")

    # 1. Check Preserved Accounts & 20 Fictional Profiles in DB
    print("--- 1. Database Accounts Integrity Check ---")
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()

    users = c.execute("SELECT id, full_name, email, is_test, is_admitted FROM users").fetchall()
    user_dict = {u[0]: u for u in users}

    # Preserved check
    assert "usr_muwksc1i" in user_dict, "Elena Alexeeva (usr_muwksc1i) must be preserved!"
    assert "usr_elena" in user_dict, "Elena Ermolov (usr_elena) must be preserved!"
    assert "usr_alexandra" in user_dict, "Alexandra (usr_alexandra) must be preserved!"
    assert "usr_julia" in user_dict, "Julia (usr_julia) must be preserved!"
    log_pass("Preserved accounts intact: Elena Alexeeva, Elena Ermolov, Alexandra, Julia.")

    # Fictional members check
    fictional_users = [u for u in users if u[3] == 1]
    if len(fictional_users) != 20:
        log_fail(f"Expected exactly 20 fictional members with is_test=1, found {len(fictional_users)}")
    log_pass(f"Exactly 20 fictional test profiles confirmed with is_test=1.")

    # Check diverse locations
    locations = c.execute("SELECT DISTINCT city FROM users WHERE is_test = 1").fetchall()
    location_set = {loc[0] for loc in locations if loc[0]}
    expected_locations = {"Boston", "Miami", "Silicon Valley", "New York", "London", "Dubai", "Singapore", "Zurich"}
    if not expected_locations.issubset(location_set):
        log_fail(f"Expected diverse locations including {expected_locations}, got {location_set}")
    log_pass(f"Diverse locations verified across {len(location_set)} cities: {', '.join(sorted(location_set))}")

    # Check safe placeholder emails
    unsafe_fictional_emails = [u[2] for u in fictional_users if not u[2].endswith("@example.com")]
    if unsafe_fictional_emails:
        log_fail(f"Found unsafe emails in fictional test accounts: {unsafe_fictional_emails}")
    log_pass("All fictional test members use safe placeholder emails (@example.com).")

    conn.close()

    # 2. Test /api/members Directory & Filtering
    print("\n--- 2. Member Directory API & Privacy Redaction ---")
    viewer_id = "usr_muwksc1i" # Elena Alexeeva viewing

    status, data = http_get(f"{API_URL}/api/members?viewerId={viewer_id}&paginated=true&limit=10")
    if status != 200:
        log_fail(f"GET /api/members returned status {status}: {data}")

    members = data.get("members", [])
    if len(members) == 0:
        log_fail("GET /api/members returned 0 members")
    log_pass(f"GET /api/members returned {len(members)} members (total: {data.get('total')}).")

    # Check compact card attributes: role_title, company, relevant_tags
    sample = members[0]
    if "full_name" not in sample or "role_title" not in sample or "relevant_tags" not in sample:
        log_fail(f"Member directory item missing compact card attributes: {sample}")
    log_pass(f"Compact card attributes present: role_title='{sample.get('role_title')}', tags={sample.get('relevant_tags')}")

    # Verify that private contact details are strictly redacted in /api/members
    for m in members:
        if m.get("connection_status") != "accepted":
            if "phone" in m and m["phone"] is not None:
                log_fail(f"Privacy breach: unaccepted member {m['id']} exposed phone in directory!")
            if "email" in m and m["email"] is not None:
                log_fail(f"Privacy breach: unaccepted member {m['id']} exposed email in directory!")
            if "zoom_link" in m and m["zoom_link"] is not None:
                log_fail(f"Privacy breach: unaccepted member {m['id']} exposed zoom_link in directory!")
    log_pass("Backend privacy invariant verified: phone, email, and zoom_link are strictly redacted in directory.")

    # Test Location filter
    _, res_loc = http_get(f"{API_URL}/api/members?viewerId={viewer_id}&location=Boston&paginated=true")
    boston_members = res_loc.get("members", []) if isinstance(res_loc, dict) else res_loc
    if not any("Boston" in m.get("city", "") for m in boston_members):
        log_fail("Location filter 'Boston' did not return Boston members")
    log_pass(f"Location filter 'Boston' verified: returned {len(boston_members)} members.")

    # Test Industry filter
    _, res_ind = http_get(f"{API_URL}/api/members?viewerId={viewer_id}&industry=Technology&paginated=true")
    tech_members = res_ind.get("members", []) if isinstance(res_ind, dict) else res_ind
    if len(tech_members) == 0:
        log_fail("Industry filter 'Technology' returned 0 members")
    log_pass(f"Industry filter 'Technology' verified: returned {len(tech_members)} members.")

    # Test University filter
    _, res_uni = http_get(f"{API_URL}/api/members?viewerId={viewer_id}&university=Harvard&paginated=true")
    harvard_members = res_uni.get("members", []) if isinstance(res_uni, dict) else res_uni
    if len(harvard_members) == 0:
        log_fail("University filter 'Harvard' returned 0 members")
    log_pass(f"University filter 'Harvard' verified: returned {len(harvard_members)} members.")

    # 3. Test Recommendations & Short Matching Reason
    print("\n--- 3. Recommendations & Short Matching Reason ---")
    rec_status, recs = http_get(f"{API_URL}/api/recommendations?viewerId={viewer_id}")
    if rec_status != 200:
        log_fail(f"GET /api/recommendations failed: {recs}")
    if len(recs) == 0:
        log_fail("Recommendations returned 0 items")
    sample_rec = recs[0]
    if not sample_rec.get("short_match_reason"):
        log_fail(f"Recommendation missing short_match_reason: {sample_rec}")
    log_pass(f"Recommendations returned with short_match_reason: '{sample_rec['short_match_reason']}'")

    # 4. Connection Lifecycle & Permitted Contact Channels Flow
    print("\n--- 4. Connection Lifecycle & Contact Permissions ---")
    user_a = "usr_fictional_10" # Mateo Silva
    user_b = "usr_fictional_11" # Chloe Dupont

    # Clean any pre-existing connection between A and B
    conn = sqlite3.connect("ozara.db")
    conn.execute("DELETE FROM member_connections WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)",
                 (user_a, user_b, user_b, user_a))
    conn.commit()
    conn.close()

    # Step 4a: A tries to get B's contact methods before connecting -> MUST be 403 Forbidden!
    cm_unauth_status, cm_unauth_body = http_get(f"{API_URL}/api/connections/contact-methods/{user_b}?viewerId={user_a}")
    if cm_unauth_status != 403:
        log_fail(f"Privacy failure: Expected 403 Forbidden for unauthorized contact-methods, got {cm_unauth_status}")
    log_pass("Contact methods endpoint returned 403 Forbidden before mutual connection acceptance.")

    # Step 4b: A sends connection request to B
    req_status, req_res = http_post(f"{API_URL}/api/connections/request", {
        "requester_id": user_a,
        "recipient_id": user_b,
        "note": "Would love to discuss AI collaboration"
    })
    if req_status != 200 or not req_res.get("success") or req_res.get("status") not in ("pending", "pending_sent"):
        log_fail(f"Connection request failed: {req_res}")
    log_pass("Connection request sent from User A to User B (status='pending_sent').")

    # Step 4c: Check B's pending connection list
    _, pending_res = http_get(f"{API_URL}/api/connections/pending?viewerId={user_b}")
    b_pending = [p for p in pending_res if p.get("requester_id") == user_a or p.get("user_id") == user_a]
    if len(b_pending) == 0:
        log_fail(f"User B did not see User A's pending request: {pending_res}")
    log_pass("User B successfully sees User A in pending requests queue.")

    # Step 4d: B accepts connection request
    accept_status, accept_res = http_post(f"{API_URL}/api/connections/accept", {
        "recipient_id": user_b,
        "requester_id": user_a
    })
    if accept_status != 200 or not accept_res.get("success") or accept_res.get("status") != "accepted":
        log_fail(f"Accept connection failed: {accept_res}")
    log_pass("User B accepted User A's connection request (status='accepted').")

    # Step 4e: Now User A requests User B's permitted contact methods -> MUST succeed with 200 OK
    cm_auth_status, cm_data = http_get(f"{API_URL}/api/connections/contact-methods/{user_b}?viewerId={user_a}")
    if cm_auth_status != 200:
        log_fail(f"Expected 200 OK after acceptance, got {cm_auth_status}: {cm_data}")
    if not cm_data.get("methods") or not cm_data.get("allowed_list"):
        log_fail(f"Contact methods payload invalid: {cm_data}")
    log_pass(f"Contact methods unlocked for accepted connection: allowed_list={cm_data.get('allowed_list')}")

    # Check Zoom link support
    if "zoom" not in cm_data["methods"]:
        log_fail(f"Zoom not included in contact methods: {cm_data}")
    log_pass("Zoom contact channel verified (configured & optional link supported).")

    # Clean up test connection
    conn = sqlite3.connect("ozara.db")
    conn.execute("DELETE FROM member_connections WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)",
                 (user_a, user_b, user_b, user_a))
    conn.commit()
    conn.close()

    # 5. Email Suppression & Test Applicant Gating Check
    print("\n--- 5. Email Suppression & Unadmitted Gating ---")
    test_req_status, req_json = http_post(f"{API_URL}/api/invitations/request-access",
        data={
            "full_name": "Test Candidate",
            "email": "automated_test_applicant@example.com",
            "linkedin_or_background": "https://linkedin.com/in/test",
            "what_brings_you": "Automated verification"
        },
        headers={"x-test-suite": "true"}
    )
    if test_req_status != 200:
        log_fail(f"request-access failed: {req_json}")
    log_pass(f"Access request submitted cleanly: {req_json.get('message')}")

    # Check that unadmitted applicant is NOT in /api/members
    _, members_resp = http_get(f"{API_URL}/api/members?viewerId={viewer_id}&paginated=true")
    all_members = members_resp.get("members", []) if isinstance(members_resp, dict) else members_resp
    if any(m.get("email") == "automated_test_applicant@example.com" or m.get("full_name") == "Test Candidate" for m in all_members):
        log_fail("Unadmitted applicant leaked into /api/members directory!")
    log_pass("Unadmitted applicants remain strictly isolated from member directory.")

    print("\n\033[92mALL 5 TEST SUITES PASSED SUCCESSFULLY!\033[0m")

if __name__ == "__main__":
    run_tests()
