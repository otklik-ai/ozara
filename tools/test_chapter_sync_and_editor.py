import urllib.request
import json
import sqlite3

BASE_URL = "http://localhost:3000"

def request(path, method="GET", data=None, extra_headers=None):
    headers = {"Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8") if data else None,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return json.loads(body), e.code
        except:
            return {"raw": body}, e.code

def test_chapter_sync():
    print("[*] Testing Chapter Sync & Questionnaire Invariants...")
    
    # 1. Verify Chapters endpoint
    chapters, status = request("/api/chapters")
    assert status == 200, f"Failed to get chapters: {chapters}"
    chapter_ids = {c["id"]: c for c in chapters}
    assert "ch_boston" in chapter_ids, "ch_boston must exist in /api/chapters"
    assert "ch_silicon_valley" in chapter_ids, "ch_silicon_valley must exist"
    assert "ch_new_york" in chapter_ids, "ch_new_york must exist"
    assert "ch_miami" in chapter_ids, "ch_miami must exist"
    
    boston = chapter_ids["ch_boston"]
    assert boston["lead_name"] == "Sarah Jenkins", f"Boston lead: {boston}"
    assert boston["lead_email"] == "boston@ozara.club"
    
    sv = chapter_ids["ch_silicon_valley"]
    assert sv["lead_name"] == "David Chen", f"SV lead: {sv}"
    assert sv["lead_email"] == "siliconvalley@ozara.club"
    print(" [PASS] 4 canonical chapters (Boston, Miami, Silicon Valley, New York) verified.")

    # 2. Test saving Q24 on a test user
    test_user_id = "usr_test_chapter_sync"
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE id = ?", (test_user_id,))
    c.execute("DELETE FROM questionnaire_answers WHERE user_id = ?", (test_user_id,))
    c.execute("""
        INSERT INTO users (id, email, full_name, headline, city, country, contact_preference, role, is_complete, chapter_id)
        VALUES (?, 'test.chapter@ozara.club', 'Test Chapter Sync', 'Member Headline', 'New York', 'United States', 'direct_contact', 'MEMBER', 0, 'ch_new_york')
    """, (test_user_id,))
    conn.commit()
    conn.close()

    # Save Q24 as Boston
    res, status = request(f"/api/profile/{test_user_id}/answer", method="POST", data={
        "question_id": 24,
        "value": "Boston — Chapter member",
        "visibility": "shared"
    }, extra_headers={"x-user-id": test_user_id})
    assert status == 200, f"Failed to save Q24: {res}"

    # Verify database updated users.chapter_id to ch_boston
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    row = c.execute("SELECT chapter_id FROM users WHERE id = ?", (test_user_id,)).fetchone()
    assert row[0] == "ch_boston", f"Expected ch_boston, got {row[0]}"
    print(" [PASS] Answering Q24 with Boston synchronizes users.chapter_id to ch_boston.")

    # Save Q24 as Silicon Valley
    res, status = request(f"/api/profile/{test_user_id}/answer", method="POST", data={
        "question_id": 24,
        "value": "Silicon Valley — Interested in organizing gatherings",
        "visibility": "shared"
    }, extra_headers={"x-user-id": test_user_id})
    assert status == 200, f"Failed to save Q24 SV: {res}"

    row = c.execute("SELECT chapter_id FROM users WHERE id = ?", (test_user_id,)).fetchone()
    assert row[0] == "ch_silicon_valley", f"Expected ch_silicon_valley, got {row[0]}"
    print(" [PASS] Answering Q24 with Silicon Valley synchronizes users.chapter_id to ch_silicon_valley.")

    # 3. Test bulk save Q24 synchronization
    res, status = request(f"/api/profile/{test_user_id}/answers-bulk", method="POST", data={
        "answers": [
            {"question_id": 24, "value": "Miami — Host or speaker for dinners", "visibility": "shared"},
            {"question_id": 18, "value": json.dumps({"tags": ["Direct introductions"], "note": "Tech founders in Miami"}), "visibility": "shared"}
        ]
    }, extra_headers={"x-user-id": test_user_id})
    assert status == 200, f"Bulk save failed: {res}"
    assert res.get("is_complete") is True, "Profile must be complete with Q18"

    row = c.execute("SELECT chapter_id, is_complete FROM users WHERE id = ?", (test_user_id,)).fetchone()
    assert row[0] == "ch_miami", f"Expected ch_miami, got {row[0]}"
    assert row[1] == 1, f"Expected is_complete = 1, got {row[1]}"
    print(" [PASS] Bulk saving Q24 synchronizes chapter_id to ch_miami and marks is_complete = 1.")

    # Cleanup
    c.execute("DELETE FROM users WHERE id = ?", (test_user_id,))
    c.execute("DELETE FROM questionnaire_answers WHERE user_id = ?", (test_user_id,))
    conn.commit()
    conn.close()

    print("\n[SUCCESS] CHAPTER SYNC AND QUESTIONNAIRE INVARIANTS PASSED 100%!")

if __name__ == "__main__":
    test_chapter_sync()
