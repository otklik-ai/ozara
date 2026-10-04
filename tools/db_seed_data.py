#!/usr/bin/env python3
"""
tools/db_seed_data.py
Deterministic seed script for Sila Svyazei.
Populates realistic community data, chapters, verified members, 30-question questionnaires,
travel plans (active and expired), events, and curated real estate listings.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path

QUESTIONS = [
    (1, "What is your primary professional focus today?"),
    (2, "Which industries do you have deep operational experience in?"),
    (3, "What are the core capabilities or expertise you can offer to peers?"),
    (4, "What specific introductions, partnerships, or resources are you currently seeking?"),
    (5, "What geographies or regional markets do you know best?"),
    (6, "What major company, institution, or project are you most known for?"),
    (7, "What is your current team size and corporate scale?"),
    (8, "What are your preferred collaboration formats (advisory, co-investing, peer exchange)?"),
    (9, "What is one counter-intuitive business insight you strongly believe?"),
    (10, "Which key business books, thinkers, or frameworks shape your operating style?"),
    (11, "What is your preferred method and time for high-value conversations?"),
    (12, "What active side ventures, boards, or philanthropic initiatives do you support?"),
    (13, "What personal hobbies, sports, or passions do you pursue outside work?"),
    (14, "What universities, alumni networks, or executive programs are you affiliated with?"),
    (15, "Which international cities do you visit most regularly throughout the year?"),
    (16, "What is the biggest operational hurdle you solved in the past 24 months?"),
    (17, "What technology or market trend do you believe is currently under-hyped?"),
    (18, "What core priority or strategic milestone are you tackling over the next 12 months?"), # MANDATORY COMPLETION TRIGGER
    (19, "How do you prefer to evaluate new peer connections before committing time?"),
    (20, "What is a trusted service provider category you often recommend to peers?"),
    (21, "What was your most impactful cross-border transaction or expansion experience?"),
    (22, "What is your philosophy on building and preserving long-term relationship capital?"),
    (23, "Confidential founder notes: What personal inflection point or confidential challenge are you navigating?"), # PERMANENTLY PRIVATE
    (24, "What type of community events or gatherings do you find most valuable?"),
    (25, "Are you open to speaking on panels, hosting salons, or mentoring rising founders?"),
    (26, "What are your criteria for joining an advisory board or angel syndicate?"),
    (27, "Which languages do you conduct business in fluently?"),
    (28, "What media, podcasts, or publications do you read consistently?"),
    (29, "What is your preferred communication channel for urgent peer requests?"),
    (30, "What would make your ÖZARA membership exceptionally worthwhile this year?")
]

def seed(db_path: Path):
    print(f"[*] Seeding ÖZARA database at {db_path}...")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Clear existing data cleanly
    tables = [
        "listing_inquiries", "real_estate_listings", "event_invitations", "event_registrations",
        "events", "intro_requests", "call_bookings", "travel_plans", "questionnaire_answers",
        "taxonomy_notes", "taxonomies", "invitation_tokens", "export_requests", "audit_logs",
        "users", "chapters"
    ]
    for t in tables:
        cursor.execute(f"DELETE FROM {t};")

    # 1. Chapters
    chapters = [
        ("ch_dubai", "Dubai Chapter", "Dubai", "United Arab Emirates"),
        ("ch_new_york", "New York Chapter", "New York", "United States"),
        ("ch_london", "London Chapter", "London", "United Kingdom"),
        ("ch_astana", "Astana Chapter", "Astana", "Kazakhstan"),
        ("ch_singapore", "Singapore Chapter", "Singapore", "Singapore"),
        ("ch_limassol", "Limassol Chapter", "Limassol", "Cyprus"),
        ("ch_miami", "Miami Chapter", "Miami", "United States"),
        ("ch_silicon_valley", "Silicon Valley Chapter", "San Francisco", "United States"),
        ("ch_barcelona", "Barcelona Chapter", "Barcelona", "Spain"),
    ]
    cursor.executemany("INSERT INTO chapters (id, name, city, country) VALUES (?, ?, ?, ?);", chapters)

    # 2. Founders & Admins
    users = [
        ("usr_elena", "ermolov.elena@gmail.com", "Elena Ermolov", "Co-Founder & Managing Partner, ÖZARA", "/avatars/elena_ermolov.jpg", "ch_dubai", "Dubai", "United Arab Emirates", "direct_contact", "FOUNDER", 1, "self", 1, "2026-10-v1", "2026-10-01 10:00:00"),
        ("usr_alexandra", "agniyahill@gmail.com", "Alexandra Hill", "Co-Founder & Managing Partner, ÖZARA", "/avatars/alexandra_hill.jpg", "ch_dubai", "Dubai", "United Arab Emirates", "through_team", "FOUNDER", 1, "self", 1, "2026-10-v1", "2026-10-01 10:00:00"),
        ("usr_julia", "iuliiashchukinainvest@gmail.com", "Julia Shchukina", "Co-Founder & Head of Curation, ÖZARA", "/avatars/julia_shchukina.jpg", "ch_dubai", "Dubai", "United Arab Emirates", "through_team", "FOUNDER", 1, "self", 1, "2026-10-v1", "2026-10-01 10:00:00"),
        # 3. Verified Members
        ("usr_marcus", "marcus.vance@vancetech.io", "Marcus Vance", "Founder & CEO, Vance Enterprise AI", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300", "ch_london", "London", "United Kingdom", "direct_contact", "MEMBER", 1, "Julia Shchukina", 1, "2026-10-v1", "2026-10-01 10:00:00"),
        ("usr_tariq", "tariq@almansoorcap.com", "Tariq Al-Mansoor", "Managing Partner, Al-Mansoor Real Estate Capital", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300", "ch_dubai", "Dubai", "United Arab Emirates", "direct_contact", "MEMBER", 1, "Elena Ermolov", 1, "2026-10-v1", "2026-10-01 10:00:00"),
        ("usr_sophie", "sophie.dubois@pacificchain.sg", "Sophie Dubois", "VP International Supply Chain & APAC Operations", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300", "ch_singapore", "Singapore", "Singapore", "through_team", "MEMBER", 1, "Julia Shchukina", 0, "2026-10-v1", "2026-10-01 10:00:00"),
        ("usr_david", "david.klein@mediterrainvest.cy", "David Klein", "Serial Tech Founder & Early-Stage Angel", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300", "ch_limassol", "Limassol", "Cyprus", "direct_contact", "MEMBER", 1, "Alexandra Hill", 1, None, None)
    ]
    cursor.executemany("""
        INSERT INTO users (id, email, full_name, headline, avatar_url, chapter_id, city, country, contact_preference, role, is_admitted, admitted_by, is_complete, accepted_access_conditions_version, accepted_access_conditions_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, users)

    # 3. Taxonomies & Notes
    tax_data = [
        # Elena
        ("usr_elena", "roles", "executive", "Executive"),
        ("usr_elena", "roles", "advisor", "Advisor"),
        ("usr_elena", "industries", "fintech", "FinTech"),
        ("usr_elena", "industries", "banking", "Banking & Payments"),
        ("usr_elena", "expertise", "cross_border_payments", "Cross-Border Payments"),
        ("usr_elena", "expertise", "uae_licensing", "UAE Financial Licensing"),
        ("usr_elena", "offers", "fintech_licensing_advisory", "UAE & DIFC regulatory introductions and payment infrastructure advisory"),
        ("usr_elena", "needs", "enterprise_ai_partners", "Enterprise AI automation for anti-fraud and compliance operations"),
        ("usr_elena", "interests", "equestrian", "Equestrian & Polo"),
        ("usr_elena", "institutions", "insead", "INSEAD"),
        # Marcus
        ("usr_marcus", "roles", "founder", "Founder & CEO"),
        ("usr_marcus", "industries", "ai_enterprise", "Enterprise AI"),
        ("usr_marcus", "industries", "saas", "B2B SaaS"),
        ("usr_marcus", "expertise", "llm_deployment", "Production LLM Architecture"),
        ("usr_marcus", "expertise", "b2b_sales", "B2B Enterprise Sales"),
        ("usr_marcus", "offers", "enterprise_ai_partners", "Custom LLM integrations and enterprise workflow automation"),
        ("usr_marcus", "needs", "cross_border_payments", "Middle East treasury and cross-border payment rails for EMEA expansion"),
        ("usr_marcus", "interests", "sailing", "Offshore Sailing"),
        ("usr_marcus", "institutions", "oxford", "Oxford University"),
        # Tariq
        ("usr_tariq", "roles", "investor", "Institutional Investor"),
        ("usr_tariq", "industries", "real_estate", "Commercial & Luxury Real Estate"),
        ("usr_tariq", "expertise", "asset_syndication", "Off-Market Asset Syndication"),
        ("usr_tariq", "offers", "prime_gcc_real_estate", "Access to off-market prime assets in Palm Jumeirah & Downtown Dubai"),
        ("usr_tariq", "needs", "family_office_syndication", "Co-investors and family offices seeking 8-11% net yield commercial portfolios"),
        ("usr_tariq", "institutions", "lse", "London School of Economics"),
        # Sophie
        ("usr_sophie", "roles", "operator", "Senior Operator"),
        ("usr_sophie", "industries", "logistics", "Global Logistics & Freight"),
        ("usr_sophie", "expertise", "supply_chain_resilience", "APAC Port Operations & Customs"),
        ("usr_sophie", "offers", "apac_distribution_networks", "Direct access to Tier 1 shipping lines and ASEAN supply chain hubs"),
        ("usr_sophie", "needs", "cold_chain_iot", "Cold-chain IoT tracking solutions and automated customs compliance software"),
        # David
        ("usr_david", "roles", "founder", "Serial Founder"),
        ("usr_david", "roles", "investor", "Angel Investor"),
        ("usr_david", "industries", "fintech", "FinTech"),
        ("usr_david", "expertise", "angel_investing", "Early-Stage Seed Structuring"),
        ("usr_david", "offers", "angel_capital", "Seed checks for EU/GCC cross-border SaaS companies"),
        ("usr_david", "needs", "dealflow_gcc", "High-growth GCC tech founders seeking European expansion")
    ]
    cursor.executemany("INSERT INTO taxonomies (user_id, category, slug, label) VALUES (?, ?, ?, ?);", tax_data)

    notes = [
        ("usr_elena", "industries", "15 years overseeing EMEA & GCC multi-currency payment clearing systems."),
        ("usr_marcus", "expertise", "Built LLM pipelines handling 50M+ daily enterprise queries with strict SOC2 isolation."),
        ("usr_tariq", "offers", "Direct allocation access for prime waterfront and trophy hospitality assets.")
    ]
    cursor.executemany("INSERT INTO taxonomy_notes (user_id, category, note) VALUES (?, ?, ?);", notes)

    # 4. Answers for Elena, Marcus, and Tariq (incorporating Q18 complete, and Q23 locked private!)
    answers_records = []
    # Base answers for Elena
    for q_id, prompt in QUESTIONS:
        ans_state = "answered"
        vis = "shared"
        val = f"Elena's structured perspective on: {prompt}"
        if q_id == 18: # Required question
            val = "Scaling our cross-border payment rails to process $500M in annual GCC-Europe corporate trade volume."
        elif q_id == 23: # Permanent Private Lock
            vis = "private"
            val = "[CONFIDENTIAL TO FOUNDERS]: Restructuring executive equity pool and preparing for a potential pre-IPO spin-off in Q3 2027. Need discreet guidance on structuring."
        elif q_id in [7, 12, 28]:
            ans_state = "deliberately_skipped"
            val = None
        answers_records.append(("usr_elena", q_id, prompt, ans_state, vis, val, json.dumps({"text": val} if val else None)))

    # Answers for Marcus
    for q_id, prompt in QUESTIONS:
        ans_state = "answered"
        vis = "shared"
        val = f"Marcus's insight regarding: {prompt}"
        if q_id == 18:
            val = "Expanding our enterprise AI platform into the GCC and securing anchor sovereign contracts."
        elif q_id == 23:
            vis = "private"
            val = "[CONFIDENTIAL TO FOUNDERS]: Evaluating strategic acquisition offer from a Tier 1 US cloud conglomerate. Considering whether to sell or raise Series B."
        elif q_id in [13, 20]:
            ans_state = "deliberately_skipped"
            val = None
        answers_records.append(("usr_marcus", q_id, prompt, ans_state, vis, val, json.dumps({"text": val} if val else None)))

    # Answers for Tariq
    for q_id, prompt in QUESTIONS:
        ans_state = "answered"
        vis = "shared"
        val = f"Tariq's institutional perspective on: {prompt}"
        if q_id == 18:
            val = "Closing our $120M Palm Jumeirah Ultra-Prime Residential Development Fund."
        elif q_id == 23:
            vis = "private"
            val = "[CONFIDENTIAL TO FOUNDERS]: Navigating succession planning across three family branch holding entities."
        answers_records.append(("usr_tariq", q_id, prompt, ans_state, vis, val, json.dumps({"text": val} if val else None)))

    # Answers for David Klein (completed Q18)
    for q_id, prompt in QUESTIONS:
        ans_state = "answered"
        vis = "shared"
        val = f"David's perspective on: {prompt}"
        if q_id == 18:
            val = "Scaling European angel syndicate dealflow and connecting high-growth tech founders into the GCC."
        elif q_id == 23:
            vis = "private"
            val = "[CONFIDENTIAL TO FOUNDERS]: Considering establishing a regulated family office fund structure in Abu Dhabi Global Market (ADGM)."
        answers_records.append(("usr_david", q_id, prompt, ans_state, vis, val, json.dumps({"text": val} if val else None)))

    cursor.executemany("""
        INSERT INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text, value_json)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """, answers_records)

    # 5. Travel Plans: Active vs Expired
    today = datetime.utcnow().date()
    travels = [
        # Marcus travels to Dubai next week (ACTIVE)
        ("trv_001", "usr_marcus", "Dubai", "United Arab Emirates", (today + timedelta(days=5)).isoformat(), (today + timedelta(days=14)).isoformat(), "Staying at DIFC Ritz-Carlton. Available for private founder dinners and meetings.", "shared"),
        # Elena travels to London next month (ACTIVE)
        ("trv_002", "usr_elena", "London", "United Kingdom", (today + timedelta(days=20)).isoformat(), (today + timedelta(days=25)).isoformat(), "Attending FinTech World Forum & meeting European partners.", "shared"),
        # Sophie had a trip to London 30 days ago (EXPIRED - Should be filtered out!)
        ("trv_003", "usr_sophie", "London", "United Kingdom", (today - timedelta(days=40)).isoformat(), (today - timedelta(days=32)).isoformat(), "Attending Maritime Tech Summit.", "shared")
    ]
    cursor.executemany("""
        INSERT INTO travel_plans (id, user_id, city, country, start_date, end_date, notes, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, travels)

    # 6. Events
    event_start_dubai = (datetime.utcnow() + timedelta(days=8)).replace(hour=19, minute=0, second=0).isoformat() + "Z"
    event_end_dubai = (datetime.utcnow() + timedelta(days=8)).replace(hour=22, minute=30, second=0).isoformat() + "Z"
    event_start_london = (datetime.utcnow() + timedelta(days=22)).replace(hour=18, minute=30, second=0).isoformat() + "Z"
    event_end_london = (datetime.utcnow() + timedelta(days=22)).replace(hour=21, minute=30, second=0).isoformat() + "Z"

    events = [
        # Regional Dinner for local testing & Dubai preview
        ("evt_dubai_dinner", "Dubai: Private Founders Dinner & Executive Exchange", "Private dinner for Dubai chapter members and visiting residents.", "ch_dubai", "Dubai Marina Yacht Club, UAE", event_start_dubai, event_end_dubai, 14, 4, 1),

        # 2026
        ("evt_miami_2026", "Miami", "Annual gathering of club members in Miami. Business agenda, venture networking, and private dinners. Registration open: Nov 13–15, 2026.", "ch_dubai", "Miami, Florida, USA", "2026-11-13T10:00:00Z", "2026-11-15T22:00:00Z", 35, 18, 1),

        # 2027
        ("evt_phuket_2027", "Phuket, Thailand", "★ Celebrate New Year together in Phuket.\nJoin starting December 31st. Gala evening at one of the island's premier beach clubs. Separate from main expedition starting January 2nd.\nRoute extension: Bangkok • Singapore 4 days • Cambodia & Angkor Wat 2–3 days.", "ch_singapore", "Phuket, Thailand (Beach Club & Private Villas)", "2027-01-02T10:00:00Z", "2027-01-09T22:00:00Z", 50, 26, 1),

        ("evt_silicon_valley_2027", "Silicon Valley", "Venture capital funds, AI labs, and private sessions with founders of leading tech companies in San Francisco and Silicon Valley.", "ch_london", "San Francisco & Silicon Valley, CA, USA", "2027-02-19T09:00:00Z", "2027-02-22T20:00:00Z", 25, 12, 1),

        ("evt_georgia_2027", "Georgia", "Spring club gathering in Georgia: executive retreat, private Kakheti wineries, closed discussions, and authentic networking.", "ch_limassol", "Tbilisi & Kakheti, Georgia", "2027-03-26T12:00:00Z", "2027-03-30T20:00:00Z", 30, 15, 1),

        ("evt_barcelona_2027", "Barcelona — 7th Year Club Jubilee", "★ 7TH YEAR CLUB JUBILEE. Main gathering of the year. Members from all chapters, executive sessions, and grand celebratory gala.", "ch_dubai", "Barcelona, Spain", "2027-04-23T10:00:00Z", "2027-04-26T23:00:00Z", 120, 64, 1),

        ("evt_central_asia_2027", "Kyrgyzstan • Uzbekistan • Azerbaijan", "Expedition across key business hubs of Central Asia and the Caucasus: emerging logistics corridors, banking infrastructure, and private meetings with regional leaders.", "ch_dubai", "Bishkek • Tashkent • Samarkand • Baku", "2027-05-15T09:00:00Z", "2027-05-23T20:00:00Z", 25, 9, 1),

        ("evt_ny_boston_2027", "New York + Boston", "Tour of seven premier US universities (Harvard, MIT, Columbia, etc.). Curated educational track for members with children: parents and children experience it together.", "ch_london", "New York & Boston (Harvard, MIT, Columbia), USA", "2027-06-10T09:00:00Z", "2027-06-18T20:00:00Z", 35, 16, 1),

        ("evt_europe_grand_2027", "London • Paris • Cannes • Zurich • Monaco", "Also in 2027 (Dates TBD): European Grand Tour. Private salons in Paris, Cannes, and Zurich, exclusive reception in Monaco.", "ch_london", "London • Paris • Cannes • Zurich • Monaco", "2027-09-18T10:00:00Z", "2027-09-28T22:00:00Z", 30, 8, 1)
    ]
    cursor.executemany("""
        INSERT INTO events (id, title, description, chapter_id, location, start_time, end_time, capacity, registered_count, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, events)

    # Event Registrations
    registrations = [
        ("evt_dubai_dinner", "usr_elena", "registered"),
        ("evt_dubai_dinner", "usr_marcus", "registered"),
        ("evt_dubai_dinner", "usr_tariq", "registered"),
        ("evt_miami_2026", "usr_elena", "registered"),
        ("evt_miami_2026", "usr_tariq", "registered"),
        ("evt_phuket_2027", "usr_elena", "registered"),
        ("evt_phuket_2027", "usr_sophie", "registered"),
        ("evt_barcelona_2027", "usr_elena", "registered"),
        ("evt_barcelona_2027", "usr_marcus", "registered"),
        ("evt_barcelona_2027", "usr_david", "registered"),
        ("evt_barcelona_2027", "usr_tariq", "registered"),
        ("evt_ny_boston_2027", "usr_marcus", "registered")
    ]
    cursor.executemany("INSERT INTO event_registrations (event_id, user_id, status) VALUES (?, ?, ?);", registrations)

    # 7. Real Estate Listings
    re_listings = [
        (
            "re_palm_villa_01",
            "Signature Waterfront Villa Collection - Palm Jumeirah",
            "Turnkey off-market beachfront villa with private infinity pool and private marina berth.",
            "Palm Jumeirah, Dubai, UAE",
            "Luxury Residential",
            "active",
            json.dumps(["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800"]),
            "/brochures/palm_jumeirah_spec.pdf",
            json.dumps({"investor_type": "accredited_or_qualified", "min_jurisdiction_check": True, "conditions_version": "2026-10-v1"}),
            "Informational showcase for community members. Does not constitute investment advice or public solicitation.",
            "usr_julia"
        ),
        (
            "re_mayfair_prime_02",
            "The Chesterfield Residences - Mayfair Conservation Quarter",
            "Restored Grade II listed freehold boutique commercial and residential asset with 6.2% net yield.",
            "Mayfair, London, UK",
            "Commercial & High-End Residential",
            "active",
            json.dumps(["https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800"]),
            "/brochures/mayfair_chesterfield.pdf",
            json.dumps({"investor_type": "institutional_or_qualified", "min_jurisdiction_check": True, "conditions_version": "2026-10-v1"}),
            "Informational showcase for community members. Does not constitute investment advice or public solicitation.",
            "usr_alexandra"
        )
    ]
    cursor.executemany("""
        INSERT INTO real_estate_listings (id, title, short_summary, location, property_type, status, images_json, brochure_document_url, eligibility_requirements, disclaimer, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, re_listings)

    # 8. Sample Calls & Introduction Requests
    calls = [
        (
            "call_001",
            "usr_marcus",
            "usr_elena",
            "proposed",
            json.dumps([
                {"start": (datetime.utcnow() + timedelta(days=6)).replace(hour=14, minute=0).isoformat() + "Z", "end": (datetime.utcnow() + timedelta(days=6)).replace(hour=14, minute=30).isoformat() + "Z"}
            ]),
            None,
            "Asia/Dubai",
            None,
            "Hi Elena, looking forward to meeting in Dubai regarding our AI treasury pilot."
        )
    ]
    cursor.executemany("""
        INSERT INTO call_bookings (id, requester_id, recipient_id, status, proposed_times_json, selected_time, timezone, meeting_link, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, calls)

    intros = [
        (
            "intro_001",
            "usr_david",
            "usr_tariq",
            "Looking to discuss syndicating a European prop-tech seed round with GCC real estate leaders.",
            "pending_admin_review",
            "Alexandra Hill",
            None
        )
    ]
    cursor.executemany("""
        INSERT INTO intro_requests (id, requester_id, target_member_id, target_context_need, status, assigned_admin, resolution_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """, intros)

    # 9. Initial Audit Log entry
    audit = [
        (
            "audit_init_001",
            "usr_alexandra",
            "view_private_answer",
            "usr_elena",
            23,
            "127.0.0.1",
            datetime.utcnow().isoformat() + "Z",
            json.dumps({"reason": "Founder pre-onboarding review"})
        )
    ]
    cursor.executemany("""
        INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, timestamp, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, audit)

    # 10. Sample Pending Invitation Token
    invites = [
        ("inv_001", "vip.candidate@fintech.ch", "ozara_invite_a8f93e1b0c", "usr_julia", (datetime.utcnow() + timedelta(days=14)).isoformat() + "Z", 0, None, None)
    ]
    cursor.executemany("""
        INSERT INTO invitation_tokens (id, email, token, created_by, expires_at, is_claimed, claimed_by, claimed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, invites)

    conn.commit()
    conn.close()
    print("[SUCCESS] ÖZARA sample dataset seeded successfully.")

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    db_file = root / "ozara.db" if (root / "ozara.db").exists() else root / "sila.db"
    seed(db_file)
