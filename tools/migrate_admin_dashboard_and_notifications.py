#!/usr/bin/env python3
"""
tools/migrate_admin_dashboard_and_notifications.py
Ensures database schema and accounts for the Admin Role & Admin Dashboard:
- Verifies admin permissions for Julia Shchukina, Alexandra Hill, and Elena Ermolov.
- Adds timezone, meeting_link, rsvp_deadline, and visibility to 'events'.
- Updates 'event_invitations' with status, responded_at, delivery_channel, admin_id.
- Creates 'in_app_notifications' table.
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

    print(f"\n[*] Migrating {db_path} for Admin Dashboard...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Update users table - ensure admin accounts for Julia, Alexandra, Elena
    admin_accounts = [
        {
            "id": "usr_alexandra",
            "email": "alexandra@ozara.club",
            "full_name": "Alexandra Hill",
            "headline": "Co-founder & Managing Partner, ÖZARA",
            "role": "FOUNDER",
            "is_admitted": 1,
            "is_complete": 1,
            "city": "London",
            "country": "United Kingdom",
            "contact_preference": "direct_contact"
        },
        {
            "id": "usr_julia",
            "email": "julia@ozara.club",
            "full_name": "Julia Shchukina",
            "headline": "Co-founder & Head of Investments, ÖZARA",
            "role": "FOUNDER",
            "is_admitted": 1,
            "is_complete": 1,
            "city": "Dubai",
            "country": "United Arab Emirates",
            "contact_preference": "direct_contact"
        },
        {
            "id": "usr_elena",
            "email": "ermolov.elena@gmail.com",
            "full_name": "Elena Ermolov",
            "headline": "Managing Director, Global FinTech & Cross-border Operations",
            "role": "FOUNDER",
            "is_admitted": 1,
            "is_complete": 1,
            "city": "Dubai",
            "country": "United Arab Emirates",
            "contact_preference": "direct_contact"
        }
    ]

    for acc in admin_accounts:
        # Check by id or email
        cursor.execute("SELECT id, email, full_name, role FROM users WHERE id = ? OR LOWER(email) = ?", (acc["id"], acc["email"].lower()))
        existing = cursor.fetchone()
        if existing:
            # Update role and ensure admitted without creating duplicates
            cursor.execute("""
                UPDATE users
                SET role = 'FOUNDER', is_admitted = 1, is_complete = 1
                WHERE id = ?
            """, (existing[0],))
            print(f"  [✓] Verified admin user: {existing[2]} ({existing[1]}) -> role: FOUNDER")
        else:
            # Insert if missing
            cursor.execute("""
                INSERT INTO users (id, email, full_name, headline, role, is_admitted, is_complete, city, country, contact_preference)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (acc["id"], acc["email"], acc["full_name"], acc["headline"], acc["role"], acc["is_admitted"], acc["is_complete"], acc["city"], acc["country"], acc["contact_preference"]))
            print(f"  [+] Created admin user: {acc['full_name']} ({acc['email']})")

    # 2. Add columns to 'events' table
    cursor.execute("PRAGMA table_info(events)")
    existing_event_cols = {row[1] for row in cursor.fetchall()}

    event_cols_to_add = [
        ("timezone", "TEXT DEFAULT 'UTC'"),
        ("meeting_link", "TEXT DEFAULT NULL"),
        ("rsvp_deadline", "TEXT DEFAULT NULL"),
        ("visibility", "TEXT DEFAULT 'all_members'") # 'all_members', 'selected_invitees'
    ]

    for col_name, col_type in event_cols_to_add:
        if col_name not in existing_event_cols:
            cursor.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")
            print(f"  [+] Added column to events: {col_name} ({col_type})")
        else:
            print(f"  [✓] Column already exists on events: {col_name}")

    # 3. Add columns to 'event_invitations' table
    cursor.execute("PRAGMA table_info(event_invitations)")
    existing_inv_cols = {row[1] for row in cursor.fetchall()}

    inv_cols_to_add = [
        ("status", "TEXT DEFAULT 'pending'"), # 'pending', 'accepted', 'declined'
        ("responded_at", "TIMESTAMP DEFAULT NULL"),
        ("delivery_channel", "TEXT DEFAULT 'in_app'"), # 'in_app', 'email', 'whatsapp'
        ("admin_id", "TEXT REFERENCES users(id)")
    ]

    for col_name, col_type in inv_cols_to_add:
        if col_name not in existing_inv_cols:
            cursor.execute(f"ALTER TABLE event_invitations ADD COLUMN {col_name} {col_type}")
            print(f"  [+] Added column to event_invitations: {col_name} ({col_type})")
        else:
            print(f"  [✓] Column already exists on event_invitations: {col_name}")

    # 4. Create in_app_notifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS in_app_notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL, -- 'event_invitation', 'announcement', 'membership'
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
            action_url TEXT,
            delivery_channel TEXT NOT NULL DEFAULT 'in_app',
            is_read BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON in_app_notifications(user_id, created_at DESC)")
    print("  [✓] Verified in_app_notifications table and index")

    conn.commit()
    conn.close()
    print(f"[OK] Migration completed for {db_path}")

if __name__ == "__main__":
    for db in DATABASES:
        migrate_db(db)
    print("\n[SUCCESS] All databases migrated.")
