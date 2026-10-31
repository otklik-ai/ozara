#!/usr/bin/env python3
"""
Tool: Extract Telegram History Posts (Unfiltered & Original Language)
Location: tools/extract_telegram_posts.py

Extracts the 10 most recent posts from Telegram Desktop HTML export:
- Zero content filters: Includes text-only, photo albums, videos, documents, etc.
- Zero language modification: Preserves exact original text (Russian / Cyrillic) as written.
- Groups joined album messages (e.g. multi-photo albums) into single unified posts.
- Supports both previewing and direct insertion into community_posts.
"""

import os
import sys
import re
import json
import uuid
import shutil
import sqlite3
from datetime import datetime
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILES = ["ozara.db", "sila.db"]
DEFAULT_EXPORT_DIR = "/Users/bikram6am/Downloads/ChatExport_Julia & Alexandra _ Сила Связей"
MEDIA_STORAGE_DIR = os.path.join(BASE_DIR, "storage", "telegram_media")

os.makedirs(MEDIA_STORAGE_DIR, exist_ok=True)

MONTH_MAP = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12
}

def parse_telegram_date(date_str):
    if not date_str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    clean = date_str.strip()
    m = re.match(r'(\d+)\s+([A-Za-zА-Яа-я]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})', clean)
    if m:
        day = int(m.group(1))
        month_name = m.group(2)
        year = int(m.group(3))
        hour = int(m.group(4))
        minute = int(m.group(5))
        second = int(m.group(6))
        month = MONTH_MAP.get(month_name, 1)
        return f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def parse_clusters(export_dir):
    html_path = os.path.join(export_dir, "messages.html")
    if not os.path.exists(html_path):
        raise FileNotFoundError(f"messages.html not found in {export_dir}")

    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    msgs = soup.find_all("div", class_="message")

    clusters = []
    curr = None

    for m in msgs:
        classes = m.get("class", [])
        if "service" in classes:
            continue

        mid = m.get("id")
        fn = m.find("div", class_="from_name")
        date_el = m.find("div", class_="date")
        date_title = date_el.get("title") if date_el else ""

        # Photos
        photo_wraps = m.find_all("a", class_="photo_wrap")
        photos = [a.get("href") for a in photo_wraps if a.get("href")]

        # Videos
        video_wraps = m.find_all("a", class_="video_file_wrap") or m.find_all("div", class_="media_video")
        videos = [a.get("href", "") for a in video_wraps if a.get("href")]

        # Files / Documents
        file_wraps = m.find_all("div", class_="media_document")
        file_links = []
        for fw in file_wraps:
            a = fw.find("a")
            if a and a.get("href"):
                file_links.append(a.get("href"))

        txt_el = m.find("div", class_="text")
        text = txt_el.text.strip() if txt_el else ""

        is_joined = "joined" in classes
        author = fn.text.strip() if fn else None

        if is_joined and curr:
            curr["messages"].append(mid)
            curr["photos"].extend(photos)
            curr["videos"].extend(videos)
            curr["files"].extend(file_links)
            if text and not curr["text"]:
                curr["text"] = text
        else:
            curr = {
                "id": mid,
                "messages": [mid],
                "author": author or (curr["author"] if curr else "Unknown"),
                "date": date_title,
                "iso_date": parse_telegram_date(date_title),
                "photos": list(photos),
                "videos": list(videos),
                "files": list(file_links),
                "text": text
            }
            clusters.append(curr)

    return clusters

def extract_posts(export_dir=DEFAULT_EXPORT_DIR, limit=10, founders_only=False):
    clusters = parse_clusters(export_dir)

    if founders_only:
        filtered = [
            c for c in clusters
            if any(name in c["author"] for name in ["Юлия", "Julia", "Alexandra", "Александра"])
        ]
    else:
        filtered = clusters

    # Only include clusters that have text or media
    valid = [c for c in filtered if c["text"] or c["photos"] or c["videos"] or c["files"]]

    # Return newest first
    return valid[-limit:][::-1]

def copy_media_files(posts, export_dir=DEFAULT_EXPORT_DIR):
    media_map = {}
    for p in posts:
        media_records = []
        order_idx = 0
        
        # Photos
        for rel_path in p["photos"]:
            src = os.path.join(export_dir, rel_path)
            if os.path.exists(src):
                ext = rel_path.split(".")[-1] if "." in rel_path else "jpg"
                dest_filename = f"tg_{p['id']}_{order_idx}_{uuid.uuid4().hex[:6]}.{ext}"
                dest_path = os.path.join(MEDIA_STORAGE_DIR, dest_filename)
                shutil.copy2(src, dest_path)
                pub_url = f"/storage/telegram_media/{dest_filename}"
                media_records.append({
                    "id": f"cpm_{uuid.uuid4().hex[:10]}",
                    "type": "photo",
                    "url": pub_url,
                    "order": order_idx
                })
                order_idx += 1

        # Videos
        for rel_path in p["videos"]:
            src = os.path.join(export_dir, rel_path)
            if os.path.exists(src):
                ext = rel_path.split(".")[-1] if "." in rel_path else "mp4"
                dest_filename = f"tg_{p['id']}_vid_{order_idx}_{uuid.uuid4().hex[:6]}.{ext}"
                dest_path = os.path.join(MEDIA_STORAGE_DIR, dest_filename)
                shutil.copy2(src, dest_path)
                pub_url = f"/storage/telegram_media/{dest_filename}"
                media_records.append({
                    "id": f"cpm_{uuid.uuid4().hex[:10]}",
                    "type": "video",
                    "url": pub_url,
                    "order": order_idx
                })
                order_idx += 1

        media_map[p["id"]] = media_records
    return media_map

