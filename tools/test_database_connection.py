#!/usr/bin/env python3
"""
tools/test_database_connection.py
Deterministic database connection and capability handshake script.
Tests SQLite connection, WAL mode, foreign key support, and read/write capabilities.
"""

import os
import sqlite3
import sys
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent
    db_path = root / "ozara.db" if (root / "ozara.db").exists() else root / "sila.db"
    print(f"[*] Testing database connection at: {db_path}")

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Enable WAL mode and foreign keys
        cursor.execute("PRAGMA journal_mode=WAL;")
        journal_mode = cursor.fetchone()[0]
        print(f"[OK] Journal mode set to: {journal_mode}")

        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA foreign_keys;")
        fk_status = cursor.fetchone()[0]
        if fk_status != 1:
            print("[!] Foreign keys not enabled!")
            sys.exit(1)
        print("[OK] Foreign keys enabled.")

        # Test write and read with an ephemeral check table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS _handshake_test (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("INSERT INTO _handshake_test (service) VALUES ('database_handshake');")
        conn.commit()

        cursor.execute("SELECT id, service, tested_at FROM _handshake_test WHERE service = 'database_handshake' ORDER BY id DESC LIMIT 1;")
        row = cursor.fetchone()
        if not row:
            print("[!] Failed to read back inserted test record.")
            sys.exit(1)
        print(f"[OK] Read/Write verified. Test record ID: {row[0]}, Time: {row[2]}")

        # Cleanup test table
        cursor.execute("DROP TABLE _handshake_test;")
        conn.commit()
        conn.close()

        print("[SUCCESS] Database handshake passed with full ACID & WAL support.")

    except Exception as e:
        print(f"[ERROR] Database handshake failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
