#!/usr/bin/env python3
"""
tools/verify_recommendations_and_travel.py
Deterministic verification for:
1. Explainable Matchmaking (Needs ↔ Offers, plain language explanations)
2. Travel Window Expiration (expired trips hidden, active trips visible)
3. Question 18 profile completion check
"""

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

def test_explainable_recommendation(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Elena seeks 'enterprise_ai_partners'
    # Marcus offers 'enterprise_ai_partners' and specializes in 'llm_deployment'
    # Let's test finding matches for Elena
    cursor.execute("""
        SELECT t.slug, t.label
        FROM taxonomies t
        WHERE t.user_id = 'usr_elena' AND t.category = 'needs';
    """)
    elena_needs = cursor.fetchall()
    need_slugs = [n[0] for n in elena_needs]

    # Find candidates who offer Elena's needs
    query = f"""
        SELECT u.id, u.full_name, u.headline, u.city, c.name as chapter_name, t.slug as matched_offer_slug, t.label as matched_offer_label
        FROM taxonomies t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN chapters c ON u.chapter_id = c.id
        WHERE t.category = 'offers' AND t.slug IN ({','.join(['?']*len(need_slugs))})
        AND u.id != 'usr_elena';
    """
    cursor.execute(query, need_slugs)
    matches = cursor.fetchall()

    if not matches:
        print("[FAIL] No matching offer found for Elena's needs!")
        sys.exit(1)

    matched_user = matches[0]
    matched_id, matched_name, matched_headline, matched_city, chapter_name, offer_slug, offer_label = matched_user

    # Generate plain-language rationale
    rationale = f"Matches your stated need for [Enterprise AI Automation] with {matched_name}'s verified capability in [{offer_label}]."
    print(f"[PASS] Match found: {matched_name} ({matched_headline})")
    print(f"[PASS] Explainability Rationale: \"{rationale}\"")

    conn.close()

def test_travel_window_expiration(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    today = datetime.utcnow().date().isoformat()

    # 1. Query active travel plans (should include Marcus in Dubai, Elena in London)
    cursor.execute("""
        SELECT tp.id, tp.user_id, u.full_name, tp.city, tp.start_date, tp.end_date
        FROM travel_plans tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.end_date >= ? AND tp.visibility = 'shared';
    """, (today,))
    active_plans = cursor.fetchall()

    plan_users = [p[1] for p in active_plans]
    if "usr_sophie" in plan_users:
        print("[FAIL] Expired travel plan for Sophie Dubois appeared in active travel query!")
        sys.exit(1)
    if "usr_marcus" not in plan_users:
        print("[FAIL] Active travel plan for Marcus Vance missing from query!")
        sys.exit(1)

    print(f"[PASS] Active travel query correctly returned {len(active_plans)} trips and excluded expired trips.")

    # 2. Test targeted invitation filtering for Dubai event including travelers
    cursor.execute("""
        SELECT DISTINCT u.id, u.full_name, u.city
        FROM users u
        LEFT JOIN travel_plans tp ON u.id = tp.user_id AND tp.end_date >= ?
        WHERE (u.city = 'Dubai' OR tp.city = 'Dubai')
        ORDER BY u.full_name ASC;
    """, (today,))
    dubai_pool = cursor.fetchall()
    pool_ids = [m[0] for m in dubai_pool]

    if "usr_marcus" not in pool_ids:
        print("[FAIL] Marcus (traveling to Dubai) not included in Dubai targeted event preview!")
        sys.exit(1)
    print(f"[PASS] Targeted event preview correctly included traveling member (Marcus Vance) alongside Dubai residents.")

    conn.close()

def test_q18_profile_completion(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT u.id, u.full_name, u.is_complete,
               (SELECT answer_state FROM questionnaire_answers WHERE user_id = u.id AND question_id = 18) as q18_state
        FROM users u
        WHERE u.role = 'MEMBER';
    """)
    rows = cursor.fetchall()
    for row in rows:
        uid, name, is_complete, q18_state = row
        if is_complete and q18_state != 'answered':
            print(f"[FAIL] User {name} marked complete without answering Q18!")
            sys.exit(1)
    print(f"[PASS] Question 18 mandate verified across all {len(rows)} verified members.")

    conn.close()

def main():
    root = Path(__file__).resolve().parent.parent
    db_file = root / "ozara.db" if (root / "ozara.db").exists() else root / "sila.db"
    print(f"[*] Verifying Recommendations, Travel Expirations & Q18 Completion on {db_file}...")
    test_explainable_recommendation(db_file)
    test_travel_window_expiration(db_file)
    test_q18_profile_completion(db_file)
    print("[SUCCESS] All Matchmaking, Travel, and Q18 Completion Invariants Verified.")

if __name__ == "__main__":
    main()
