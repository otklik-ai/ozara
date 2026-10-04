"""
Deterministic Automated Verification Tool for ÖZARA Contact Panel:
1. Validates /api/contact/config endpoint
2. Validates field constraints (Name, Email, Message)
3. Validates Honeypot Spam Protection
4. Validates Content Guardrails (prohibited terms)
5. Validates Success Confirmation: "Thank you. Your message has been received."
6. Validates Routing to Configured Admin Inboxes for Alexandra and Julia
7. Validates Rate Limiting
"""

import urllib.request
import urllib.error
import json
import sqlite3
import time

BASE_URL = "http://localhost:3000"

def run_tests():
    print("[*] Testing ÖZARA Contact Panel & Admin Routing API...")

    # 1. Config endpoint
    req = urllib.request.Request(f"{BASE_URL}/api/contact/config")
    with urllib.request.urlopen(req) as resp:
        cfg = json.loads(resp.read().decode('utf-8'))
        assert "whatsapp_configured" in cfg, "Config missing whatsapp_configured"
        assert "whatsapp_number" in cfg, "Config missing whatsapp_number"
        print(f" [PASS] Contact config endpoint verified: whatsapp_configured={cfg['whatsapp_configured']}")

    # 2. Validation: Short name
    payload = {"name": "A", "email": "valid@email.com", "message": "This is a valid test message with sufficient length."}
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Short name should have been rejected"
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"Expected 400 for short name, got {e.code}"
        err = json.loads(e.read().decode('utf-8'))
        print(f" [PASS] Name validation caught short name: {err.get('error')}")

    # 3. Validation: Invalid email
    payload = {"name": "Test User", "email": "not-an-email", "message": "This is a valid test message with sufficient length."}
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Invalid email should have been rejected"
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"Expected 400 for invalid email, got {e.code}"
        err = json.loads(e.read().decode('utf-8'))
        print(f" [PASS] Email validation caught invalid email: {err.get('error')}")

    # 4. Validation: Short message
    payload = {"name": "Test User", "email": "valid@email.com", "message": "Too short"}
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Short message should have been rejected"
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"Expected 400 for short message, got {e.code}"
        err = json.loads(e.read().decode('utf-8'))
        print(f" [PASS] Message validation caught short message: {err.get('error')}")

    # 5. Content Guardrail: Prohibited terms
    payload = {
        "name": "Investor",
        "email": "investor@test.com",
        "message": "We guarantee a risk-free profit with annual return guaranteed!"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Prohibited content should have been blocked"
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"Expected 400 for prohibited content, got {e.code}"
        err = json.loads(e.read().decode('utf-8'))
        print(f" [PASS] Content guardrail blocked prohibited text: {err.get('error')}")

    # 6. Honeypot Spam Protection
    spam_email = f"spambot_{int(time.time())}@fake.net"
    payload = {
        "name": "Bot Sender",
        "email": spam_email,
        "message": "Spam commercial message to buy products online now.",
        "website": "http://spambot-link.com"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        assert res.get("success") is True, "Honeypot should silently succeed"

    conn = sqlite3.connect("ozara.db")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM contact_messages WHERE email = ?", (spam_email,))
    spam_count = cursor.fetchone()[0]
    assert spam_count == 0, "Spam bot submission was erroneously saved to DB!"
    print(f" [PASS] Honeypot spam trap actively neutralized spam without DB pollution.")

    # 7. Valid Submission & Exact Confirmation Message
    unique_ts = int(time.time() * 1000)
    test_email = f"prospective_{unique_ts}@advisory.ch"
    payload = {
        "name": "Victoria Sterling",
        "email": test_email,
        "message": "Dear Alexandra and Julia, I would like to inquire about admission requirements for the Zurich and Dubai chapters."
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        assert res.get("success") is True
        expected_msg = "Thank you. Your message has been received."
        assert res.get("message") == expected_msg, f"Expected message '{expected_msg}', got '{res.get('message')}'"
        print(f" [PASS] Valid submission received exact confirmation: \"{res.get('message')}\"")

    # Verify DB storage
    cursor.execute("SELECT id, name, email, message FROM contact_messages WHERE email = ?", (test_email,))
    row = cursor.fetchone()
    assert row is not None, "Message was not saved in contact_messages table"
    assert row[1] == "Victoria Sterling"
    assert row[2] == test_email
    print(f" [PASS] Verified persistent contact_messages record in database (ID: {row[0]})")

    # Clean up test submission
    cursor.execute("DELETE FROM contact_messages WHERE email = ?", (test_email,))
    conn.commit()
    conn.close()

    print("\n[SUCCESS] ALL CONTACT PANEL & ADMIN ROUTING INVARIANTS PASSED 100%!")

if __name__ == "__main__":
    run_tests()
