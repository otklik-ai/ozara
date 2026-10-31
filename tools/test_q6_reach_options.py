"""
Test Question 6 Contact Details Integration:
- Verifies that selecting WhatsApp, Telegram, Email, Zoom stores composite details
- Verifies that GET /api/contact/:targetId extracts whatsapp, telegram, email, zoom correctly
"""
import sqlite3
import json
import urllib.request

def test_q6_contact_options():
    print("[*] Testing Question 6 Contact Details Integration...")

    conn = sqlite3.connect("ozara.db")
    cursor = conn.cursor()

    # 1. Ensure test user exists or get an active user
    cursor.execute("SELECT id, full_name, email, phone FROM users WHERE is_complete = 1 LIMIT 1")
    row = cursor.fetchone()
    assert row is not None, "At least one active member required in database"
    user_id, full_name, email, phone = row
    print(f" [INFO] Testing with member: {full_name} ({user_id})")

    # 2. Insert composite Q6 answer
    q6_payload = {
        "methods": ["WhatsApp", "Telegram", "Email", "Zoom"],
        "details": {
            "whatsapp": "+1 555-987-6543",
            "telegram": "@test_investor",
            "email": "investor@circle.test",
            "zoom": "https://zoom.us/j/123456789"
        },
        "whatsapp": "+1 555-987-6543",
        "telegram": "@test_investor",
        "email": "investor@circle.test",
        "zoom_link": "https://zoom.us/j/123456789"
    }
    raw_json = json.dumps(q6_payload)

    cursor.execute("""
        INSERT OR REPLACE INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text, updated_at)
        VALUES (?, 6, 'Best way to reach you', 'answered', 'shared', ?, datetime('now'))
    """, (user_id, raw_json))
    conn.commit()
    print(" [PASS] Persisted composite Question 6 answer with WhatsApp, Telegram, Email, and Zoom details.")

    # 3. Query GET /api/connections/contact-methods/:targetId?viewerId=...
    url = f"http://localhost:3000/api/connections/contact-methods/{user_id}?viewerId={user_id}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data.get("full_name") == full_name, f"Expected {full_name}, got {data.get('full_name')}"
        methods = data.get("methods", {})
        print(f" [INFO] Extracted methods: {methods}")

        assert methods.get("whatsapp") == "+1 555-987-6543", f"WhatsApp mismatch: {methods.get('whatsapp')}"
        assert methods.get("telegram") == "@test_investor", f"Telegram mismatch: {methods.get('telegram')}"
        assert methods.get("email") == "investor@circle.test", f"Email mismatch: {methods.get('email')}"
        zoom_data = methods.get("zoom", {})
        assert zoom_data.get("enabled") is True, "Zoom should be enabled"
        assert zoom_data.get("meeting_link") == "https://zoom.us/j/123456789", f"Zoom link mismatch: {zoom_data.get('meeting_link')}"

    print(" [PASS] GET /api/contact/:targetId extracted WhatsApp, Telegram, Email, and Zoom correctly.")
    print("\n[SUCCESS] ALL QUESTION 6 CONTACT DETAILS INVARIANTS PASSED 100%!")

if __name__ == "__main__":
    test_q6_contact_options()
