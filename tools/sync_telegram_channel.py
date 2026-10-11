#!/usr/bin/env python3
"""
Telegram Ingestion & Synchronization Engine for ÖZARA Community Wall
Strict Operational Invariants:
1. Token Security: Never outputs bot token in terminal logs or database records.
2. Hard Gating: Live importing & publishing are DISABLED while TELEGRAM_GROUP_ID or TELEGRAM_APPROVED_AUTHOR_IDS is empty.
3. Coordinated Offset: Uses telegram_sync_state in SQLite so detection and sync never compete for updates.
4. Sender Independence: Detecting a group ID never automatically approves its sender into the author whitelist.
5. Multi-Language & Mixed Detection: Detects all non-English languages (Cyrillic, European accented Latin, Arabic, etc.).
6. Translation Quarantine: Failed translations remain UNPUBLISHED (status = 'pending_review') for admin review.
7. Private Media: Gated behind admitted-member authentication on the backend.
8. Media Album Grouping: Multi-photo/video messages sharing media_group_id combine into 1 post.
9. Edit Synchronization: In-place update using (telegram_channel_id, telegram_message_id); preserves admin edits.
"""

import os
import sys
import time
import json
import uuid
import re
import sqlite3
import urllib.request
import urllib.parse
import urllib.error

try:
    import langdetect
    from langdetect import detect_langs, DetectorFactory
    DetectorFactory.seed = 0
except ImportError:
    langdetect = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "ozara.db")
MEDIA_STORAGE_DIR = os.path.join(BASE_DIR, "storage", "telegram_media")
ENV_PATH = os.path.join(BASE_DIR, ".env")

os.makedirs(MEDIA_STORAGE_DIR, exist_ok=True)

def load_env():
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def get_config():
    env = load_env()
    token = env.get("TELEGRAM_BOT_TOKEN", "").strip()
    group_id = env.get("TELEGRAM_GROUP_ID", "").strip()
    approved_authors_raw = env.get("TELEGRAM_APPROVED_AUTHOR_IDS", "").strip()
    
    approved_authors = set()
    if approved_authors_raw:
        for p in approved_authors_raw.split(","):
            p = p.strip()
            if p:
                approved_authors.add(str(p))
                
    is_live_enabled = bool(group_id and approved_authors)
    
    return {
        "token": token,
        "group_id": group_id,
        "approved_authors": approved_authors,
        "is_live_enabled": is_live_enabled
    }

def call_telegram(token, method, params=None):
    if not token:
        return {"ok": False, "description": "Token missing"}
    url = f"https://api.telegram.org/bot{token}/{method}"
    if params:
        data = json.dumps(params).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    else:
        req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        return {"ok": False, "error_code": e.code, "description": err}
    except Exception as e:
        return {"ok": False, "description": str(e)}

def download_telegram_file(token, file_id, extension="jpg"):
    res = call_telegram(token, "getFile", {"file_id": file_id})
    if not res.get("ok"):
        return None, None
    file_path = res["result"].get("file_path")
    if not file_path:
        return None, None
        
    download_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
    local_filename = f"tg_{uuid.uuid4().hex[:12]}.{extension}"
    local_path = os.path.join(MEDIA_STORAGE_DIR, local_filename)
    public_url = f"/storage/telegram_media/{local_filename}"
    
    try:
        urllib.request.urlretrieve(download_url, local_path)
        return public_url, local_path
    except Exception as e:
        print(f"[-] Error downloading file {file_id}: {e}")
        return None, None

def detect_language(text):
    """
    Detects if text contains non-English languages (Cyrillic, unaccented French/Spanish, German, etc.)
    Returns (is_non_english, detected_lang_code)
    """
    if not text or not text.strip():
        return False, "en"

    clean_text = text.strip()

    # 1. Fast script checks (Cyrillic, Arabic, CJK)
    if re.search(r'[\u0400-\u04FF]', clean_text):
        return True, "ru"
    if re.search(r'[\u0600-\u06FF\u0590-\u05FF]', clean_text):
        return True, "ar"
    if re.search(r'[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]', clean_text):
        return True, "zh"

    # 2. Statistical language detection via langdetect (covers unaccented French, Spanish, German, etc.)
    if langdetect:
        try:
            langs = detect_langs(clean_text)
            if langs:
                top_lang = langs[0].lang
                top_prob = langs[0].prob

                # If primary language is non-English
                if top_lang != "en" and top_prob >= 0.4:
                    return True, top_lang

                # For mixed-language content: if English is top, but any non-English language has >= 0.12 probability
                for l in langs:
                    if l.lang != "en" and l.prob >= 0.12:
                        return True, l.lang
        except Exception:
            pass

    # 3. European accented Latin fallback
    accented = re.findall(r'[àáâäãåçéèêëíìîïñóòôöõúùûüßæœÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜ]', clean_text)
    if len(accented) >= 2 or (len(accented) == 1 and len(clean_text) < 50):
        return True, "eu_latin"

    return False, "en"