def import_to_database(posts, export_dir=DEFAULT_EXPORT_DIR):
    media_map = copy_media_files(posts, export_dir)
    total_imported = 0

    for db_name in DB_FILES:
        db_path = os.path.join(BASE_DIR, db_name)
        if not os.path.exists(db_path):
            continue

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE role IN ('FOUNDER', 'ADMIN') LIMIT 1")
        admin_row = cursor.fetchone()
        default_author_id = admin_row[0] if admin_row else "usr_ozara_official"

        inserted_in_db = 0
        for p in posts:
            post_id = f"post_tg_{p['id'].replace('message', '')}"
            cursor.execute("SELECT id FROM community_posts WHERE id = ?", (post_id,))
            if cursor.fetchone():
                continue

            raw_author = p["author"]
            if "Юлия" in raw_author or "Julia" in raw_author:
                author_display = "Julia Shchukina | Founder"
            elif "Александра" in raw_author or "Alexandra" in raw_author:
                author_display = "Alexandra Hill | Founder"
            elif "Светлана" in raw_author:
                author_display = "Svetlana Chukanova | ÖZARA Team"
            elif "Boris" in raw_author or "Борис" in raw_author:
                author_display = "Boris Kiuchukov | Member"
            else:
                author_display = raw_author

            content_text = p["text"] or ("Photo update" if p["photos"] else "Video update")
            cursor.execute("""
                INSERT INTO community_posts (
                    id, author_id, source_type, author_label, is_official,
                    telegram_channel_id, telegram_message_id,
                    content, original_content, original_language, translated,
                    status, telegram_author_name,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, 'telegram', 'From ÖZARA', 1,
                    'telegram_history', ?,
                    ?, ?, 'ru', 0,
                    'published', ?,
                    ?, ?
                )
            """, (
                post_id,
                default_author_id,
                int(p['id'].replace('message', '')) if p['id'].replace('message', '').isdigit() else None,
                content_text,
                p["text"],
                author_display,
                p["iso_date"],
                p["iso_date"]
            ))

            for m in media_map.get(p["id"], []):
                cursor.execute("""
                    INSERT INTO community_post_media (id, post_id, media_type, url, order_index)
                    VALUES (?, ?, ?, ?, ?)
                """, (m["id"], post_id, m["type"], m["url"], m["order"]))

            inserted_in_db += 1

        conn.commit()
        conn.close()
        print(f"[✓] {db_name}: Imported {inserted_in_db} posts.")
        if db_name == "ozara.db":
            total_imported = inserted_in_db

    return total_imported

if __name__ == "__main__":
    founders = "--founders" in sys.argv or "--founders-only" in sys.argv
    do_import = "--import" in sys.argv
    as_json = "--json" in sys.argv

    limit = 10
    for arg in sys.argv[1:]:
        if arg.isdigit():
            limit = int(arg)

    posts = extract_posts(limit=limit, founders_only=founders)

    if as_json:
        print(json.dumps(posts, ensure_ascii=False, indent=2))
        sys.exit(0)

    mode_label = "Founders Only (Julia & Alexandra)" if founders else "All Channel Senders (Option A)"
    print("\n" + "="*80)
    print(f" EXTRACTED {len(posts)} LAST TELEGRAM POSTS (UNFILTERED, ORIGINAL LANGUAGE)")
    print(f" Source: {DEFAULT_EXPORT_DIR}")
    print(f" Mode: {mode_label}")
    print("="*80 + "\n")

    for i, p in enumerate(posts, 1):
        print(f"--- #{i} [{p['id']}] ---")
        print(f"Author:   {p['author']}")
        print(f"Date:     {p['date']} (ISO: {p['iso_date']})")
        print(f"Media:    Photos: {len(p['photos'])} | Videos: {len(p['videos'])} | Files: {len(p['files'])}")
        print("Original Text:")
        if p['text']:
            lines = p['text'].split("\n")
            for line in lines[:4]:
                print(f"  {line}")
            if len(lines) > 4:
                print(f"  ... (+ {len(lines) - 4} more lines)")
        else:
            print("  (Media-only post, no caption)")
        print()

    if do_import:
        print("\n[*] Importing extracted posts directly into community_posts...")
        count = import_to_database(posts)
        print(f"[✓] Done. Successfully imported {count} posts into the feed.")
