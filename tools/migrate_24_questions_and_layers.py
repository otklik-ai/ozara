#!/usr/bin/env python3
"""
tools/migrate_24_questions_and_layers.py
Migrates ozara.db to:
1. Exact 24 Canonical Questions (Sections A, B, C, D, E)
2. Travel and Chapter Layer (Chapter leads, gathering places, time-boxed trips)
3. Events Layer (6-month calendar, event types, registration states)
4. Quarterly Pulse Table (4-question pulse tracking)
5. Content moderation & profile reports tables
"""

import sqlite3
import sys
import json
from pathlib import Path

# Canonical 24 Questions Schema
CANONICAL_24_QUESTIONS = [
    # Section A. Where you are (Default: shared)
    {"id": 1, "section": "Section A. Where you are", "prompt": "Full name", "type": "text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 2, "section": "Section A. Where you are", "prompt": "Location where you reside", "type": "text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 3, "section": "Section A. Where you are", "prompt": "Other locations where you spend real time each year", "type": "city_multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 4, "section": "Section A. Where you are", "prompt": "Locations where you have a base, work, or run something", "type": "country_multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 5, "section": "Section A. Where you are", "prompt": "Languages you do business in", "type": "multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 6, "section": "Section A. Where you are", "prompt": "Best way to reach you", "type": "multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},

    # Section B. What you do (Default: shared. This is the LinkedIn layer.)
    {"id": 7, "section": "Section B. What you do", "prompt": "Professional role", "type": "multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 25, "section": "Section B. What you do", "prompt": "Job title", "type": "text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 26, "section": "Section B. What you do", "prompt": "Company / Organization", "type": "text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 27, "section": "Section B. What you do", "prompt": "Institution / University", "type": "text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 8, "section": "Section B. What you do", "prompt": "Industry & Sector", "type": "multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 10, "section": "Section B. What you do", "prompt": "What do you do, in one sentence?", "type": "text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 12, "section": "Section B. What you do", "prompt": "Your background", "type": "long_text", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 13, "section": "Section B. What you do", "prompt": "LinkedIn or website", "type": "url", "default_visibility": "shared", "is_required": False, "is_confidential": False},

    # Section C. What you are working on now (Default: shared)
    {"id": 14, "section": "Section C. What you are working on now", "prompt": "What are you focused on right now?", "type": "multi_with_note", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 15, "section": "Section C. What you are working on now", "prompt": "Which industries would you like to explore?", "type": "multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 16, "section": "Section C. What you are working on now", "prompt": "Where would you like to build connections?", "helper": "Choose up to five countries, or select open anywhere.", "type": "country_multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 17, "section": "Section C. What you are working on now", "prompt": "Who would you like to connect with right now?", "type": "multi_with_note", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 18, "section": "Section C. What you are working on now", "prompt": "What can other members turn to you for?", "helper": "Choose the areas where you can share experience, help, or introductions.", "type": "multi_with_note", "default_visibility": "shared", "is_required": True, "is_confidential": False},
    {"id": 19, "section": "Section C. What you are working on now", "prompt": "Are you open to direct contact from other members?", "type": "single", "default_visibility": "shared", "is_required": False, "is_confidential": False},

    # Section D. Personal context (Default: private)
    {"id": 20, "section": "Section D. Personal context", "prompt": "Age bracket", "type": "bracket", "default_visibility": "private", "is_required": False, "is_confidential": False},
    {"id": 21, "section": "Section D. Personal context", "prompt": "Family situation, if you want to say", "type": "single", "default_visibility": "private", "is_required": False, "is_confidential": False},
    {"id": 22, "section": "Section D. Personal context", "prompt": "What are your interests outside work?", "helper": "Select personal interests, sports, and creative pursuits outside of work.", "type": "multi", "default_visibility": "shared", "is_required": False, "is_confidential": False},
    {"id": 23, "section": "Section D. Personal context", "prompt": "Is there anything else you’d like our team to know?", "helper": "Optional. Share any context or preferences you’d rather leave off your member profile.", "placeholder": "Share any context or preferences you’d rather leave off your member profile.", "type": "long_text", "default_visibility": "private", "is_required": False, "is_confidential": True, "char_limit": 1000},

    # Section E. Chapter and events (Default: shared)
    {"id": 24, "section": "Section E. Chapter and events", "prompt": "Your home chapter, and how would you like to be involved?", "type": "single", "default_visibility": "shared", "is_required": False, "is_confidential": False},
]

