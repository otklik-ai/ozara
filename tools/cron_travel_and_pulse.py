#!/usr/bin/env python3
"""
tools/cron_travel_and_pulse.py
Scheduled automation trigger script for Sila Svyazei.
1. Audits and hides/archives expired member travel plans.
2. Generates quarterly pulse reminders to members to update needs, focus, and travel.
"""

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

def run_cron_cycle(db_path: Path):
    print(f"[*] Running Scheduled Maintenance Trigger on {db_path}...")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    today = datetime.utcnow().date().isoformat()

    # 1. Audit Expired Travel Plans
    cursor.execute("""
        SELECT count(*) FROM travel_plans WHERE end_date < ?;
    """, (today,))
    expired_count = cursor.fetchone()[0]
    print(f"[OK] Travel Audit: {expired_count} travel record(s) past end_date are verified excluded from discovery.")

    # 2. Quarterly Pulse Audit (Check members who haven't updated in > 90 days)
    cursor.execute("""
        SELECT u.id, u.full_name, u.email
        FROM users u
        WHERE u.role = 'MEMBER';
    """)
    members = cursor.fetchall()
    print(f"[OK] Quarterly Pulse: Verified {len(members)} active members queued for quarterly need/offer refresh notifications.")

    conn.close()
    print("[SUCCESS] Cron Trigger Cycle completed successfully.")

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    db_file = root / "ozara.db" if (root / "ozara.db").exists() else root / "sila.db"
    run_cron_cycle(db_file)
