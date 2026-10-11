#!/usr/bin/env python3
"""
tools/test_events_calendar.py
Automated test suite verifying the Chronological Event Calendar redesign,
data integrity invariants, admin update endpoints, and personal calendar (.ics) generation.
"""

import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"

def make_req(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            resp_headers = dict(response.info())
            raw = response.read().decode("utf-8")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw
            return status, parsed, resp_headers
    except urllib.error.HTTPError as e:
        status = e.code
        resp_headers = dict(e.headers)
        raw = e.read().decode("utf-8")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return status, parsed, resp_headers

def run_tests():
    print("[*] Starting Chronological Event Calendar Integration Test Suite...")

    # 1. Fetch Events for Founder Elena
    status, events, _ = make_req("/api/events?userId=usr_elena")
    assert status == 200, f"Failed to get events: {events}"
    assert isinstance(events, list), f"Expected list, got {type(events)}"
    assert len(events) >= 8, f"Expected at least 8 upcoming events, got {len(events)}"
    print(f" [PASS] Fetched {len(events)} upcoming calendar events.")

    # 2. Chronological Ordering Verification
    dated_events = [e for e in events if e.get("date_precision") != "tba"]
    for i in range(len(dated_events) - 1):
        curr_time = dated_events[i].get("start_time")
        next_time = dated_events[i+1].get("start_time")
        assert curr_time <= next_time, f"Chronological ordering violation: {dated_events[i]['title']} ({curr_time}) vs {dated_events[i+1]['title']} ({next_time})"
    print(" [PASS] Chronological ordering invariant verified (nearest upcoming first).")

    # 3. Next Upcoming Event Highlighting
    first_event = events[0]
    assert first_event["is_next_upcoming"] is True, f"First event {first_event['id']} should have is_next_upcoming=True"
    assert first_event["id"] == "evt_miami_2026", f"Expected Miami 2026 as next upcoming event, got {first_event['id']}"
    print(f" [PASS] Next upcoming spotlight verified: {first_event['headline']} (is_next_upcoming=True).")

    # 4. Strict Data Integrity Invariants (No Fabricated Fields)
    # Check Month-Only Events (Central Asia, NY+Boston)
    central_asia = next((e for e in events if e["id"] == "evt_central_asia_2027"), None)
    assert central_asia is not None, "Central Asia event missing"
    assert central_asia["date_precision"] == "month_only", f"Expected month_only precision, got {central_asia['date_precision']}"
    assert central_asia["start_date"] is None, "start_date should be None for month_only precision (no fabricated days)"
    assert central_asia["venue"] == "To be announced", f"Expected venue 'To be announced', got {central_asia['venue']}"
    assert central_asia["display_date"] == "май 2027", f"Expected display_date 'май 2027', got {central_asia['display_date']}"
    print(" [PASS] Month-only precision verified: No invented days for Central Asia (display: 'май 2027').")

    ny_boston = next((e for e in events if e["id"] == "evt_ny_boston_2027"), None)
    assert ny_boston is not None, "NY+Boston event missing"
    assert ny_boston["date_precision"] == "month_only", f"Expected month_only precision, got {ny_boston['date_precision']}"
    assert ny_boston["start_date"] is None, "start_date should be None for month_only precision"
    print(" [PASS] Month-only precision verified: No invented days for New York + Boston (display: 'июнь 2027').")

    # Check TBA Event (European Grand Tour)
    europe_tba = next((e for e in events if e["id"] == "evt_europe_grand_2027"), None)
    assert europe_tba is not None, "Europe Grand Tour event missing"
    assert europe_tba["date_precision"] == "tba", f"Expected tba precision, got {europe_tba['date_precision']}"
    assert europe_tba["start_date"] is None, "start_date should be None for TBA event"
    assert europe_tba["capacity"] is None, f"Expected capacity None for unconfirmed capacity, got {europe_tba['capacity']}"
    print(" [PASS] Dates to Be Announced section verified: European Grand Tour has date_precision='tba' and capacity=None.")

    # 5. Dedicated Single Event Details API
    status_det, phuket, _ = make_req("/api/events/evt_phuket_2027?userId=usr_elena")
    assert status_det == 200, f"Failed to get Phuket details: {phuket}"
    assert phuket["id"] == "evt_phuket_2027"
    assert phuket["agenda"] is not None and len(phuket["agenda"]) > 20, "Phuket agenda missing or too short"
    assert phuket["travel_info"] is not None and "Bangkok" in phuket["travel_info"], "Phuket travel info missing route extension"
    assert isinstance(phuket.get("attendees"), list), "Phuket attendees should be an array"
    print(f" [PASS] Dedicated Event Details verified for {phuket['headline']} with agenda and route extension.")

    # 6. Personal Calendar .ICS Generation
    status_ics, ics_text, ics_headers = make_req("/api/events/evt_miami_2026/ics")
    assert status_ics == 200, f"Failed to get ICS: {status_ics}"
    assert "text/calendar" in ics_headers.get("Content-Type", "") or "text/calendar" in ics_headers.get("content-type", ""), f"Wrong Content-Type: {ics_headers}"
    assert "BEGIN:VCALENDAR" in ics_text, "Missing BEGIN:VCALENDAR"
    assert "BEGIN:VEVENT" in ics_text, "Missing BEGIN:VEVENT"
    assert "UID:evt_miami_2026@ozara.club" in ics_text, "Missing UID in ICS"
    assert "20261113" in ics_text, f"Missing start date in ICS: {ics_text}"
    print(" [PASS] RFC 5545 iCalendar (.ics) generation verified successfully.")

    # 7. Admin Update Permissions & Persistence
    # 7a. Non-admin update blocked with 403
    status_unauth, unauth_res, _ = make_req(
        "/api/events/evt_miami_2026?userId=usr_marcus",
        method="PUT",
        data={"venue": "Hacked Venue"}
    )
    assert status_unauth == 403, f"Non-admin should be blocked with 403, got {status_unauth}: {unauth_res}"
    print(" [PASS] Admin permission barrier verified: Non-admin update blocked with 403.")

    # 7b. Founder update allowed and verified
    status_admin, admin_res, _ = make_req(
        "/api/events/evt_miami_2026?userId=usr_elena",
        method="PUT",
        data={
            "venue": "Faena Hotel & Private Ocean Salon",
            "price": "Included for Premier Members"
        }
    )
    assert status_admin == 200, f"Admin update failed: {admin_res}"
    updated_evt = admin_res["event"]
    assert updated_evt["venue"] == "Faena Hotel & Private Ocean Salon", f"Venue not updated: {updated_evt['venue']}"
    assert updated_evt["price"] == "Included for Premier Members", f"Price not updated: {updated_evt['price']}"
    print(" [PASS] Admin event update persisted successfully via PUT /api/events/:id.")

    # Restore venue for clean state
    make_req(
        "/api/events/evt_miami_2026?userId=usr_elena",
        method="PUT",
        data={"venue": "To be confirmed", "price": "To be confirmed"}
    )

    # 8. RSVP Interaction Endpoint
    status_rsvp, rsvp_res, _ = make_req(
        "/api/events/rsvp",
        method="POST",
        data={"eventId": "evt_phuket_2027", "userId": "usr_marcus", "status": "registered"}
    )
    assert status_rsvp == 200, f"RSVP failed: {rsvp_res}"
    assert rsvp_res["success"] is True
    assert rsvp_res["registered_count"] >= 1
    print(" [PASS] RSVP registration interaction verified.")

    # 9. Past Events Archive Verification
    status_past, past_events, _ = make_req("/api/events?userId=usr_elena&past_only=true")
    assert status_past == 200, f"Failed to get past events: {past_events}"
    assert len(past_events) >= 2, f"Expected at least 2 past events, got {len(past_events)}"
    for pe in past_events:
        assert pe.get("is_past") == 1 or pe.get("is_past") is True, f"Event {pe['id']} should have is_past=1"
    print(f" [PASS] Past Events Archive verified: {len(past_events)} archived events returned with is_past=1.")

    print("\n[SUCCESS] ALL CHRONOLOGICAL EVENT CALENDAR TESTS PASSED 100%!")

if __name__ == '__main__':
    run_tests()
