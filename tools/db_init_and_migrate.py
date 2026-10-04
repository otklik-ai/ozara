#!/usr/bin/env python3
"""
tools/db_init_and_migrate.py
Deterministic database schema initialization and migration script.
Creates all required tables and indices for Sila Svyazei in SQLite.
"""

import sqlite3
import sys
from pathlib import Path

def migrate(db_path: Path):
    print(f"[*] Initializing database schema at {db_path}...")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys = ON;")

    cursor.executescript("""
    -- Chapters
    CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Users & Members
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL DEFAULT 'pbkdf2_mock_hash',
        full_name TEXT NOT NULL,
        headline TEXT NOT NULL,
        avatar_url TEXT,
        chapter_id TEXT REFERENCES chapters(id),
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        contact_preference TEXT NOT NULL CHECK(contact_preference IN ('direct_contact', 'through_team', 'unavailable')),
        role TEXT NOT NULL CHECK(role IN ('FOUNDER', 'ADMIN', 'MEMBER', 'APPLICANT')),
        is_admitted BOOLEAN NOT NULL DEFAULT 1,
        admitted_by TEXT,
        admitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_complete BOOLEAN NOT NULL DEFAULT 0,
        accepted_access_conditions_version TEXT DEFAULT NULL,
        accepted_access_conditions_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Canonical Taxonomies
    CREATE TABLE IF NOT EXISTS taxonomies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK(category IN ('roles', 'industries', 'expertise', 'offers', 'needs', 'interests', 'institutions')),
        slug TEXT NOT NULL,
        label TEXT NOT NULL,
        UNIQUE(user_id, category, slug)
    );

    -- Taxonomy Context Notes
    CREATE TABLE IF NOT EXISTS taxonomy_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        note TEXT NOT NULL,
        UNIQUE(user_id, category)
    );

    -- Questionnaire Answers (Q1 to Q30)
    CREATE TABLE IF NOT EXISTS questionnaire_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL CHECK(question_id BETWEEN 1 AND 30),
        prompt TEXT NOT NULL,
        answer_state TEXT NOT NULL CHECK(answer_state IN ('unanswered', 'answered', 'deliberately_skipped')),
        visibility TEXT NOT NULL CHECK(visibility IN ('shared', 'private')),
        value_text TEXT,
        value_json TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, question_id)
    );

    -- Travel Plans
    CREATE TABLE IF NOT EXISTS travel_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        notes TEXT,
        visibility TEXT NOT NULL CHECK(visibility IN ('shared', 'private')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Call Bookings
    CREATE TABLE IF NOT EXISTS call_bookings (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL REFERENCES users(id),
        recipient_id TEXT NOT NULL REFERENCES users(id),
        status TEXT NOT NULL CHECK(status IN ('proposed', 'accepted', 'declined', 'rescheduled', 'cancelled')),
        proposed_times_json TEXT NOT NULL,
        selected_time TEXT,
        timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
        meeting_link TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Introduction Requests ("Ask the team")
    CREATE TABLE IF NOT EXISTS intro_requests (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL REFERENCES users(id),
        target_member_id TEXT REFERENCES users(id),
        target_context_need TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending_admin_review', 'in_progress', 'completed', 'declined')),
        assigned_admin TEXT,
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Events
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        chapter_id TEXT REFERENCES chapters(id),
        location TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 20,
        registered_count INTEGER NOT NULL DEFAULT 0,
        is_published BOOLEAN NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Event Registrations
    CREATE TABLE IF NOT EXISTS event_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('registered', 'waitlisted', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
    );

    -- Targeted Event Invitations
    CREATE TABLE IF NOT EXISTS event_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
    );

    -- Real Estate Listings
    CREATE TABLE IF NOT EXISTS real_estate_listings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        short_summary TEXT NOT NULL,
        location TEXT NOT NULL,
        property_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        images_json TEXT NOT NULL,
        brochure_document_url TEXT,
        eligibility_requirements TEXT DEFAULT '{"investor_type": "accredited_or_qualified", "conditions_version": "2026-10-v1"}',
        disclaimer TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Listing Inquiries
    CREATE TABLE IF NOT EXISTS listing_inquiries (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES real_estate_listings(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES users(id),
        inquiry_type TEXT NOT NULL CHECK(inquiry_type IN ('request_info', 'request_call')),
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Governance & Audit Logs (Immutable)
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_member_id TEXT,
        question_id INTEGER,
        ip_address TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata_json TEXT
    );

    -- Two-Person Export Requests
    CREATE TABLE IF NOT EXISTS export_requests (
        id TEXT PRIMARY KEY,
        requested_by TEXT NOT NULL,
        request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        export_type TEXT NOT NULL,
        approved_by TEXT,
        approval_timestamp TIMESTAMP,
        status TEXT NOT NULL CHECK(status IN ('pending_second_approval', 'approved', 'rejected', 'expired')),
        download_token TEXT
    );

    -- Invitations (1:1 Unique Email-to-Token Mapping & Access Requests)
    CREATE TABLE IF NOT EXISTS invitation_tokens (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        token TEXT UNIQUE NOT NULL,
        full_name TEXT,
        role_or_headline TEXT,
        notes TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending_admin_approval', 'approved', 'claimed', 'revoked')) DEFAULT 'approved',
        created_by TEXT,
        approved_by TEXT,
        approved_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_claimed BOOLEAN NOT NULL DEFAULT 0,
        claimed_by TEXT,
        claimed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Onboarding Contact Messages
    CREATE TABLE IF NOT EXISTS contact_messages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'new'
    );

    -- Indices for performance and search
    CREATE INDEX IF NOT EXISTS idx_users_chapter ON users(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_taxonomies_cat_slug ON taxonomies(category, slug);
    CREATE INDEX IF NOT EXISTS idx_answers_user_q ON questionnaire_answers(user_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_travel_dates ON travel_plans(end_date);
    CREATE INDEX IF NOT EXISTS idx_events_chapter ON events(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_member_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_email ON invitation_tokens(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_token ON invitation_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

    -- Phone Verifications (Two-Factor / SMS Verification)
    CREATE TABLE IF NOT EXISTS phone_verifications (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        is_verified BOOLEAN DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
    """);

    # Safe dynamic column migrations for existing databases
    cursor.execute("PRAGMA table_info(users)")
    user_cols = [r[1] for r in cursor.fetchall()]
    if "accepted_access_conditions_version" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN accepted_access_conditions_version TEXT DEFAULT NULL")
    if "accepted_access_conditions_at" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN accepted_access_conditions_at TIMESTAMP DEFAULT NULL")
    if "phone" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")

    cursor.execute("PRAGMA table_info(real_estate_listings)")
    listing_cols = [r[1] for r in cursor.fetchall()]
    if "eligibility_requirements" not in listing_cols:
        cursor.execute("ALTER TABLE real_estate_listings ADD COLUMN eligibility_requirements TEXT DEFAULT '{\"investor_type\": \"accredited_or_qualified\", \"conditions_version\": \"2026-10-v1\"}'")

    cursor.execute("PRAGMA table_info(invitation_tokens)")
    inv_cols = [r[1] for r in cursor.fetchall()]
    if "full_name" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN full_name TEXT DEFAULT NULL")
    if "role_or_headline" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN role_or_headline TEXT DEFAULT NULL")
    if "notes" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN notes TEXT DEFAULT NULL")
    if "status" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN status TEXT DEFAULT 'approved'")
    if "approved_by" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN approved_by TEXT DEFAULT NULL")
    if "approved_at" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN approved_at TIMESTAMP DEFAULT NULL")
    if "phone" not in inv_cols:
        cursor.execute("ALTER TABLE invitation_tokens ADD COLUMN phone TEXT DEFAULT NULL")

    conn.commit()
    conn.close()
    print("[SUCCESS] All tables and indices migrated successfully.")

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    db_file = root / "ozara.db" if (root / "ozara.db").exists() else root / "sila.db"
    migrate(db_file)