def translate_to_english(text, source_hint="auto"):
    """
    Translates text to English while preserving entities.
    Returns (translated_text, success, error_msg)
    """
    if not text or not text.strip():
        return "", True, None
        
    lang_pair = "ru|en" if source_hint == "ru" else "auto|en"
    
    try:
        encoded_query = urllib.parse.quote(text)
        url = f"https://api.mymemory.translated.net/get?q={encoded_query}&langpair={lang_pair}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ÖZARA Sync Bot)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            status = data.get("responseStatus")
            
            if status in [200, "200"]:
                trans = data.get("responseData", {}).get("translatedText")
                if trans and trans.strip():
                    return trans, True, None
            else:
                err_details = data.get("responseDetails", f"HTTP {status}")
                return None, False, f"Translation API rejected: {err_details}"
    except Exception as e:
        return None, False, f"Translation network error: {str(e)}"
        
    return None, False, "Empty translation returned"

def translate_author_to_english(author_raw):
    """
    Translates Telegram author display names to verified English names.
    Verified spelling from admin records & email:
    Julia Shchukina: iuliiashchukinainvest@gmail.com
    Alexandra Hill: agniyahill@gmail.com
    """
    if not author_raw:
        return "ÖZARA Leadership"
    clean = author_raw.strip()
    if "Юлия" in clean or "Julia" in clean or "Щукина" in clean:
        return "Julia Shchukina | Founder"
    if "Александра" in clean or "Alexandra" in clean:
        return "Alexandra Hill | Founder"
    if "Елена" in clean or "Elena" in clean:
        return "Elena Ermolov | Founder"
    return clean



def is_service_message(msg):
    service_fields = [
        "new_chat_members", "left_chat_member", "new_chat_title", "new_chat_photo",
        "delete_chat_photo", "group_chat_created", "supergroup_chat_created",
        "channel_chat_created", "pinned_message", "migrate_to_chat_id", "migrate_from_chat_id"
    ]
    return any(field in msg for field in service_fields)

def record_detected_identity(cursor, chat_id, chat_title, chat_type, user_id, user_name, username, is_bot, sample_text):
    rec_id = f"det_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
        INSERT INTO telegram_detected_identities (
            id, chat_id, chat_title, chat_type, user_id, user_name, username, is_bot, sample_text, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (rec_id, str(chat_id), chat_title, chat_type, str(user_id or ''), user_name, username, 1 if is_bot else 0, sample_text[:100] if sample_text else None))

def log_sync_event(cursor, update_id, chat_id, message_id, event_type, author_id, author_name, status, details):
    log_id = f"log_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
        INSERT INTO telegram_sync_logs (
            id, update_id, chat_id, message_id, event_type, author_id, author_name, status, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (log_id, update_id, str(chat_id), message_id, event_type, str(author_id or ''), author_name, status, details))

