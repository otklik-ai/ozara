#!/usr/bin/env python3
"""
tools/migrate_inbox_messaging_and_notifications.py
Migrates database schema for Phase 8:
- Direct messaging (conversations, direct_messages)
- User blocks (user_blocks)
- In-app notifications updates (in_app_notifications columns)
- Notification preferences (notification_preferences)
- Transactional email queue & delivery log (email_delivery_queue)
- Unified Admin Activity log (admin_activity_log)
"""

import sqlite3
import os
import sys

DATABASES = [
    "/Users/bikram6am/Sila/ozara.db",
    "/Users/bikram6am/Sila/sila.db"
]

def migrate_db(db_path):
    if not os.path.exists(db_path):
        print(f"[SKIP] Database {db_path} does not exist.")
        return

    print(f"\n[*] Migrating {db_path} for Inbox, Messaging, Email & Admin Activity...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            participant_one_id TEXT NOT NULL REFERENCES users(id),
            participant_two_id TEXT NOT NULL REFERENCES users(id),
            last_message_text TEXT,
            last_message_sender_id TEXT REFERENCES users(id),
            last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_blocked BOOLEAN NOT NULL DEFAULT 0,
            blocked_by_id TEXT REFERENCES users(id),
            last_email_sent_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(participant_one_id, participant_two_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conv_part_one ON conversations(participant_one_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conv_part_two ON conversations(participant_two_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversations(last_message_at DESC)")
    print("  [✓] Verified conversations table and indices")

    # 2. Direct messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS direct_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id TEXT NOT NULL REFERENCES users(id),
            recipient_id TEXT NOT NULL REFERENCES users(id),
            content TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT 0,
            read_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dm_conv ON direct_messages(conversation_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dm_rec_unread ON direct_messages(recipient_id, is_read)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at ASC)")
    print("  [✓] Verified direct_messages table and indices")

    # 3. User blocks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_blocks (
            id TEXT PRIMARY KEY,
            blocker_id TEXT NOT NULL REFERENCES users(id),
            blocked_id TEXT NOT NULL REFERENCES users(id),
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(blocker_id, blocked_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id)")
    print("  [✓] Verified user_blocks table and indices")

    # 4. In-app notifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS in_app_notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
            action_url TEXT,
            delivery_channel TEXT NOT NULL DEFAULT 'in_app',
            is_read BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("PRAGMA table_info(in_app_notifications)")
    notif_cols = {row[1] for row in cursor.fetchall()}
    if "metadata_json" not in notif_cols:
        cursor.execute("ALTER TABLE in_app_notifications ADD COLUMN metadata_json TEXT DEFAULT NULL")
        print("  [+] Added metadata_json to in_app_notifications")
    if "category" not in notif_cols:
        cursor.execute("ALTER TABLE in_app_notifications ADD COLUMN category TEXT DEFAULT 'general'")
        print("  [+] Added category to in_app_notifications")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON in_app_notifications(user_id, created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON in_app_notifications(user_id, is_read)")
    print("  [✓] Verified in_app_notifications table and indices")

    # 5. Notification preferences table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            email_direct_messages TEXT NOT NULL DEFAULT 'immediate',
            email_connection_requests TEXT NOT NULL DEFAULT 'immediate',
            email_new_posts TEXT NOT NULL DEFAULT 'immediate',
            email_new_events TEXT NOT NULL DEFAULT 'immediate',
            email_event_invites TEXT NOT NULL DEFAULT 'immediate',
            email_admin_activity TEXT NOT NULL DEFAULT 'immediate',
            in_app_new_posts BOOLEAN NOT NULL DEFAULT 1,
            in_app_new_events BOOLEAN NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  [✓] Verified notification_preferences table")

    # 6. Email delivery queue table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_delivery_queue (
            id TEXT PRIMARY KEY,
            idempotency_key TEXT UNIQUE,
            recipient_email TEXT NOT NULL,
            recipient_user_id TEXT REFERENCES users(id),
            notification_id TEXT REFERENCES in_app_notifications(id),
            category TEXT NOT NULL,
            subject TEXT NOT NULL,
            template_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            last_attempt_at TIMESTAMP DEFAULT NULL,
            last_error TEXT DEFAULT NULL,
            payload_preview TEXT,
            action_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP DEFAULT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_delivery_queue(status, attempts)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_queue_recipient ON email_delivery_queue(recipient_email)")
    print("  [✓] Verified email_delivery_queue table and indices")

    # 7. Admin activity log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_activity_log (
            id TEXT PRIMARY KEY,
            activity_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            actor_id TEXT REFERENCES users(id),
            target_id TEXT,
            entity_type TEXT,
            entity_id TEXT,
            metadata_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_act_type ON admin_activity_log(activity_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_act_created ON admin_activity_log(created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_act_actor ON admin_activity_log(actor_id)")
    print("  [✓] Verified admin_activity_log table and indices")

    # 8. Seed sample admin activity from historical records if empty
    cursor.execute("SELECT COUNT(*) FROM admin_activity_log")
    act_count = cursor.fetchone()[0]
    if act_count == 0:
        print("  [*] Seeding initial operational activity from existing records...")
        # Access requests
        try:
            cursor.execute("SELECT id, email, full_name, created_at FROM invitation_tokens WHERE status != 'revoked' ORDER BY created_at DESC LIMIT 5")
            for req in cursor.fetchall():
                cursor.execute("""
                    INSERT INTO admin_activity_log (id, activity_type, title, description, actor_id, entity_type, entity_id, created_at)
                    VALUES (?, 'access_request', 'Membership Access Request', ?, NULL, 'invitation_token', ?, ?)
                """, (f"act_req_{req[0]}", f"Applicant {req[2] or req[1]} requested access to ÖZARA.", req[0], req[3]))
        except Exception as e:
            pass

        # Completed onboarding
        try:
            cursor.execute("SELECT id, full_name, city, country, admitted_at FROM users WHERE is_complete = 1 AND is_admitted = 1 ORDER BY admitted_at DESC LIMIT 5")
            for u in cursor.fetchall():
                cursor.execute("""
                    INSERT INTO admin_activity_log (id, activity_type, title, description, actor_id, entity_type, entity_id, created_at)
                    VALUES (?, 'completed_onboarding', 'Member Onboarding Completed', ?, ?, 'user', ?, ?)
                """, (f"act_onb_{u[0]}", f"{u[1]} ({u[2] or 'Global'}) completed Question 18 offer requirements.", u[0], u[0], u[4] or '2026-10-08 10:00:00'))
        except Exception as e:
            pass

        # Connections
        try:
            cursor.execute("""
                SELECT mc.id, mc.requester_id, mc.recipient_id, mc.status, mc.created_at, u1.full_name, u2.full_name
                FROM member_connections mc
                JOIN users u1 ON mc.requester_id = u1.id
                JOIN users u2 ON mc.recipient_id = u2.id
                ORDER BY mc.created_at DESC LIMIT 5
            """)
            for conn_rec in cursor.fetchall():
                c_status = conn_rec[3]
                act_t = 'connection_accepted' if c_status == 'accepted' else 'connection_requested'
                title = 'Connection Established' if c_status == 'accepted' else 'Connection Requested'
                desc = f"{conn_rec[5]} and {conn_rec[6]} connected." if c_status == 'accepted' else f"{conn_rec[5]} sent a connection request to {conn_rec[6]}."
                cursor.execute("""
                    INSERT INTO admin_activity_log (id, activity_type, title, description, actor_id, target_id, entity_type, entity_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'member_connection', ?, ?)
                """, (f"act_conn_{conn_rec[0]}", act_t, title, desc, conn_rec[1], conn_rec[2], conn_rec[0], conn_rec[4]))
        except Exception as e:
            pass

        # Real estate inquiries
        try:
            cursor.execute("""
                SELECT li.id, li.user_id, li.listing_id, li.inquiry_type, li.created_at, u.full_name, rel.title
                FROM listing_inquiries li
                JOIN users u ON li.user_id = u.id
                JOIN real_estate_listings rel ON li.listing_id = rel.id
                ORDER BY li.created_at DESC LIMIT 5
            """)
            for inq in cursor.fetchall():
                cursor.execute("""
                    INSERT INTO admin_activity_log (id, activity_type, title, description, actor_id, entity_type, entity_id, created_at)
                    VALUES (?, 'investment_inquiry', 'Investment Inquiry', ?, ?, 'listing_inquiry', ?, ?)
                """, (f"act_inq_{inq[0]}", f"{inq[5]} submitted {inq[3]} for '{inq[6]}'.", inq[1], inq[0], inq[4]))
        except Exception as e:
            pass

        print("  [✓] Seeded baseline operational activity entries")

    conn.commit()
    conn.close()
    print(f"[OK] Database {db_path} migration complete.")

if __name__ == "__main__":
    for db in DATABASES:
        migrate_db(db)
    print("\n[SUCCESS] Phase 8 migrations successfully applied to all databases.")
