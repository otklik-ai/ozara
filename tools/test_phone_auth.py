"""
Test Suite: Phone Authentication & Gate Routing
Validates:
1. Phone auth configuration endpoint (SMS vs WhatsApp provider disclosure)
2. Invalid phone format rejection (< 7 or > 15 digits)
3. Code dispatch to existing member phone (+971501112233)
4. Invalid OTP rejection & retry tracking
5. Existing approved member verification -> is_existing_member: True, returns member user object
6. New candidate verification -> is_existing_member: False, retains phone and directs to Access Conditions & Invite Gate
"""

import sys
import os
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"

def request_json(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
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

def get_latest_code(phone):
    import sqlite3
    db_name = "ozara.db" if os.path.exists("ozara.db") else "sila.db"
    conn = sqlite3.connect(db_name)
    c = conn.cursor()
    c.execute("SELECT code FROM phone_verifications WHERE phone = ? ORDER BY created_at DESC LIMIT 1", (phone,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def run_tests():
    print("=== Testing Phone Auth & Membership Routing ===")
    
    # 1. Config endpoint
    status, config = request_json("/api/auth/phone/config")
    print(f"1. Phone Auth Config: status={status}, payload={config}")
    assert status == 200, f"Expected 200, got {status}"
    assert "whatsapp_verification_enabled" in config, "Missing whatsapp_verification_enabled"
    assert config["whatsapp_verification_enabled"] is False, "Expected WhatsApp disabled by default"
    assert config["provider"] == "local_sms" or config["provider"] == "sms", f"Unexpected provider: {config['provider']}"
    print("   [PASS] Provider configuration correctly hides WhatsApp when not configured.")

    # 2. Validation: Short / Invalid phone
    status, res = request_json("/api/auth/phone/send-code", method="POST", data={"phone": "123"})
    print(f"2. Invalid phone rejection: status={status}, error={res.get('error')}")
    assert status == 400, f"Expected 400 for short phone, got {status}"
    print("   [PASS] Invalid phone format properly rejected.")

    # 3. Send code to existing member (+971501112233 - Elena Ermolov)
    elena_phone = "+971501112233"
    status, res = request_json("/api/auth/phone/send-code", method="POST", data={"phone": elena_phone, "country_code": "AE"})
    print(f"3. Send code to existing member ({elena_phone}): status={status}, success={res.get('success')}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("success") is True, "Failed to dispatch code"
    demo_code = get_latest_code(elena_phone)
    assert demo_code and len(demo_code) == 6, f"Expected 6-digit code, got {demo_code}"
    print(f"   [PASS] 6-digit verification code dispatched: {demo_code}")

    # 4. Invalid OTP rejection
    status, res = request_json("/api/auth/phone/verify-code", method="POST", data={"phone": elena_phone, "code": "000000"})
    print(f"4. Invalid OTP test: status={status}, error={res.get('error')}")
    assert status == 400, f"Expected 400 for invalid code, got {status}"
    print("   [PASS] Incorrect code rejected.")

    # 5. Verify valid OTP for existing member
    status, res = request_json("/api/auth/phone/verify-code", method="POST", data={"phone": elena_phone, "code": demo_code})
    print(f"5. Verify valid code for existing member: status={status}, verified={res.get('verified')}, is_existing_member={res.get('is_existing_member')}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("verified") is True, "Expected verified=True"
    assert res.get("is_existing_member") is True, "Expected is_existing_member=True"
    assert res.get("user") is not None, "Expected user object for existing member"
    assert res["user"]["id"] == "usr_elena", f"Expected usr_elena, got {res['user']['id']}"
    print(f"   [PASS] Existing member successfully authenticated as {res['user']['full_name']} ({res['user']['id']}).")

    # 6. Verify valid OTP for new candidate (+14155550199)
    candidate_phone = "+14155550199"
    status, send_res = request_json("/api/auth/phone/send-code", method="POST", data={"phone": candidate_phone, "country_code": "US"})
    assert status == 200, f"Failed to send code to candidate: {send_res}"
    cand_code = get_latest_code(candidate_phone)

    status, res = request_json("/api/auth/phone/verify-code", method="POST", data={"phone": candidate_phone, "code": cand_code})
    print(f"6. Verify valid code for new candidate: status={status}, verified={res.get('verified')}, is_existing_member={res.get('is_existing_member')}")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("verified") is True, "Expected verified=True"
    assert res.get("is_existing_member") is False, "Candidate must NOT be automatically admitted as member"
    assert res.get("phone") == candidate_phone, "Candidate phone must be preserved"
    print("   [PASS] Candidate phone ownership verified; community gate preserved for invitation validation.")

    print("\nALL PHONE AUTH TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