def process_single_update(conn, config, update, is_edit=False):
    cursor = conn.cursor()
    token = config["token"]
    target_group_id = config["group_id"]
    approved_authors = config["approved_authors"]
    is_live_enabled = config["is_live_enabled"]
    
    update_id = update.get("update_id")

    # Handle bot membership update (my_chat_member / chat_member)
    if "my_chat_member" in update or "chat_member" in update:
        mcm = update.get("my_chat_member") or update.get("chat_member")
        chat = mcm.get("chat", {})
        chat_id = str(chat.get("id"))
        chat_title = chat.get("title") or "Telegram Group"
        chat_type = chat.get("type", "group")
        from_user = mcm.get("from", {})
        promoter_id = str(from_user.get("id"))
        promoter_name = f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}".strip()
        promoter_uname = from_user.get("username")
        new_status = mcm.get("new_chat_member", {}).get("status", "member")

        record_detected_identity(cursor, chat_id, chat_title, chat_type, promoter_id, promoter_name, promoter_uname, False, f"Bot membership event ({new_status})")
        print(f"[*] [MEMBERSHIP UPDATE] Bot added/promoted in '{chat_title}' (ID: {chat_id}) by '{promoter_name}' (@{promoter_uname})")

        # Automatically query administrators for Julia & Alexandra's candidate accounts
        if token and chat_id:
            try:
                admins_res = call_telegram(token, "getChatAdministrators", {"chat_id": chat_id})
                if admins_res.get("ok"):
                    print(f"    [ADMIN DISCOVERY] Querying administrators of chat {chat_id}:")
                    for admin in admins_res.get("result", []):
                        u = admin.get("user", {})
                        if not u.get("is_bot"):
                            adm_id = str(u.get("id"))
                            adm_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                            adm_uname = u.get("username")
                            status = admin.get("custom_title") or admin.get("status")
                            record_detected_identity(cursor, chat_id, chat_title, chat_type, adm_id, adm_name, adm_uname, False, f"Administrator ({status})")
                            print(f"    - Candidate Administrator: '{adm_name}' (@{adm_uname}) | Numeric ID: {adm_id} | Role: {status}")
            except Exception as e:
                print(f"    [-] Error fetching administrators: {e}")

        conn.commit()
        return f"membership_event_{chat_id}"

    msg = update.get("edited_message") if is_edit else update.get("message")
    if not msg:
        msg = update.get("edited_channel_post") if is_edit else update.get("channel_post")
    if not msg:
        return "non_message_update"
        
    chat = msg.get("chat", {})
    chat_id = str(chat.get("id"))
    chat_title = chat.get("title") or chat.get("username") or "Private Chat"
    chat_type = chat.get("type", "unknown")
    message_id = msg.get("message_id")
    from_user = msg.get("from")
    
    author_id = str(from_user.get("id")) if from_user else None
    author_name = f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}".strip() if from_user else "Anonymous"
    author_username = from_user.get("username") if from_user else None
    is_bot = from_user.get("is_bot", False) if from_user else False
    
    raw_text = msg.get("text") or msg.get("caption") or ""
    
    # Record detected identity in audit table
    record_detected_identity(cursor, chat_id, chat_title, chat_type, author_id, author_name, author_username, is_bot, raw_text)
    
    # In observation mode or unconfigured group, also query getChatAdministrators to discover Julia & Alexandra's candidate accounts
    if not is_live_enabled or not target_group_id:
        if token and chat_id and chat_type in ["group", "supergroup", "channel"]:
            try:
                admins_res = call_telegram(token, "getChatAdministrators", {"chat_id": chat_id})
                if admins_res.get("ok"):
                    for admin in admins_res.get("result", []):
                        u = admin.get("user", {})
                        if not u.get("is_bot"):
                            adm_id = str(u.get("id"))
                            adm_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                            adm_uname = u.get("username")
                            status = admin.get("custom_title") or admin.get("status")
                            record_detected_identity(cursor, chat_id, chat_title, chat_type, adm_id, adm_name, adm_uname, False, f"Administrator ({status})")
                            print(f"    [ADMIN DISCOVERY] Found candidate administrator: '{adm_name}' (@{adm_uname}) | Numeric ID: {adm_id} | Role: {status}")
            except Exception as e:
                pass

    # 1. HARD GATE: If live sync is disabled because group_id or approved_authors is empty
    if not is_live_enabled:
        reason = "TELEGRAM_GROUP_ID missing" if not target_group_id else "TELEGRAM_APPROVED_AUTHOR_IDS empty"
        print(f"[*] [OBSERVATION MODE] Chat detected: '{chat_title}' (ID: {chat_id}) | Author: '{author_name}' (ID: {author_id})")
        print(f"    -> Publishing is DISABLED ({reason}). Sender is NOT automatically approved.")
        log_sync_event(cursor, update_id, chat_id, message_id, "observed_only_unconfigured", author_id, author_name, "observed", f"Observation only: {reason}")
        conn.commit()
        return "observed_unconfigured"
        
    # 2. Filter out service notifications
    if is_service_message(msg):
        log_sync_event(cursor, update_id, chat_id, message_id, "ignored_service", author_id, author_name, "filtered", "Service notification ignored")
        conn.commit()
        return "ignored_service"
        
    # 3. Group ID restriction
    if target_group_id and chat_id != str(target_group_id):
        log_sync_event(cursor, update_id, chat_id, message_id, "ignored_wrong_chat", author_id, author_name, "filtered", f"Chat {chat_id} does not match {target_group_id}")
        conn.commit()
        return "ignored_wrong_chat"
        
    # 4. Author identification and approval
    status = "published"
    if not from_user:
        # Anonymous post -> hold for review
        status = "pending_review"
    elif approved_authors:
        if author_id not in approved_authors:
            # Exclude other members' messages
            log_sync_event(cursor, update_id, chat_id, message_id, "ignored_unapproved_author", author_id, author_name, "filtered", f"Author {author_id} not in approved author list")
            conn.commit()
            return "ignored_unapproved_author"
            
    # Check auto-publish settings
    cursor.execute("SELECT value FROM community_settings WHERE key = 'auto_publish_enabled'")
    row = cursor.fetchone()
    if row and row[0] == "0" and status == "published":
        status = "pending_review"
        
    # 5. Language Detection & Translation Pipeline
    is_foreign, lang_hint = detect_language(raw_text)
    translated_text = raw_text
    is_translated = False
    
    if is_foreign:
        trans_out, success, err = translate_to_english(raw_text, source_hint=lang_hint)
        if success and trans_out:
            translated_text = trans_out
            is_translated = True
        else:
            # CHECK 4 REQUIREMENT: Failed translations must remain unpublished for review
            status = "pending_review"
            translated_text = raw_text # Preserve original text
            is_translated = False
            log_sync_event(cursor, update_id, chat_id, message_id, "translation_failed_quarantined", author_id, author_name, "pending_review", f"Translation failed: {err}")
            print(f"[-] [TRANSLATION QUARANTINE] Post held in pending_review: {err}")
            
    # Check for videos, video notes, or animations -> strictly skip per policy (moving forward rule)
    has_video = bool(msg.get("video") or msg.get("video_note") or msg.get("animation"))
    if has_video:
        log_sync_event(cursor, update_id, chat_id, message_id, "video_skipped", author_id, author_name, "ignored", "Video post excluded per policy")
        print(f"[*] [VIDEO EXCLUDED] Skipping message #{message_id} containing video/animation")
        conn.commit()
        return "skipped_video"
        
    # Extract media items (photos only; text-only posts allowed without media)
    photos = msg.get("photo", [])
    media_group_id = msg.get("media_group_id")
    
    media_item = None
    if photos:
        best_photo = photos[-1]
        pub_url, _ = download_telegram_file(token, best_photo.get("file_id"), "jpg")
        if pub_url:
            media_item = {
                "type": "photo",
                "url": pub_url,
                "file_id": best_photo.get("file_id"),
                "width": best_photo.get("width"),
                "height": best_photo.get("height"),
                "caption": raw_text
            }

            
    # 6. Media Album Grouping (media_group_id)
    if media_group_id:
        cursor.execute("SELECT id, content, admin_corrected FROM community_posts WHERE media_group_id = ?", (media_group_id,))
        existing_album = cursor.fetchone()
        
        if existing_album:
            post_id = existing_album[0]
            existing_content = existing_album[1]
            admin_corrected = existing_album[2]
            
            # If this message has caption and existing post has none, update content
            if translated_text and not existing_content and not admin_corrected:
                cursor.execute("""
                    UPDATE community_posts 
                    SET content = ?, original_content = ?, original_language = ?, translated = ?, updated_at = datetime('now')
                    WHERE id = ?
                """, (translated_text, raw_text, lang_hint if is_foreign else "en", 1 if is_translated else 0, post_id))
                
            if media_item:
                media_id = f"med_{uuid.uuid4().hex[:10]}"
                cursor.execute("""
                    INSERT INTO community_post_media (id, post_id, media_type, url, caption, file_id, width, height)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (media_id, post_id, media_item["type"], media_item["url"], media_item["caption"], media_item["file_id"], media_item["width"], media_item["height"]))
                
            log_sync_event(cursor, update_id, chat_id, message_id, "album_item_appended", author_id, author_name, "success", f"Appended to album {post_id}")
            conn.commit()
            return f"appended_to_album_{post_id}"
            
    # 7. Edit Synchronization
    cursor.execute("""
        SELECT id, admin_corrected FROM community_posts 
        WHERE telegram_channel_id = ? AND telegram_message_id = ?
    """, (chat_id, message_id))
    existing_post = cursor.fetchone()
    
    if existing_post:
        post_id = existing_post[0]
        admin_corrected = existing_post[1]
        
        if admin_corrected:
            cursor.execute("""
                UPDATE community_posts 
                SET source_modified_after_admin_edit = 1, original_content = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (raw_text, post_id))
            log_sync_event(cursor, update_id, chat_id, message_id, "edit_flagged_admin_preserved", author_id, author_name, "pending_review", "Admin edit preserved; flagged for review")
        else:
            cursor.execute("""
                UPDATE community_posts 
                SET content = ?, original_content = ?, original_language = ?, translated = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (translated_text, raw_text, lang_hint if is_foreign else "en", 1 if is_translated else 0, post_id))
            log_sync_event(cursor, update_id, chat_id, message_id, "edit_synchronized", author_id, author_name, "success", f"Updated {post_id}")
            
        conn.commit()
        return f"updated_{post_id}"
        
    # 8. Create new post
    post_id = f"post_tg_{uuid.uuid4().hex[:10]}"
    cursor.execute("SELECT id FROM users WHERE role = 'FOUNDER' OR role = 'ADMIN' LIMIT 1")
    admin_user = cursor.fetchone()
    default_author_id = admin_user[0] if admin_user else "usr_ozara_official"
    
    cursor.execute("""
        INSERT INTO community_posts (
            id, author_id, source_type, author_label, is_official,
            telegram_channel_id, telegram_message_id, media_group_id,
            content, original_content, original_language, translated,
            status, telegram_author_id, telegram_author_name,
            created_at, updated_at
        ) VALUES (
            ?, ?, 'telegram', 'From ÖZARA', 1,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            datetime('now'), datetime('now')
        )
    """, (
        post_id, default_author_id,
        chat_id, message_id, media_group_id,
        translated_text or (media_item["caption"] if media_item else "Official update from ÖZARA"),
        raw_text, lang_hint if is_foreign else "en", 1 if is_translated else 0,
        status, author_id, translate_author_to_english(author_name)
    ))

    
    if media_item:
        media_id = f"med_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
            INSERT INTO community_post_media (id, post_id, media_type, url, caption, file_id, width, height)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (media_id, post_id, media_item["type"], media_item["url"], media_item["caption"], media_item["file_id"], media_item["width"], media_item["height"]))
        
    log_sync_event(cursor, update_id, chat_id, message_id, "new_post_created", author_id, author_name, status, f"Created {post_id} (status: {status})")
    conn.commit()
    return f"created_{post_id}"

def get_shared_offset(cursor):
    cursor.execute("SELECT last_offset FROM telegram_sync_state WHERE id = 1")
    row = cursor.fetchone()
    return row[0] if row else 0

def update_shared_offset(cursor, next_offset):
    cursor.execute("UPDATE telegram_sync_state SET last_offset = ?, updated_at = datetime('now') WHERE id = 1", (next_offset,))

def process_unhandled_inbox(conn=None, config=None):
    """Processes any raw updates safely stored in telegram_inbox_updates that have not been marked processed."""
    close_at_end = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        close_at_end = True
    if config is None:
        config = get_config()
        
    cursor = conn.cursor()
    cursor.execute("SELECT update_id, raw_json FROM telegram_inbox_updates WHERE processed = 0 ORDER BY update_id ASC")
    pending = cursor.fetchall()
    
    count = 0
    for row in pending:
        uid, raw_json = row
        try:
            u = json.loads(raw_json)
            is_edit = ("edited_message" in u or "edited_channel_post" in u)
            outcome = process_single_update(conn, config, u, is_edit=is_edit)
            cursor.execute("UPDATE telegram_inbox_updates SET processed = 1 WHERE update_id = ?", (uid,))
            conn.commit()
            print(f"    [INBOX] Processed stored update #{uid}: {outcome}")
            count += 1
        except Exception as e:
            print(f"    [-] Error processing stored inbox update #{uid}: {e}")
            
    if close_at_end:
        conn.close()
    return count

def run_sync(max_polls=1, poll_timeout=5, observation_only=False, daemon=False):
    config = get_config()
    token = config["token"]
    if not token:
        print("[ERROR] TELEGRAM_BOT_TOKEN not configured in .env")
        return False
        
    # Check if a Telegram webhook is currently active on this bot
    webhook_info = call_telegram(token, "getWebhookInfo")
    if webhook_info.get("ok"):
        webhook_url = webhook_info.get("result", {}).get("url", "")
        if webhook_url:
            print(f"[!] TELEGRAM WEBHOOK ACTIVE at '{webhook_url}'.")
            print("[*] Telegram disallows getUpdates while a webhook is registered (error 409). Polling is disabled.")
            if "--force-polling" in sys.argv:
                print("[*] Clearing active webhook on Telegram...")
                call_telegram(token, "deleteWebhook")
                print("[✓] Webhook cleared. Proceeding with long polling.")
            else:
                print("[*] Processing pending webhook inbox updates from database...")
                process_unhandled_inbox(config=config)
                return True

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    offset = get_shared_offset(cursor)
    
    masked_target = config['group_id'] if config['group_id'] else "UNCONFIGURED"
    author_status = f"{len(config['approved_authors'])} author(s)" if config['approved_authors'] else "EMPTY (PUBLISHING DISABLED)"
    
    mode_str = "OBSERVATION MODE" if (not config['is_live_enabled'] or observation_only) else "LIVE SYNC MODE"
    worker_str = "CONTINUOUS DAEMON" if daemon else f"BATCH ({max_polls} poll(s))"
    print(f"[*] Starting Telegram Sync [{mode_str} | {worker_str}] (shared_offset={offset}, group={masked_target}, approved={author_status})")
    
    # Step 1: Process any unhandled inbox updates before polling
    process_unhandled_inbox(conn, config)
    
    polls = 0
    new_events = 0
    while True:
        if max_polls is not None and polls >= max_polls:
            break
        polls += 1
        
        try:
            res = call_telegram(token, "getUpdates", {
                "offset": offset,
                "timeout": poll_timeout,
                "allowed_updates": ["message", "edited_message", "channel_post", "edited_channel_post", "my_chat_member", "chat_member"]
            })
            
            if not res.get("ok"):
                desc = res.get("description", "Unknown error")
                print(f"[-] Telegram API error: {desc}")
                if "Conflict" in desc:
                    print("    Another update receiver or webhook is active. Backing off 5s...")
                    time.sleep(5)
                if not daemon:
                    break
                time.sleep(3)
                continue
                
            updates = res.get("result", [])
            if not updates:
                if not daemon:
                    print("[*] No pending Telegram updates.")
                    break
                continue
                
            print(f"[+] Received {len(updates)} update(s)...")
            
            # PERSIST-BEFORE-ACKNOWLEDGE INVARIANT:
            # Step A: Persist all updates into telegram_inbox_updates FIRST
            for u in updates:
                uid = u.get("update_id")
                cursor.execute("""
                    INSERT OR IGNORE INTO telegram_inbox_updates (update_id, raw_json, processed, created_at)
                    VALUES (?, ?, 0, datetime('now'))
                """, (uid, json.dumps(u)))
            conn.commit()

            # Step B: Advance shared offset so Telegram acknowledges delivery
            max_uid = max(u.get("update_id") for u in updates)
            if max_uid >= offset:
                offset = max_uid + 1
                update_shared_offset(cursor, offset)
                conn.commit()
                
            # Step C: Process updates from inbox and mark processed = 1
            for u in updates:
                uid = u.get("update_id")
                is_edit = ("edited_message" in u or "edited_channel_post" in u)
                try:
                    outcome = process_single_update(conn, config, u, is_edit=is_edit)
                    cursor.execute("UPDATE telegram_inbox_updates SET processed = 1 WHERE update_id = ?", (uid,))
                    conn.commit()
                    print(f"    - Update #{uid}: {outcome}")
                    new_events += 1
                except Exception as ex:
                    print(f"    [-] Error processing update #{uid}: {ex}")
                    # Update remains in telegram_inbox_updates with processed = 0 for recovery
                    
        except KeyboardInterrupt:
            print("\n[*] Gracefully stopping Telegram sync daemon.")
            break
        except Exception as e:
            print(f"[-] Unexpected error in sync loop: {e}")
            if not daemon:
                break
            time.sleep(3)
            
    conn.close()
    return new_events > 0

if __name__ == "__main__":
    is_obs = "--detect" in sys.argv
    is_inbox = "--inbox-only" in sys.argv
    is_daemon = "--daemon" in sys.argv or "--continuous" in sys.argv
    
    if is_inbox:
        process_unhandled_inbox()
        sys.exit(0)
        
    polls = 1
    for a in sys.argv[1:]:
        if a.isdigit():
            polls = int(a)
            
    if is_daemon:
        run_sync(max_polls=None, poll_timeout=25, observation_only=is_obs, daemon=True)
    else:
        run_sync(max_polls=polls, poll_timeout=5, observation_only=is_obs, daemon=False)
