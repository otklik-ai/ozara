#!/usr/bin/env python3
"""
tools/migrate_community_and_locations.py
Deterministic SQLite migration for ÖZARA Community Wall & Member Location Fix.
1. Creates community_posts and community_comments tables.
2. Fixes Elena Alexeeva (usr_muwksc1i) chapter decoupling and anchors to Seattle, United States.
3. Purges unconfirmed venue/club claims from chapters table (e.g. The Arts Club Dubai).
4. Seeds initial realistic community posts and replies.
"""

import sqlite3
import os
import sys

DATABASES = ["ozara.db", "sila.db"]

def migrate_database(db_path):
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist, skipping.")
        return

    print(f"Migrating {db_path}...")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Create community_posts table
    c.execute("""
    CREATE TABLE IF NOT EXISTS community_posts (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id)")

    # 2. Create community_comments table
    c.execute("""
    CREATE TABLE IF NOT EXISTS community_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at ASC)")

    # 3. Fix Elena Alexeeva (usr_muwksc1i) location & chapter
    # Decouple from ch_dubai so she is firmly based in Seattle, United States
    c.execute("""
    UPDATE users 
    SET chapter_id = 'ch_silicon_valley',
        city = 'Seattle',
        country = 'United States'
    WHERE id = 'usr_muwksc1i' OR LOWER(email) = 'elenaualexeeva@gmail.com'
    """)
    print(f"Updated Elena Alexeeva chapter & location in {db_path}. Rows affected: {c.rowcount}")

    # 4. Purge unconfirmed venue & partnership claims from chapters table
    # Check if gathering_place_name column exists
    c.execute("PRAGMA table_info(chapters)")
    cols = [row[1] for row in c.fetchall()]
    if "gathering_place_name" in cols:
        c.execute("""
        UPDATE chapters
        SET gathering_place_name = NULL,
            gathering_place_photo = NULL,
            gathering_place_description = NULL
        """)
        print(f"Purged unconfirmed venue claims from chapters in {db_path}. Rows affected: {c.rowcount}")

    # 5. Seed initial realistic posts if empty
    c.execute("SELECT COUNT(*) FROM community_posts")
    posts_count = c.fetchone()[0]
    if posts_count == 0:
        # Check if Elena Ermolov or Marcus exists
        c.execute("SELECT id FROM users WHERE id = 'usr_elena' OR LOWER(email) = 'ermolov.elena@gmail.com'")
        elena_row = c.fetchone()
        elena_id = elena_row[0] if elena_row else "usr_elena"

        c.execute("SELECT id FROM users WHERE id = 'usr_muwksc1i' OR LOWER(email) = 'elenaualexeeva@gmail.com'")
        alexeeva_row = c.fetchone()
        alexeeva_id = alexeeva_row[0] if alexeeva_row else "usr_muwksc1i"

        c.execute("SELECT id FROM users WHERE id = 'usr_1001' OR LOWER(email) = 'marcus.vance@techventures.co'")
        marcus_row = c.fetchone()
        marcus_id = marcus_row[0] if marcus_row else "usr_1001"

        posts = [
            (
                "post_seed_001",
                elena_id,
                "Question",
                "Looking to connect with founders navigating UAE Virtual Asset Regulatory Authority (VARA) licensing. Anyone with direct operational experience willing to share 15 minutes of insight?",
                "2026-10-08 12:00:00",
                "2026-10-08 12:00:00"
            ),
            (
                "post_seed_002",
                alexeeva_id,
                "Expertise",
                "Just wrapped up an architecture review on streaming ETL and model pipelines at scale. If any member teams are optimizing data latency or vector store retrieval costs, feel free to reach out.",
                "2026-10-08 13:30:00",
                "2026-10-08 13:30:00"
            ),
            (
                "post_seed_003",
                marcus_id,
                "Introduction",
                "Spending next month in London and looking to connect with enterprise operators working on GPU compute clusters and sovereign AI infrastructure.",
                "2026-10-08 14:15:00",
                "2026-10-08 14:15:00"
            )
        ]

        c.executemany("""
        INSERT INTO community_posts (id, author_id, topic, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, posts)
        print(f"Seeded {len(posts)} community posts in {db_path}.")

        # Seed sample comment
        comments = [
            (
                "comm_seed_001",
                "post_seed_001",
                alexeeva_id,
                "Happy to connect you with our regulatory counsel who recently completed a VARA submission. Drop me a note whenever suits.",
                "2026-10-08 12:35:00",
                "2026-10-08 12:35:00"
            )
        ]
        c.executemany("""
        INSERT INTO community_comments (id, post_id, author_id, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, comments)
        print(f"Seeded {len(comments)} community comments in {db_path}.")

    conn.commit()
    conn.close()
    print(f"Migration completed for {db_path} successfully.")

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for db in DATABASES:
        p = os.path.join(base_dir, db)
        migrate_database(p)

if __name__ == "__main__":
    main()
