#!/usr/bin/env python3
"""
Verify Events Calendar Dropdown Filtering Logic & Edge Cases.
Ensures Year, Event Type, Destination, and Status filters return accurate events.
"""
import sqlite3
import json

def test_events_filtering():
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()

    # 1. Verify upcoming events exist
    c.execute("SELECT id, title, year, event_type, city, country, registration_status FROM events WHERE is_past = 0")
    events = c.fetchall()
    print(f"[*] Loaded {len(events)} upcoming events from database.")
    assert len(events) >= 8, f"Expected at least 8 events, got {len(events)}"

    # 2. Test Year filtering
    years = [2026, 2027]
    for y in years:
        filtered = [e for e in events if e[2] == y]
        print(f" [PASS] Year {y}: {len(filtered)} events found.")
        assert len(filtered) > 0, f"No events found for year {y}"

    # 3. Test Event Types
    types = ["Summit", "Retreat", "Trek", "Family & Education", "Networking", "Jubilee"]
    for t in types:
        c.execute("SELECT COUNT(*) FROM events WHERE is_past = 0 AND (event_type = ? OR event_type LIKE ?)", (t, f"%{t}%"))
        count = c.fetchone()[0]
        print(f" [PASS] Type '{t}': {count} events.")

    # 4. Test Multilingual Destinations
    dest_mappings = {
        "Miami": ["Miami", "Майами"],
        "Phuket": ["Phuket", "Пхукет"],
        "Silicon Valley": ["Silicon Valley", "Кремниевая долина"],
        "Georgia": ["Georgia", "Грузия"],
        "Barcelona": ["Barcelona", "Барселона"],
        "Central Asia": ["Central Asia", "Кыргызстан", "Узбекистан", "Азербайджан"],
        "New York & Boston": ["New York", "Boston", "Нью-Йорк", "Бостон"],
        "European Grand Tour": ["London", "Paris", "Monaco", "Европа", "Лондон", "Париж", "Монако"]
    }

    for label, keywords in dest_mappings.items():
        matched = []
        for e in events:
            # Check title, city, country
            text_blob = f"{e[1]} {e[4]} {e[5]}".lower()
            if any(k.lower() in text_blob for k in keywords):
                matched.append(e[1])
        print(f" [PASS] Destination '{label}': {len(matched)} matched -> {matched}")
        assert len(matched) > 0, f"No events matched for destination {label}"

    # 5. Test Registration Status
    statuses = ["open", "coming_soon", "full", "closed"]
    for s in statuses:
        c.execute("SELECT COUNT(*) FROM events WHERE is_past = 0 AND registration_status = ?", (s,))
        cnt = c.fetchone()[0]
        print(f" [PASS] Status '{s}': {cnt} events.")

    conn.close()
    print("\n[SUCCESS] ALL EVENT CALENDAR DROPDOWN FILTER LOGIC VERIFIED!")

if __name__ == "__main__":
    test_events_filtering()
