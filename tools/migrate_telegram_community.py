#!/usr/bin/env python3
"""
Migration: Telegram Community Integration & Media Albums
Extends community_posts and creates community_post_media, telegram_sync_logs, and community_settings.
Applies to both ozara.db and sila.db (if present).
"""

import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILES = ["ozara.db", "sila.db"]

def migrate_db(db_name):
    db_path = os.path.join(BASE_DIR, db_name)
    if not os.path.exists(db_path):
        print(f"[-] {db_name} does not exist, skipping.")
        return
        
    print(f"[*] Migrating {db_name}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Check existing columns in community_posts
    cursor.execute("PRAGMA table_info(community_posts)")
    existing_cols = {row[1]: row for row in cursor.fetchall()}
    
    new_cols = [
        ("source_type", "TEXT DEFAULT 'member'"),
        ("author_label", "TEXT"),
        ("is_official", "INTEGER DEFAULT 0"),
        ("telegram_channel_id", "TEXT"),
        ("telegram_message_id", "INTEGER"),
        ("media_group_id", "TEXT"),
        ("original_content", "TEXT"),
        ("original_language", "TEXT"),
        ("translated", "INTEGER DEFAULT 0"),
        ("admin_corrected", "INTEGER DEFAULT 0"),
        ("source_modified_after_admin_edit", "INTEGER DEFAULT 0"),
        ("status", "TEXT DEFAULT 'published'"),
        ("telegram_author_id", "TEXT"),
        ("telegram_author_name", "TEXT")
    ]
    
    for col_name, col_def in new_cols:
        if col_name not in existing_cols:
            print(f"    + Adding column {col_name} to community_posts")
            cursor.execute(f"ALTER TABLE community_posts ADD COLUMN {col_name} {col_def}")
            
    # Index on telegram_channel_id and telegram_message_id
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_community_posts_tg 
        ON community_posts(telegram_channel_id, telegram_message_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_community_posts_status
        ON community_posts(status, created_at DESC)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_community_posts_source
        ON community_posts(source_type, created_at DESC)
    """)
    
    # 2. Table: community_post_media
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS community_post_media (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
            media_type TEXT NOT NULL,
            url TEXT NOT NULL,
            thumbnail_url TEXT,
            caption TEXT,
            file_id TEXT,
            order_index INTEGER DEFAULT 0,
            width INTEGER,
            height INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_post_media_post 
        ON community_post_media(post_id, order_index ASC)
    """)
    
    # 3. Table: telegram_sync_logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telegram_sync_logs (
            id TEXT PRIMARY KEY,
            update_id INTEGER,
            chat_id TEXT,
            message_id INTEGER,
            event_type TEXT,
            author_id TEXT,
            author_name TEXT,
            status TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_tg_sync_logs_created 
        ON telegram_sync_logs(created_at DESC)
    """)
    
    # 4. Table: community_settings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS community_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO community_settings (key, value)
        VALUES ('auto_publish_enabled', '1')
    """)
    
    conn.commit()
    conn.close()
    print(f"[✓] {db_name} migration complete.")

def main():
    print("==========================================================")
    print("RUNNING TELEGRAM COMMUNITY MIGRATION")
    print("==========================================================")
    for db in DB_FILES:
        migrate_db(db)
    print("==========================================================")
    print("ALL MIGRATIONS EXECUTED SUCCESSFULLY.")
    print("==========================================================")

if __name__ == "__main__":
    main()
