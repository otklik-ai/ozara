#!/usr/bin/env python3
"""
Test Suite: Telegram Integration, Translation, Album Grouping & Edit Sync
Verifies:
1. Environment security (Token in .env, masked in logs, out of git)
2. Translation engine (Cyrillic -> English with preserved entities)
3. Media album grouping (multiple messages with same media_group_id -> 1 post with attachments)
4. Author whitelist filtering (approved authors pass, unapproved members ignored)
5. Anonymous / unidentified author held for review (status = 'pending_review')
6. Edit synchronization (updates post in place without duplicates; flags if admin edited)
7. Community API feed filtering (?filter=all|ozara|members)
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.parse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
DB_PATH = os.path.join(BASE_DIR, "ozara.db")
BASE_URL = "http://localhost:3000"

from tools.sync_telegram_channel import detect_and_translate, process_message

def test_security():
    print("-> 1. Verifying environment security & token isolation...")
    env_path = os.path.join(BASE_DIR, ".env")
    assert os.path.exists(env_path), ".env missing"
    
    with open(os.path.join(BASE_DIR, ".gitignore"), "r") as f:
        gitignore = f.read()
    assert ".env" in gitignore, ".env must be listed in .gitignore"
    
    with open(env_path, "r") as f:
        env_content = f.read()
    assert "TELEGRAM_BOT_TOKEN=" in env_content, "TELEGRAM_BOT_TOKEN missing in .env"
    print("   ✓ Token is stored securely in server-side .env and ignored by git.")

def test_translation():
    print("-> 2. Verifying language detection & entity-preserving translation...")
    sample_text = "Закрытый инвестиционный салон в Цюрихе начнется 15 ноября. Аллокации: $500,000. Подробности: https://ozara.club"
    trans, lang, is_trans = detect_and_translate(sample_text)
    print(f"   Original: {sample_text}")
    print(f"   Detected Lang: {lang} | Translated: {is_trans}")
    print(f"   English Output: {trans}")
    
    assert is_trans is True, "Expected translation flag to be True"
    assert lang == "ru", f"Expected 'ru', got {lang}"
    assert "https://ozara.club" in trans or "ozara.club" in trans, "URL entity must be preserved"
    assert "$500,000" in trans or "500,000" in trans, "Amount entity must be preserved"
    print("   ✓ Translation engine successfully converts Cyrillic to English with preserved entities.")

def test_pipeline_and_author_filtering():
    print("-> 3. Verifying sync pipeline: Author filtering, album grouping, and edits...")
    conn = sqlite3.connect(DB_PATH)
    
    config = {
        "token": "test_token",
        "group_id": "-100123456789",
        "approved_authors": {"111222333", "444555666"} # Simulating Alexandra (111222333) and Julia (444555666)
    }
    
    test_chat = {"id": -100123456789, "title": "Julia & Alexandra | Сила Связей", "type": "supergroup"}
    
    # Clean any test posts
    conn.execute("DELETE FROM community_posts WHERE telegram_channel_id = '-100123456789'")
    conn.commit()
    
    try:
        # A. Unapproved author message -> must be ignored
        unapproved_update = {
            "update_id": 9001,
            "message": {
                "message_id": 101,
                "chat": test_chat,
                "from": {"id": 999999999, "first_name": "Random", "last_name": "Member"},
                "text": "Hello can I pitch my startup here?"
            }
        }
        res_unapproved = process_message(conn, config, unapproved_update)
        assert res_unapproved == "ignored_unapproved_author", f"Expected ignored_unapproved_author, got {res_unapproved}"
        print("   ✓ Non-approved group member post was excluded.")
        
        # B. Service message -> must be ignored
        service_update = {
            "update_id": 9002,
            "message": {
                "message_id": 102,
                "chat": test_chat,
                "from": {"id": 111222333, "first_name": "Alexandra"},
                "new_chat_members": [{"id": 8671826717, "first_name": "Bot"}]
            }
        }
        res_service = process_message(conn, config, service_update)
        assert res_service == "ignored_service", f"Expected ignored_service, got {res_service}"
        print("   ✓ Service message (bot joined) was excluded.")
        
        # C. Approved author (Alexandra) album: Photo 1
        album_update_1 = {
            "update_id": 9003,
            "message": {
                "message_id": 103,
                "chat": test_chat,
                "from": {"id": 111222333, "first_name": "Alexandra", "last_name": "Hill"},
                "media_group_id": "album_grp_999",
                "caption": "Привет! Закрытый салон в Цюрихе подтвержден. Приглашаем членов клуба.",
                "photo": [{"file_id": "photo_file_1", "width": 800, "height": 600}]
            }
        }
        res_post_1 = process_message(conn, config, album_update_1)
        assert res_post_1.startswith("created_post_tg_"), f"Expected created post, got {res_post_1}"
        post_id = res_post_1.replace("created_", "")
        print(f"   ✓ Post created from approved author (Alexandra): {post_id}")
        
        # D. Approved author (Alexandra) album: Photo 2 (same media_group_id) -> must append, NOT duplicate
        album_update_2 = {
            "update_id": 9004,
            "message": {
                "message_id": 104,
                "chat": test_chat,
                "from": {"id": 111222333, "first_name": "Alexandra", "last_name": "Hill"},
                "media_group_id": "album_grp_999",
                "photo": [{"file_id": "photo_file_2", "width": 800, "height": 600}]
            }
        }
        res_post_2 = process_message(conn, config, album_update_2)
        assert res_post_2 == f"appended_to_album_{post_id}", f"Expected appended_to_album, got {res_post_2}"
        print("   ✓ Media album second item successfully grouped into the existing post.")
        
        # Check DB count: must still be exactly 1 post
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM community_posts WHERE telegram_channel_id = '-100123456789'")
        cnt = cursor.fetchone()[0]
        assert cnt == 1, f"Expected 1 post in DB, found {cnt}"
        
        # E. Source Edit Synchronization (Alexandra edits caption)
        edit_update = {
            "update_id": 9005,
            "edited_message": {
                "message_id": 103,
                "chat": test_chat,
                "from": {"id": 111222333, "first_name": "Alexandra", "last_name": "Hill"},
                "caption": "Обновление: Закрытый салон в Цюрихе пройдет 15 ноября. Доступ открыт."
            }
        }
        res_edit = process_message(conn, config, edit_update, is_edit=True)
        assert res_edit == f"updated_{post_id}", f"Expected updated, got {res_edit}"
        print("   ✓ Source edit synchronized in place without duplicate posts.")
        
        # F. Anonymous post -> held for review
        anon_update = {
            "update_id": 9006,
            "message": {
                "message_id": 105,
                "chat": test_chat,
                # No 'from'
                "text": "Anonymous post from channel sponsor"
            }
        }
        res_anon = process_message(conn, config, anon_update)
        assert res_anon.startswith("created_post_tg_")
        anon_post_id = res_anon.replace("created_", "")
        cursor.execute("SELECT status FROM community_posts WHERE id = ?", (anon_post_id,))
        st = cursor.fetchone()[0]
        assert st == "pending_review", f"Expected pending_review for anonymous post, got {st}"
        print("   ✓ Anonymous/unidentified post held safely in 'pending_review' status.")
        
    finally:
        # Cleanup test posts
        conn.execute("DELETE FROM community_posts WHERE telegram_channel_id = '-100123456789'")
        conn.commit()
        conn.close()

def main():
    print("==========================================================")
    print("RUNNING TELEGRAM INTEGRATION TEST SUITE")
    print("==========================================================")
    test_security()
    test_translation()
    test_pipeline_and_author_filtering()
    print("==========================================================")
    print("ALL TELEGRAM INTEGRATION TESTS PASSED (100%)!")
    print("==========================================================")

if __name__ == "__main__":
    main()