def migrate():
    db_file = Path("ozara.db")
    if not db_file.exists():
        db_file = Path("sila.db")
    
    print(f"[*] Applying 24 Questions & Layers migration to {db_file}...")
    conn = sqlite3.connect(str(db_file))
    cur = conn.cursor()

    # 1. Add Chapter Lead and Gathering Place fields to chapters table
    cur.execute("PRAGMA table_info(chapters)")
    chap_cols = [r[1] for r in cur.fetchall()]
    new_chap_cols = [
        ("lead_name", "TEXT"),
        ("lead_photo", "TEXT"),
        ("lead_bio", "TEXT"),
        ("lead_email", "TEXT"),
        ("gathering_place_name", "TEXT"),
        ("gathering_place_photo", "TEXT"),
        ("gathering_place_description", "TEXT"),
    ]
    for col, col_type in new_chap_cols:
        if col not in chap_cols:
            print(f"[+] Adding column chapters.{col}")
            cur.execute(f"ALTER TABLE chapters ADD COLUMN {col} {col_type}")

    # 2. Add Event details to events table
    cur.execute("PRAGMA table_info(events)")
    evt_cols = [r[1] for r in cur.fetchall()]
    new_evt_cols = [
        ("event_type", "TEXT DEFAULT 'chapter_dinner'"),
        ("venue_name", "TEXT"),
        ("cover_image", "TEXT"),
        ("price", "TEXT DEFAULT 'Included in Membership'"),
        ("registration_link", "TEXT"),
        ("host_members", "TEXT"),
        ("status", "TEXT DEFAULT 'confirmed'"),
    ]
    for col, col_type in new_evt_cols:
        if col not in evt_cols:
            print(f"[+] Adding column events.{col}")
            cur.execute(f"ALTER TABLE events ADD COLUMN {col} {col_type}")

    # 3. Create quarterly_pulses table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS quarterly_pulses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        q14_focus TEXT,
        situation_changes TEXT,
        useful_people TEXT,
        travel_city TEXT,
        travel_start_date DATE,
        travel_end_date DATE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Create chapter_lead_messages table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chapter_lead_messages (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL REFERENCES chapters(id),
        sender_id TEXT NOT NULL REFERENCES users(id),
        sender_name TEXT,
        sender_email TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'read', 'responded', 'escalated_to_founders')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Create profile_reports table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS profile_reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL REFERENCES users(id),
        reported_user_id TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'resolved', 'dismissed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. Seed/Update Chapters with verified Leads and Standing Gathering Places
    chapters_data = [
        (
            "ch_dubai", "Dubai Chapter", "Dubai", "United Arab Emirates",
            "Elena Ermolov", "/avatars/elena_ermolov.jpg", "Managing Director & Founder, Dubai Chapter Lead", "ermolov.elena@gmail.com",
            "The Arts Club Dubai - DIFC",
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
            "Private club lounges and rooftop terrace in DIFC. The standing gathering spot for coffee, executive breakfasts, and confidential founder exchanges."
        ),
        (
            "ch_london", "London Chapter", "London", "United Kingdom",
            "Julia Shchukina", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800", "Co-Founder & London Chapter Lead", "julia@ozara.club",
            "Home House London - Portman Square",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
            "Historic Georgian private members club in Marylebone with confidential salon rooms and courtyard garden."
        ),
        (
            "ch_new_york", "New York Chapter", "New York", "United States",
            "Alexandra Hill", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800", "Co-Founder & New York Chapter Lead", "alexandra@ozara.club",
            "The Core Club - Manhattan",
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
            "Private executive club in Midtown Manhattan for peer founder breakfasts, private dining, and confidential advisory."
        ),
        (
            "ch_astana", "Astana Chapter", "Astana", "Kazakhstan",
            "Kairat Nurtas", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800", "Central Asia Regional Chapter Lead", "astana@ozara.club",
            "The Ritz-Carlton Lounge - Astana",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
            "Private executive salon overlooking the Baiterek monument. The standing venue for Central Asia cross-border investment dialogues."
        ),
        (
            "ch_singapore", "Singapore Chapter", "Singapore", "Singapore",
            "Marcus Vance", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800", "Southeast Asia Chapter Lead", "singapore@ozara.club",
            "1880 Private Club - Robertson Quay",
            "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
            "Riverside members club designed for conversation and high-trust peer masterminds."
        ),
        (
            "ch_miami", "Miami Chapter", "Miami", "United States",
            "David Sterling", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800", "Americas Tech & Capital Lead", "miami@ozara.club",
            "SoHo Beach House - Miami Beach",
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
            "Private club beachfront terrace for founder gatherings and tech salon dinners."
        ),
        (
            "ch_limassol", "Limassol Chapter", "Limassol", "Cyprus",
            "Christos Constantinou", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800", "Mediterranean & Maritime Tech Lead", "limassol@ozara.club",
            "Limassol Marina Club Lounge",
            "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
            "Waterfront executive salon at the marina for shipping, fintech, and cross-border founders."
        )
    ]

    for chap in chapters_data:
        cur.execute("""
        INSERT INTO chapters (id, name, city, country, lead_name, lead_photo, lead_bio, lead_email, gathering_place_name, gathering_place_photo, gathering_place_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            city = excluded.city,
            country = excluded.country,
            lead_name = excluded.lead_name,
            lead_photo = excluded.lead_photo,
            lead_bio = excluded.lead_bio,
            lead_email = excluded.lead_email,
            gathering_place_name = excluded.gathering_place_name,
            gathering_place_photo = excluded.gathering_place_photo,
            gathering_place_description = excluded.gathering_place_description
        """, chap)

    # 7. Update Event Types on upcoming events
    cur.execute("UPDATE events SET event_type = 'chapter_dinner', venue_name = location WHERE event_type IS NULL OR event_type = 'chapter_dinner'")
    cur.execute("UPDATE events SET event_type = 'trek', venue_name = 'Private Mountain Retreat' WHERE title LIKE '%Trek%' OR title LIKE '%Central Asia%' OR title LIKE '%Georgia%'")
    cur.execute("UPDATE events SET event_type = 'summit', venue_name = 'Grand Luxury Estate' WHERE title LIKE '%Summit%' OR title LIKE '%Jubilee%' OR title LIKE '%Grand%'")
    cur.execute("UPDATE events SET event_type = 'online_session', venue_name = 'Confidential Chatham House Video Room' WHERE title LIKE '%Online%' OR title LIKE '%Briefing%'")

    # 8. Clean up retired questions 9 and 11 only (preserve questions 25, 26, 27)
    cur.execute("DELETE FROM questionnaire_answers WHERE question_id IN (9, 11)")

    # 9. Migrate existing Q14 answers to composite JSON format: {"tags": [...], "note": "..."}
    # "Preserve existing answers in the optional text field during migration."
    cur.execute("SELECT user_id, value_text FROM questionnaire_answers WHERE question_id = 14")
    for u_id, val in cur.fetchall():
        if val and val.strip():
            val_clean = val.strip()
            # If already json with tags/note, leave it
            if val_clean.startswith("{") and '"note"' in val_clean:
                continue
            # Plain text or legacy: preserve in the optional text field
            new_json = json.dumps({"tags": [], "note": val_clean[:250]})
            cur.execute("""
                UPDATE questionnaire_answers 
                SET value_text = ?, answer_state = 'answered' 
                WHERE user_id = ? AND question_id = 14
            """, (new_json, u_id))

    # 9b. Migrate existing Q17 answers to composite JSON format: {"tags": [...], "note": "..."}
    # "Keep answers editable and preserve existing selections during migration."
    cur.execute("SELECT user_id, value_text FROM questionnaire_answers WHERE question_id = 17")
    for u_id, val in cur.fetchall():
        if val and val.strip() and val.strip() != 'skipped':
            val_clean = val.strip()
            if val_clean.startswith("{") and '"note"' in val_clean:
                continue
            new_json = json.dumps({"tags": [], "note": val_clean[:200]})
            cur.execute("""
                UPDATE questionnaire_answers 
                SET value_text = ?, answer_state = 'answered' 
                WHERE user_id = ? AND question_id = 17
            """, (new_json, u_id))

    # 10. Seed realistic focus priorities, background, website links, explored industries, and connection preferences for core demo members
    seed_profiles = {
        "usr_elena": {
            "focus": json.dumps({
                "tags": ["Expanding into new markets", "Developing partnerships", "Growing a business"],
                "note": "Scaling cross-border institutional payment clearing rails between GCC and European trade corridors."
            }),
            "background": "Managing Director with 15+ years in global fintech operations, regulatory licensing, and cross-border settlement rails across DIFC, London, and Singapore.",
            "website": "https://linkedin.com/in/elena-ermolov",
            "explore_industries": "Financial Services & Fintech; Artificial Intelligence & Machine Learning",
            "connections": json.dumps({
                "tags": ["Executives & Business Leaders", "Potential Business Partners", "Experts in a Specific Country or Market"],
                "note": "Banking partners and sovereign wealth directors in GCC and London."
            })
        },
        "usr_marcus": {
            "focus": json.dumps({
                "tags": ["Building or launching a project", "Hiring or building a team", "Raising funding"],
                "note": "Deploying sovereign-grade enterprise AI models and hiring senior systems engineers in Dubai."
            }),
            "background": "CTO and Founder. Former DeepMind research engineer; previously led core systems engineering at high-throughput inference startups.",
            "website": "https://linkedin.com/in/marcus-vance-ai",
            "explore_industries": "Artificial Intelligence & Machine Learning; Enterprise Software & Cloud Infrastructure",
            "connections": json.dumps({
                "tags": ["Founders & Business Owners", "Investors", "Talent & Hiring Connections"],
                "note": "Senior ML infrastructure engineers and lead investors."
            })
        },
        "usr_tariq": {
            "focus": json.dumps({
                "tags": ["Exploring investment opportunities", "Developing partnerships", "Buying or selling a business"],
                "note": "Deploying private equity capital into prime Dubai real estate developments and luxury hospitality."
            }),
            "background": "Managing Partner at Al-Mansoor Capital. 18 years in private equity and real estate syndication across UAE and the UK.",
            "website": "https://linkedin.com/in/tariq-al-mansoor",
            "explore_industries": "Real Estate, Property & Development; Hospitality, Travel & Tourism",
            "connections": json.dumps({
                "tags": ["Real Estate Professionals", "Investors", "Potential Business Partners"],
                "note": "Experienced real estate developers and luxury hospitality operators."
            })
        },
        "usr_david": {
            "focus": json.dumps({
                "tags": ["Exploring investment opportunities", "Finding mentors or expert guidance", "Growing my professional network"],
                "note": "Backing early-stage tech ventures moving between Europe, Cyprus, and UAE."
            }),
            "background": "Angel investor and venture partner. Former tech executive with exits in logistics and maritime technology.",
            "website": "https://mediterrainvest.cy",
            "explore_industries": "Venture Capital, Private Equity & Family Offices; Supply Chain, Logistics & Maritime",
            "connections": json.dumps({
                "tags": ["Founders & Business Owners", "Technology & Product Professionals", "Open to Meeting Different People"],
                "note": "Early-stage founders with strong technical foundations."
            })
        },
        "usr_sophie": {
            "focus": json.dumps({
                "tags": ["Expanding into new markets", "Research & innovation", "Developing partnerships"],
                "note": "Establishing APAC-GCC supply chain logistics partnerships and evaluating smart port technologies."
            }),
            "background": "Head of Strategic Growth at Pacific Chain. Specializing in maritime trade infrastructure and cross-border customs technology.",
            "website": "https://linkedin.com/in/sophie-dubois-sg",
            "explore_industries": "Supply Chain, Logistics & Maritime; Government, Policy & Trade",
            "connections": json.dumps({
                "tags": ["Potential Business Partners", "Experts in a Specific Country or Market", "Executives & Business Leaders"],
                "note": "Port authority directors and trade corridor operators in Singapore and Dubai."
            })
        }
    }

    for u_id, p_data in seed_profiles.items():
        # Update focus (Q14)
        cur.execute("""
            UPDATE questionnaire_answers 
            SET value_text = ?, answer_state = 'answered' 
            WHERE user_id = ? AND question_id = 14
        """, (p_data["focus"], u_id))
        # Update background (Q12)
        cur.execute("""
            UPDATE questionnaire_answers 
            SET value_text = ?, answer_state = 'answered' 
            WHERE user_id = ? AND question_id = 12
        """, (p_data["background"], u_id))
        # Update website / LinkedIn (Q13)
        cur.execute("""
            UPDATE questionnaire_answers 
            SET value_text = ?, answer_state = 'answered' 
            WHERE user_id = ? AND question_id = 13
        """, (p_data["website"], u_id))
        # Update industries to explore (Q15)
        cur.execute("""
            UPDATE questionnaire_answers 
            SET value_text = ?, answer_state = 'answered' 
            WHERE user_id = ? AND question_id = 15
        """, (p_data["explore_industries"], u_id))
        # Update connections preference (Q17)
        cur.execute("""
            UPDATE questionnaire_answers 
            SET value_text = ?, answer_state = 'answered' 
            WHERE user_id = ? AND question_id = 17
        """, (p_data["connections"], u_id))

    # 11. Normalize remaining Q13 URLs (prepend https:// if missing)
    cur.execute("SELECT user_id, value_text FROM questionnaire_answers WHERE question_id = 13")
    for u_id, val in cur.fetchall():
        if val and val.strip():
            val_clean = val.strip()
            if not val_clean.startswith("http://") and not val_clean.startswith("https://") and " " not in val_clean:
                cur.execute("UPDATE questionnaire_answers SET value_text = ? WHERE user_id = ? AND question_id = 13", (f"https://{val_clean}", u_id))

    # 12. Update prompt text for the canonical questions for all existing users
    for q in CANONICAL_24_QUESTIONS:
        cur.execute("""
        UPDATE questionnaire_answers
        SET prompt = ?
        WHERE question_id = ?
        """, (q["prompt"], q["id"]))

    # 13. Ensure each existing admitted user has all canonical question rows
    cur.execute("SELECT id FROM users")
    users = [r[0] for r in cur.fetchall()]
    for u_id in users:
        for q in CANONICAL_24_QUESTIONS:
            cur.execute("""
            INSERT INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text)
            VALUES (?, ?, ?, 'unanswered', ?, NULL)
            ON CONFLICT(user_id, question_id) DO UPDATE SET prompt = excluded.prompt
            """, (u_id, q["id"], q["prompt"], q["default_visibility"]))

    conn.commit()
    conn.close()
    print("[✓] Migration of 24 Questions & Layers successfully committed!")

if __name__ == "__main__":
    migrate()
