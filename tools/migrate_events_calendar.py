#!/usr/bin/env python3
"""
tools/migrate_events_calendar.py
Expands the 'events' table schema with full structured calendar fields and seeds
the canonical 2026/2027 event calendar from the official poster into ozara.db and sila.db.
"""

import sqlite3
import os
import json
from datetime import datetime

DATABASES = [
    "/Users/bikram6am/Sila/ozara.db",
    "/Users/bikram6am/Sila/sila.db"
]

def migrate_database(db_path):
    if not os.path.exists(db_path):
        print(f"[SKIP] Database {db_path} does not exist.")
        return

    print(f"[*] Migrating events table in {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Add missing columns to 'events' table if not already present
    columns_to_add = [
        ("headline", "TEXT"),
        ("event_type", "TEXT DEFAULT 'Summit'"),
        ("start_date", "TEXT"),
        ("end_date", "TEXT"),
        ("date_precision", "TEXT DEFAULT 'exact'"),  # 'exact', 'month_only', 'tba'
        ("display_date", "TEXT"),
        ("year", "INTEGER"),
        ("month_name", "TEXT"),
        ("city", "TEXT"),
        ("region", "TEXT"),
        ("country", "TEXT"),
        ("venue", "TEXT DEFAULT 'To be confirmed'"),
        ("available_spots", "INTEGER"),
        ("registration_status", "TEXT DEFAULT 'coming_soon'"), # 'open', 'coming_soon', 'full', 'closed'
        ("registration_link", "TEXT"),
        ("price", "TEXT DEFAULT 'To be confirmed'"),
        ("whats_included", "TEXT"),
        ("travel_info", "TEXT"),
        ("hosts", "TEXT"),
        ("hero_image", "TEXT"),
        ("agenda", "TEXT"),
        ("is_past", "BOOLEAN DEFAULT 0"),
        ("cover_image", "TEXT")
    ]

    cursor.execute("PRAGMA table_info(events)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    for col_name, col_type in columns_to_add:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")
            print(f"  + Added column {col_name} ({col_type})")

    # 2. Canonical Events from the 2026 / 2027 Poster
    canonical_events = [
        # --- 2026 ---
        {
            "id": "evt_miami_2026",
            "title": "Miami",
            "headline": "Miami Annual Member Gathering & Venture Summit",
            "description": "Annual gathering of club members in Miami. High-conviction venture networking, private investor dinners, and cross-chapter executive sessions with international members.",
            "event_type": "Summit",
            "chapter_id": "ch_miami",
            "start_time": "2026-11-13T10:00:00Z",
            "end_time": "2026-11-15T22:00:00Z",
            "start_date": "2026-11-13",
            "end_date": "2026-11-15",
            "date_precision": "exact",
            "display_date": "13–15 ноября 2026",
            "year": 2026,
            "month_name": "November",
            "city": "Miami",
            "region": "Florida",
            "country": "USA",
            "location": "Miami, Florida, USA",
            "venue": "To be confirmed",
            "capacity": 35,
            "registered_count": 18,
            "available_spots": 17,
            "registration_status": "open",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Private executive sessions, networking receptions, curated dinners, and masterclasses.",
            "travel_info": "Recommended arrival: November 12. Direct flights to MIA or FLL. Preferred partner hotels in Brickell and South Beach.",
            "hosts": "Miami Chapter Leadership & Founders",
            "hero_image": "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1200&q=80",
            "agenda": "Day 1: Welcome cocktail and opening keynote. Day 2: Strategic venture salons and private member dinners. Day 3: Yacht expedition and executive advisory roundtables.",
            "is_published": 1,
            "is_past": 0
        },

        # --- 2027 ---
        {
            "id": "evt_phuket_2027",
            "title": "Пхукет, Таиланд",
            "headline": "New Year Expedition & Founder Retreat in Phuket",
            "description": "Celebrate the New Year together with club members on Phuket. Join starting December 31st for a festive evening at a premier island beach club, leading into a week-long leadership retreat and route extension through Bangkok, Singapore, and Cambodia.",
            "event_type": "Retreat",
            "chapter_id": "ch_singapore",
            "start_time": "2027-01-02T10:00:00Z",
            "end_time": "2027-01-09T22:00:00Z",
            "start_date": "2027-01-02",
            "end_date": "2027-01-09",
            "date_precision": "exact",
            "display_date": "2–9 января 2027",
            "year": 2027,
            "month_name": "January",
            "city": "Phuket",
            "region": "Phuket Province",
            "country": "Thailand",
            "location": "Phuket, Thailand",
            "venue": "Private Coastal Villas & Beach Club, Phuket",
            "capacity": 50,
            "registered_count": 26,
            "available_spots": 24,
            "registration_status": "open",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Luxury beachfront villa accommodations, gala dinner, private catamaran charter, and wellness program.",
            "travel_info": "Celebrate New Year together from December 31 at premier beach club. Route extension: Bangkok + Singapore (4 days) · Cambodia & Angkor Wat (2–3 days).",
            "hosts": "Southeast Asia Chapter Leads & Founders",
            "hero_image": "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1200&q=80",
            "agenda": "Dec 31: Optional New Year's Eve Beach Club Gala. Jan 2-4: Keynotes, health & wellness sessions, and private dinners. Jan 5-7: Island catamaran expedition & venture workshops. Jan 8-9: Closing banquet. Optional extension follows.",
            "is_published": 1,
            "is_past": 0
        },
        {
            "id": "evt_silicon_valley_2027",
            "title": "Кремниевая долина",
            "headline": "Silicon Valley AI & Venture Capital Expedition",
            "description": "Exclusive venture capital funds, frontier AI research laboratories, and private boardroom sessions with founders of leading tech enterprises in San Francisco and Silicon Valley.",
            "event_type": "Summit",
            "chapter_id": "ch_silicon_valley",
            "start_time": "2027-02-19T09:00:00Z",
            "end_time": "2027-02-22T20:00:00Z",
            "start_date": "2027-02-19",
            "end_date": "2027-02-22",
            "date_precision": "exact",
            "display_date": "19–22 февраля 2027",
            "year": 2027,
            "month_name": "February",
            "city": "San Francisco & Silicon Valley",
            "region": "California",
            "country": "USA",
            "location": "Silicon Valley, CA, USA",
            "venue": "To be confirmed",
            "capacity": 25,
            "registered_count": 0,
            "available_spots": None,
            "registration_status": "coming_soon",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Private venture boardroom sessions, curated dinners with tech executives, and private Bay Area coach transportation.",
            "travel_info": "Fly to SFO or SJC. Coordinated club accommodations in Palo Alto / Menlo Park.",
            "hosts": "Silicon Valley Chapter Leadership",
            "hero_image": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&q=80",
            "agenda": "Day 1: AI Laboratory visits & founder roundtables. Day 2: Sand Hill Road venture firm discussions. Day 3: Emerging enterprise demo day & private dinner. Day 4: Strategic debrief.",
            "is_published": 1,
            "is_past": 0
        },
        {
            "id": "evt_georgia_2027",
            "title": "Грузия",
            "headline": "Spring Executive Retreat & Winemaker Salons in Georgia",
            "description": "Spring club retreat in Georgia combining closed-door strategic roundtables in Tbilisi with private Kakheti estate vineyard tours, closed tastings, and authentic cultural networking.",
            "event_type": "Retreat",
            "chapter_id": "ch_limassol",
            "start_time": "2027-03-26T12:00:00Z",
            "end_time": "2027-03-30T20:00:00Z",
            "start_date": "2027-03-26",
            "end_date": "2027-03-30",
            "date_precision": "exact",
            "display_date": "26–30 марта 2027",
            "year": 2027,
            "month_name": "March",
            "city": "Tbilisi & Kakheti",
            "region": "Kakheti",
            "country": "Georgia",
            "location": "Tbilisi & Kakheti, Georgia",
            "venue": "To be confirmed",
            "capacity": 30,
            "registered_count": 0,
            "available_spots": None,
            "registration_status": "coming_soon",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Boutique accommodations in Tbilisi and Kakheti, private estate dinners, winery tours, and local transfers.",
            "travel_info": "Direct flights to TBS (Tbilisi International Airport).",
            "hosts": "Regional Chapter Leads",
            "hero_image": "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=1200&q=80",
            "agenda": "Day 1: Welcome dinner in Old Tbilisi. Day 2: Executive economic forum & private receptions. Day 3-4: Kakheti winery retreats & roundtable dinners. Day 5: Return to Tbilisi.",
            "is_published": 1,
            "is_past": 0
        },
        {
            "id": "evt_barcelona_2027",
            "title": "Барселона",
            "headline": "Barcelona — 7th Year Club Jubilee & Global Gala",
            "description": "7 Years of Club «Sila Svyazei» (ÖZARA). The premier gathering of the entire year uniting members from all chapters worldwide for executive keynote discussions, private cultural viewings, and a grand anniversary gala evening.",
            "event_type": "Jubilee",
            "chapter_id": "ch_dubai",
            "start_time": "2027-04-23T10:00:00Z",
            "end_time": "2027-04-26T23:00:00Z",
            "start_date": "2027-04-23",
            "end_date": "2027-04-26",
            "date_precision": "exact",
            "display_date": "23–26 апреля 2027",
            "year": 2027,
            "month_name": "April",
            "city": "Barcelona",
            "region": "Catalonia",
            "country": "Spain",
            "location": "Barcelona, Spain",
            "venue": "To be confirmed",
            "capacity": 150,
            "registered_count": 0,
            "available_spots": None,
            "registration_status": "coming_soon",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Full access to 3-day anniversary conference, gala banquet, private architectural tour, and executive cocktail receptions.",
            "travel_info": "Direct flights to BCN (Josep Tarradellas Barcelona-El Prat Airport). Preferred partner hotels on Passeig de Gràcia.",
            "hosts": "Alexandra Hill, Julia Shchukina & Global Chapter Leads",
            "hero_image": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&q=80",
            "agenda": "Day 1: Welcome reception & rooftop mixer. Day 2: Full-day global member summit, sector panels & keynote discussions. Day 3: Grand 7-Year Jubilee Gala Dinner. Day 4: Private architectural & cultural tour.",
            "is_published": 1,
            "is_past": 0
        },
        {
            "id": "evt_central_asia_2027",
            "title": "Кыргызстан · Узбекистан · Азербайджан",
            "headline": "Silk Road & Caspian Cross-Border Business Expedition",
            "description": "High-level expedition exploring emerging logistics corridors, sovereign investment initiatives, banking infrastructure, and direct meetings with key regional leaders across Central Asia and the Caucasus.",
            "event_type": "Trek",
            "chapter_id": "ch_astana",
            "start_time": "2027-05-01T00:00:00Z",
            "end_time": "2027-05-31T23:59:59Z",
            "start_date": None,
            "end_date": None,
            "date_precision": "month_only",
            "display_date": "май 2027",
            "year": 2027,
            "month_name": "May",
            "city": "Bishkek · Tashkent · Samarkand · Baku",
            "region": "Central Asia & Caucasus",
            "country": "Kyrgyzstan · Uzbekistan · Azerbaijan",
            "location": "Bishkek · Tashkent · Samarkand · Baku",
            "venue": "To be announced",
            "capacity": 25,
            "registered_count": 0,
            "available_spots": None,
            "registration_status": "coming_soon",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Inter-city private charters, 5-star hotel accommodations, government & banking delegation meetings, cultural dinners.",
            "travel_info": "Multi-city route starting in Bishkek and concluding in Baku. Club concierge handles local logistics and transfers.",
            "hosts": "Central Asia Chapter Leadership",
            "hero_image": "https://images.unsplash.com/photo-1544986581-efac024faf62?w=1200&q=80",
            "agenda": "Multi-city exploration of banking infrastructure, trade corridors, and sovereign investment opportunities across Central Asia and Azerbaijan. Detailed schedule announced upon registration opening.",
            "is_published": 1,
            "is_past": 0
        },
        {
            "id": "evt_ny_boston_2027",
            "title": "Нью-Йорк + Бостон",
            "headline": "Seven Premier Universities Tour: Family & Next-Gen Educational Programme",
            "description": "Curated tour across seven prestigious US universities including Harvard, MIT, and Columbia. Specially designed family program for members with children, where parents and children experience it together.",
            "event_type": "Family & Education",
            "chapter_id": "ch_boston",
            "start_time": "2027-06-01T00:00:00Z",
            "end_time": "2027-06-30T23:59:59Z",
            "start_date": None,
            "end_date": None,
            "date_precision": "month_only",
            "display_date": "июнь 2027",
            "year": 2027,
            "month_name": "June",
            "city": "New York & Boston",
            "region": "NY / MA",
            "country": "USA",
            "location": "New York & Boston, USA",
            "venue": "To be announced",
            "capacity": 35,
            "registered_count": 0,
            "available_spots": None,
            "registration_status": "coming_soon",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "Private campus seminars, admissions consultations, faculty introductions, family dinners, and transport between NYC and Boston.",
            "travel_info": "Fly into NYC (JFK/EWR) and depart from Boston (BOS). Private executive coach between cities.",
            "hosts": "US Chapter Leads & Education Advisory Board",
            "hero_image": "/events/ny_boston.jpg",
            "agenda": "Days 1-3: New York City (Columbia, NYU, private museum tour). Days 4-7: Boston & Cambridge (Harvard, MIT, Tufts, campus admissions deep-dives & family dinners).",
            "is_published": 1,
            "is_past": 0
        },

        # --- DATES TO BE ANNOUNCED ---
        {
            "id": "evt_europe_grand_2027",
            "title": "Лондон · Париж · Канны · Цюрих · Монако",
            "headline": "European Chapter Gatherings & Grand Tour",
            "description": "Also in 2027: European Grand Tour. Curated series of private chapter salons, executive gatherings, and summer retreats across Europe's most prestigious cultural and financial centers.",
            "event_type": "Summit",
            "chapter_id": "ch_london",
            "start_time": "2027-12-31T23:59:59Z", # sentinel for sorting
            "end_time": "2027-12-31T23:59:59Z",
            "start_date": None,
            "end_date": None,
            "date_precision": "tba",
            "display_date": "Даты уточняются",
            "year": 2027,
            "month_name": None,
            "city": "London · Paris · Cannes · Zurich · Monaco",
            "region": "Western Europe",
            "country": "UK · France · Switzerland · Monaco",
            "location": "London · Paris · Cannes · Zurich · Monaco",
            "venue": "To be announced",
            "capacity": 0,
            "registered_count": 0,
            "available_spots": None,
            "registration_status": "coming_soon",
            "registration_link": None,
            "price": "To be confirmed",
            "whats_included": "To be confirmed upon date release.",
            "travel_info": "To be announced.",
            "hosts": "London, European & Swiss Chapter Leads",
            "hero_image": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80",
            "agenda": "Detailed itinerary and dates across London, Paris, Cannes, Zurich, and Monaco will be announced once venues are confirmed.",
            "is_published": 1,
            "is_past": 0
        },

        # --- PAST ARCHIVED EVENTS ---
        {
            "id": "evt_dubai_dinner_past",
            "title": "Dubai: Private Founders Dinner & Executive Exchange",
            "headline": "Intimate private dinner for Dubai chapter members and visiting residents.",
            "description": "Intimate dinner for Dubai chapter members and visiting international residents at Dubai Marina Yacht Club.",
            "event_type": "Networking",
            "chapter_id": "ch_dubai",
            "start_time": "2026-09-18T19:00:00Z",
            "end_time": "2026-09-18T22:30:00Z",
            "start_date": "2026-09-18",
            "end_date": "2026-09-18",
            "date_precision": "exact",
            "display_date": "September 18, 2026",
            "year": 2026,
            "month_name": "September",
            "city": "Dubai",
            "region": "Dubai",
            "country": "United Arab Emirates",
            "location": "Dubai Marina Yacht Club, UAE",
            "venue": "Dubai Marina Yacht Club",
            "capacity": 14,
            "registered_count": 14,
            "available_spots": 0,
            "registration_status": "closed",
            "registration_link": None,
            "price": "Included in Membership",
            "whats_included": "Private dining salon, 4-course dinner, curated wine pairing.",
            "travel_info": "Dubai Marina Yacht Club, Gate 3.",
            "hosts": "Elena Ermolov & Alexandra Hill",
            "hero_image": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80",
            "agenda": "19:00 Welcome reception. 19:45 Keynote briefing on MENA capital flows. 20:30 Dinner and roundtable discussions.",
            "is_published": 1,
            "is_past": 1
        },
        {
            "id": "evt_london_salon_past",
            "title": "London: Mayfair Private FinTech Salon",
            "headline": "Closed-door executive exchange on European cross-border operations and regulation.",
            "description": "Intimate gathering for London chapter members, visiting founders, and fintech operators in Mayfair.",
            "event_type": "Networking",
            "chapter_id": "ch_london",
            "start_time": "2026-06-25T18:30:00Z",
            "end_time": "2026-06-25T21:30:00Z",
            "start_date": "2026-06-25",
            "end_date": "2026-06-25",
            "date_precision": "exact",
            "display_date": "June 25, 2026",
            "year": 2026,
            "month_name": "June",
            "city": "London",
            "region": "Greater London",
            "country": "United Kingdom",
            "location": "Mayfair, London, UK",
            "venue": "Private Members Club, Mayfair",
            "capacity": 20,
            "registered_count": 20,
            "available_spots": 0,
            "registration_status": "closed",
            "registration_link": None,
            "price": "Included in Membership",
            "whats_included": "Private boardroom access and cocktail reception.",
            "travel_info": "Central London, Mayfair.",
            "hosts": "London Chapter Lead",
            "hero_image": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80",
            "agenda": "18:30 Drinks & arrivals. 19:00 Closed discussion on UK/EU regulatory sandboxes. 20:30 Networking.",
            "is_published": 1,
            "is_past": 1
        }
    ]

    # Insert or update each canonical event
    for evt in canonical_events:
        cursor.execute("""
            INSERT INTO events (
                id, title, headline, description, event_type, chapter_id,
                start_time, end_time, start_date, end_date, date_precision, display_date,
                year, month_name, city, region, country, location, venue,
                capacity, registered_count, available_spots, registration_status, registration_link,
                price, whats_included, travel_info, hosts, hero_image, cover_image, agenda,
                is_published, is_past
            ) VALUES (
                :id, :title, :headline, :description, :event_type, :chapter_id,
                :start_time, :end_time, :start_date, :end_date, :date_precision, :display_date,
                :year, :month_name, :city, :region, :country, :location, :venue,
                :capacity, :registered_count, :available_spots, :registration_status, :registration_link,
                :price, :whats_included, :travel_info, :hosts, :hero_image, :hero_image, :agenda,
                :is_published, :is_past
            )
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                headline=excluded.headline,
                description=excluded.description,
                event_type=excluded.event_type,
                chapter_id=excluded.chapter_id,
                start_time=excluded.start_time,
                end_time=excluded.end_time,
                start_date=excluded.start_date,
                end_date=excluded.end_date,
                date_precision=excluded.date_precision,
                display_date=excluded.display_date,
                year=excluded.year,
                month_name=excluded.month_name,
                city=excluded.city,
                region=excluded.region,
                country=excluded.country,
                location=excluded.location,
                venue=excluded.venue,
                capacity=excluded.capacity,
                registered_count=excluded.registered_count,
                available_spots=excluded.available_spots,
                registration_status=excluded.registration_status,
                registration_link=excluded.registration_link,
                price=excluded.price,
                whats_included=excluded.whats_included,
                travel_info=excluded.travel_info,
                hosts=excluded.hosts,
                hero_image=excluded.hero_image,
                cover_image=excluded.hero_image,
                agenda=excluded.agenda,
                is_published=excluded.is_published,
                is_past=excluded.is_past;
        """, evt)
        print(f"  ✓ Upserted event: {evt['id']} ({evt['title']} - {evt['display_date']})")

    # Remove obsolete or placeholder event IDs if any
    cursor.execute("DELETE FROM events WHERE id IN ('evt_dubai_dinner')")

    conn.commit()
    conn.close()
    print(f"[SUCCESS] Finished migrating {db_path} successfully.\n")

if __name__ == '__main__':
    for db in DATABASES:
        migrate_database(db)
