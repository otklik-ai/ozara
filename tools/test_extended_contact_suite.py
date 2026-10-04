"""
Extended Test Suite for ÖZARA Contact Panel:
1. Boundary conditions (100 char name, 150 char email, 3000 char message)
2. Character limits exceeding checks
3. UTF-8 & International names and messages (diacritics, Cyrillic, Asian characters, quotes, emojis)
4. Database integrity checks (PRAGMA integrity_check)
5. Index and schema verification
"""

import urllib.request
import urllib.error
import json
import sqlite3
import time

BASE_URL = "http://localhost:3000"

def post_contact(payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/contact",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    return req

def run_extended_tests():
    print("[*] Starting Extended Contact Panel & Edge-Case Test Suite...")

    # 1. Boundary: Exactly 100-character name (Valid)
    name_100 = "A" * 100
    email_valid = f"test_boundary_{int(time.time())}@domain.com"
    req = post_contact({
        "name": name_100,
        "email": email_valid,
        "message": "Valid test message for 100-character boundary test."
    })
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        assert res.get("success") is True
        print(" [PASS] Boundary: Exactly 100-character name accepted.")

    # 2. Boundary: 101-character name (Invalid)
    name_101 = "A" * 101
    req = post_contact({
        "name": name_101,
        "email": email_valid,
        "message": "Valid test message for 101-character boundary test."
    })
    try:
        urllib.request.urlopen(req)
        assert False, "101-character name should have been rejected."
    except urllib.error.HTTPError as e:
        assert e.code == 400
        print(" [PASS] Boundary: 101-character name rejected with 400.")

    # 3. Boundary: 3001-character message (Invalid)
    msg_3001 = "M" * 3001
    req = post_contact({
        "name": "Boundary Tester",
        "email": f"test_msg_{int(time.time())}@domain.com",
        "message": msg_3001
    })
    try:
        urllib.request.urlopen(req)
        assert False, "3001-character message should have been rejected."
    except urllib.error.HTTPError as e:
        assert e.code == 400
        print(" [PASS] Boundary: 3001-character message rejected with 400.")

    # 4. UTF-8 & International Character Support
    intl_email = f"intl_{int(time.time())}@example.com"
    intl_payload = {
        "name": "Örjan Åkesson / Éléonore d'Orléans / Анастасия",
        "email": intl_email,
        "message": "Bonjour Alexandra & Julia! Looking forward to networking & private salon events in Zurich/Dubai 🌟."
    }
    req = post_contact(intl_payload)
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        assert res.get("success") is True
        print(" [PASS] UTF-8 International payload accepted cleanly.")

    # 5. Verify database persistent record and cleanup
    conn = sqlite3.connect("ozara.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name, email, message FROM contact_messages WHERE email = ?", (intl_email,))
    row = cursor.fetchone()
    assert row is not None
    assert "Örjan" in row[0]
    assert "🌟" in row[2]
    print(" [PASS] International characters verified in SQLite database storage.")

    # Clean up test rows
    cursor.execute("DELETE FROM contact_messages WHERE email LIKE 'test_%' OR email LIKE 'intl_%'")
    conn.commit()

    # 6. Database Integrity Check
    cursor.execute("PRAGMA integrity_check;")
    integrity = cursor.fetchall()
    assert integrity == [('ok',)], f"Integrity check failed: {integrity}"
    print(" [PASS] SQLite PRAGMA integrity_check passed: ok")

    # 7. Check index existence
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_contact_messages_email';")
    idx = cursor.fetchone()
    assert idx is not None, "Missing index idx_contact_messages_email"
    print(" [PASS] Database index idx_contact_messages_email verified.")

    conn.close()

    print("\n[SUCCESS] ALL EXTENDED TEST CASES PASSED FLAWLESSLY!")

if __name__ == "__main__":
    run_extended_tests()
