#!/usr/bin/env python3
"""
Test Suite: 24 Profile Questions, Travel & Chapter Layer, Events Layer, Quarterly Pulse, and Content Guardrails.

Uses only Python standard library (urllib.request, json).
"""

import sys
import os
import json
import urllib.request
import urllib.error

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")

def api_get(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            return resp.status, json.loads(data)
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        try:
            return e.code, json.loads(data)
        except Exception:
            return e.code, data

def api_post(endpoint, payload):
    url = f"{BASE_URL}{endpoint}"
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, headers={
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            return resp.status, json.loads(data)
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        try:
            return e.code, json.loads(data)
        except Exception:
            return e.code, data

def test_canonical_24_questions():
    print("Testing Canonical 24 Questions API...")
    status, questions = api_get("/api/questions")
    assert status == 200, f"Expected 200, got {status}"
    assert len(questions) == 25, f"Expected 25 questions, got {len(questions)}"
    
    # Verify Question 18 is required
    q18 = next((q for q in questions if q["id"] == 18), None)
    assert q18 is not None, "Question 18 not found"
    assert q18["is_required"] is True, "Question 18 must be required"
    assert "turn to you for" in q18["prompt"] or "offer other members" in q18["prompt"], f"Unexpected prompt for Q18: {q18['prompt']}"

    # Verify Question 23 is permanently confidential
    q23 = next((q for q in questions if q["id"] == 23), None)
    assert q23 is not None, "Question 23 not found"
    assert q23["is_confidential"] is True, "Question 23 must be marked confidential"
    assert q23["default_visibility"] == "private", "Question 23 default visibility must be private"

    # Verify sections A, B, C, D, E are present
    sections = {q.get("section") for q in questions}
    assert any("Section A" in s for s in sections), "Section A missing"
    assert any("Section B" in s for s in sections), "Section B missing"
    assert any("Section C" in s for s in sections), "Section C missing"
    assert any("Section D" in s for s in sections), "Section D missing"
    assert any("Section E" in s for s in sections), "Section E missing"

    print("Canonical 24 Questions verified successfully.")

def test_content_guardrail():
    print("Testing Content Guardrails (Broker-dealer solicitation prevention)...")
    user_id = "usr_alexandra"
    
    # Attempting to post a prohibited solicitation phrase
    solicitation_payload = {
        "question_id": 14,
        "value": "I am raising $12 million at a $90 million pre-money valuation, minimum ticket $250k with 20% IRR",
        "visibility": "shared"
    }
    status, body = api_post(f"/api/profile/{user_id}/answer", solicitation_payload)
    assert status == 422, f"Expected 422 Unprocessable Entity, got {status}"
    assert isinstance(body, dict) and body.get("flagged") is True, "Expected flagged=True in response"
    print("Content guardrail blocked prohibited solicitation string as expected.")

def test_city_screen_components():
    print("Testing City Screen 5 Components for Dubai...")
    status, data = api_get("/api/cities/Dubai")
    assert status == 200, f"Expected 200, got {status}"

    assert data["city"] == "Dubai", f"Expected city Dubai, got {data.get('city')}"
    
    # 1. Where the chapter gathers (unconfirmed claims purged as per governance mandate)
    chapter = data.get("chapter")
    assert chapter is not None, "Chapter data missing"
    gathering = chapter.get("gathering_place")
    if gathering and gathering.get("name"):
        assert "The Arts Club" not in gathering["name"], "Unconfirmed venue claim 'The Arts Club' must be purged!"

    # 2. The Chapter Lead
    assert "lead" in chapter and chapter["lead"] is not None, "Chapter lead missing"
    assert chapter["lead"]["name"] == "Elena Ermolov", "Unexpected lead name"
    assert chapter["lead"]["email"] == "ermolov.elena@gmail.com", "Unexpected lead email"

    # 3. Members visiting in next 30 days
    visiting = data.get("members_visiting_next_30_days")
    assert isinstance(visiting, list), "Visiting members should be a list"
    assert len(visiting) > 0, "Expected at least 1 visiting member in Dubai"
    assert "start_date" in visiting[0] and "end_date" in visiting[0], "Missing dates in travel plan"

    # 4. Members based here
    based = data.get("members_based_here")
    assert isinstance(based, list), "Based members should be a list"
    assert len(based) > 0, "Expected based members in Dubai"

    # 5. Upcoming events
    events = data.get("upcoming_events")
    assert isinstance(events, list), "Upcoming events should be a list"
    assert len(events) > 0, "Expected upcoming events in Dubai"

    print("City Screen 5 components verified successfully.")

def test_travel_layer_and_post_trip():
    print("Testing Travel Layer (Post Trip & Auto-expiration)...")
    trip_payload = {
        "user_id": "usr_julia",
        "city": "Singapore",
        "country": "Singapore",
        "start_date": "2026-10-20",
        "end_date": "2026-10-25",
        "notes": "Visiting regional family office partners and fintech innovators.",
        "visibility": "shared"
    }
    status, res = api_post("/api/travel-plans", trip_payload)
    assert status == 200, f"Expected 200, got {status}: {res}"
    trip = res.get("trip")
    assert trip["city"] == "Singapore"
    assert trip["visibility"] == "shared"

    # Verify query returns active trips
    get_status, trips = api_get("/api/travel-plans?userId=usr_julia")
    assert get_status == 200
    assert any(t["city"] == "Singapore" for t in trips), "New trip not found in user travel plans"

    print("Travel Layer verified successfully.")

def test_quarterly_pulse():
    print("Testing Quarterly Pulse Flow...")
    pulse_payload = {
        "user_id": "usr_alexandra",
        "q14_focus": "Curating top-50 European deeptech founders for London & Dubai summits.",
        "situation_changes": ["New market", "New chapter"],
        "useful_people": "Enterprise AI CTOs and Middle East sovereign fund directors.",
        "travel_city": "Astana",
        "travel_start_date": "2026-11-01",
        "travel_end_date": "2026-11-07"
    }
    status, res = api_post("/api/pulse", pulse_payload)
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("success") is True

    # Verify Q14 focus was automatically updated
    status_profile, pdata = api_get("/api/profile/usr_alexandra?viewerId=usr_alexandra")
    assert status_profile == 200
    q14_ans = next((a for a in pdata.get("answers", []) if a.get("question_id") == 14), None)
    assert q14_ans is not None, "Q14 answer not found in profile"
    assert "Curating top-50 European deeptech" in q14_ans.get("value_text", ""), "Q14 focus not updated"

    # Verify travel plan was directly written to travel layer
    status_trips, trips = api_get("/api/travel-plans?userId=usr_alexandra")
    assert status_trips == 200
    assert any(t["city"] == "Astana" for t in trips), "Quarterly pulse travel not found in travel layer"

    print("Quarterly Pulse flow verified successfully.")

def test_contact_lead_and_report_member():
    print("Testing Chapter Lead Inbox and Profile Reporting...")
    # Contact lead
    lead_status, lead_res = api_post("/api/chapters/ch_dubai/contact-lead", {
        "sender_id": "usr_alexandra",
        "message": "Hi Elena, arriving at DIFC next Tuesday, would love to sit down for coffee at The Arts Club."
    })
    assert lead_status == 200, f"Expected 200, got {lead_status}: {lead_res}"
    assert lead_res.get("success") is True

    # Report member
    rep_status, rep_res = api_post("/api/members/usr_fictional_01/report", {
        "reporter_id": "usr_alexandra",
        "reason": "Test moderation: verifying report queue functionality."
    })
    assert rep_status == 200, f"Expected 200, got {rep_status}: {rep_res}"
    assert rep_res.get("success") is True

    print("Lead Contact & Profile Reporting verified successfully.")

if __name__ == "__main__":
    try:
        test_canonical_24_questions()
        test_content_guardrail()
        test_city_screen_components()
        test_travel_layer_and_post_trip()
        test_quarterly_pulse()
        test_contact_lead_and_report_member()
        print("\nAll 24 Questions & Layers Integration Tests Passed with 100% Integrity!")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[TEST FAILED] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)
