#!/usr/bin/env python3
"""
ÖZARA Investments: Real Estate Catalog & Units Synchronization Engine
Fetches, normalizes, and synchronizes real estate properties and units from upstream endpoints.
Invariants:
- Preserves original IDs, prices, currencies, and images.
- Distinguishes projects from units, mapping units via developerProjectId.
- Provider confidentiality: Data source details stored internally, never exposed to user-facing catalog.
- Failure recovery: Retains last successful data if upstream request fails; logs sync execution.
- Safe archival: Listings only archived/withdrawn after confirmed complete sync.
"""

import sys
import os
import json
import sqlite3
import datetime
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATHS = [
    os.path.join(BASE_DIR, "ozara.db"),
    os.path.join(BASE_DIR, "sila.db")
]

CATALOG_URL = "https://edex.estate/api/properties?locale=en"
UNITS_URL_TEMPLATE = "https://edex.estate/edex/api/projects?status=published&parent_project_id={pid}&limit=100&locale=en"

HEADERS = {
    "User-Agent": "OZARA-Platform/2.0 (Institutional Property Sync)",
    "Accept": "application/json"
}

def init_tables(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS real_estate_catalog (
        id TEXT PRIMARY KEY,
        source_id TEXT UNIQUE NOT NULL,
        developer_project_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        description_full TEXT,
        property_type TEXT NOT NULL,
        country TEXT NOT NULL,
        city TEXT NOT NULL,
        location TEXT,
        price_display TEXT,
        currency TEXT NOT NULL,
        price_min_num REAL,
        price_max_num REAL,
        beds INTEGER,
        baths INTEGER,
        beds_min INTEGER,
        beds_max INTEGER,
        sqft REAL,
        area_range TEXT,
        year INTEGER,
        handover TEXT,
        completion_status TEXT,
        badge TEXT,
        features_json TEXT,
        images_json TEXT,
        floor_plans_json TEXT,
        map_url TEXT,
        payment_terms_json TEXT,
        has_units INTEGER DEFAULT 0,
        units_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'published',
        source_meta_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS real_estate_units (
        id TEXT PRIMARY KEY,
        parent_project_id INTEGER NOT NULL,
        parent_catalog_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        unit_types_json TEXT,
        price_display TEXT,
        currency TEXT,
        price REAL,
        price_min REAL,
        price_max REAL,
        area_range TEXT,
        bedrooms_range TEXT,
        bedrooms_min INTEGER,
        bedrooms_max INTEGER,
        handover_quarter TEXT,
        handover_year INTEGER,
        installment_plan TEXT,
        images_json TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_listings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        listing_id TEXT NOT NULL REFERENCES real_estate_catalog(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, listing_id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS investment_sync_logs (
        id TEXT PRIMARY KEY,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        status TEXT NOT NULL,
        total_catalog_count INTEGER DEFAULT 0,
        projects_imported INTEGER DEFAULT 0,
        units_imported INTEGER DEFAULT 0,
        withdrawn_count INTEGER DEFAULT 0,
        error_message TEXT,
        triggered_by TEXT DEFAULT 'scheduled'
    )
    """)

    # Indices
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_catalog_type ON real_estate_catalog(property_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_catalog_country ON real_estate_catalog(country)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_catalog_city ON real_estate_catalog(city)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_catalog_status ON real_estate_catalog(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_catalog_dev_proj ON real_estate_catalog(developer_project_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_units_parent ON real_estate_units(parent_catalog_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_re_units_dev ON real_estate_units(parent_project_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_listings(user_id)")

    conn.commit()

def fetch_json(url: str, timeout: int = 15):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def fetch_all_catalog_items():
    """
    Follows pagination parameters to fetch the full catalog.
    Falls back to single catalog request if pagination params are not accepted.
    """
    items = []
    offset = 0
    limit = 100
    has_more = True
    total_expected = None

    while has_more:
        page_url = f"{CATALOG_URL}&limit={limit}&offset={offset}"
        try:
            data = fetch_json(page_url)
            page_items = data.get("properties") or data.get("data") or []
            pagination = data.get("pagination") or {}
            
            if not page_items:
                # If offset is 0 and empty, try root url without limit/offset
                if offset == 0:
                    data = fetch_json(CATALOG_URL)
                    page_items = data.get("properties") or data.get("data") or []
                    items.extend(page_items)
                break

            items.extend(page_items)
            total_expected = pagination.get("total")
            has_more = pagination.get("has_more", False)
            offset += len(page_items)

            if total_expected and len(items) >= total_expected:
                break
            if not has_more or len(page_items) < limit:
                break
        except Exception as e:
            # If paginated request fails on offset 0, try root catalog URL directly
            if offset == 0:
                print(f"[WARN] Paginated catalog fetch failed ({e}), attempting root catalog URL...")
                data = fetch_json(CATALOG_URL)
                page_items = data.get("properties") or data.get("data") or []
                items.extend(page_items)
                break
            else:
                raise e

    return items

def normalize_property_type(raw_type: str, title: str, desc: str) -> str:
    raw = (raw_type or "").strip()
    raw_lower = raw.lower()
    
    # Exact / known mappings
    if "island" in raw_lower:
        return "Private Islands"
    if "parking" in raw_lower or "garage" in raw_lower:
        return "Parking"
    if "countryside" in raw_lower or "finca" in raw_lower or "ranch" in raw_lower:
        return "Countryside"
    if "commercial" in raw_lower or "office" in raw_lower or "retail" in raw_lower or "business" in raw_lower:
        return "Commercial"
    if "residential" in raw_lower or "apartment" in raw_lower or "condo" in raw_lower or "penthouse" in raw_lower or "villa" in raw_lower:
        return "Residential"

    # Context analysis if raw_type was ambiguous or empty
    text = f"{raw_lower} {title or ''} {desc or ''}".lower()
    if "island" in text:
        return "Private Islands"
    if "parking" in text or "garage space" in text:
        return "Parking"
    if "countryside" in text or "finca" in text or "ranch" in text:
        return "Countryside"
    if "commercial" in text or "office" in text or "business cent" in text or "retail" in text or "hotel" in text:
        return "Commercial"
    
    # If raw was provided with alphanumeric value, preserve normalized English title case
    if raw and len(raw) < 30:
        return raw.title()

    return "Residential"

RAW_COUNTRY_MAP = {
    'usa': 'United States',
    'united states': 'United States',
    'сша': 'United States',
    'uae': 'United Arab Emirates',
    'united arab emirates': 'United Arab Emirates',
    'оаэ': 'United Arab Emirates',
    'испания': 'Spain',
    'spain': 'Spain',
    'кения': 'Kenya',
    'kenya': 'Kenya'
}

RAW_CITY_MAP = {
    'найроби': 'Nairobi',
    'пафос': 'Paphos',
    'коста бланка': 'Costa Blanca'
}

LOCATION_REPLACEMENTS = {
    'Лундёр': 'Lundër',
    'Центр': 'Center',
    'Пафос': 'Paphos',
    'Эксо-Вриси': 'Exo Vrisi',
    'Коста Бланка': 'Costa Blanca',
    'Испания': 'Spain',
    'Химшиашвили': 'Khimshiashvili',
    'Аллея Геров': 'Heroes Avenue',
    'Аллея Героев': 'Heroes Avenue',
    'St. Леха и Марии Качинских 17/19': 'St. Lech and Maria Kaczynski 17/19',
    'Лорткипанидзе': 'Lortkipanidze',
    'Найроби': 'Nairobi',
    'Кения': 'Kenya',
    'Нардаран': 'Nardaran',
    'USA': 'United States',
    'United States': 'United States',
    'UAE': 'United Arab Emirates'
}

HANDOVER_REPLACEMENTS = {
    'Готовый проект, введён в эксплуатацию в 2019 году': 'Ready project, commissioned in 2019',
    'Готовый проект, введён в эксплуатацию в 2018 году': 'Ready project, commissioned in 2018',
    'Готовый проект': 'Ready project',
    'Уточняется у застройщика': 'Upon request from developer',
    'Уточняется': 'Upon request',
    'август 2027': 'August 2027',
    'Декабрь 2027': 'December 2027',
    'Декабрь 2029': 'December 2029',
    'Одна вилла готова; строящаяся вилла — 2026': 'One villa ready; under construction villa — 2026',
    'начало 2028': 'Early 2028',
    'март 2026': 'March 2026',
    'Сентябрь 2029': 'September 2029',
    'Ориентировочно 2028': 'Estimated 2028',
    'Готов, декабрь 2025': 'Ready, December 2025',
    'Готов, май 2025': 'Ready, May 2025',
    'Сентябрь 2028': 'September 2028',
    'Июнь 2029': 'June 2029',
    'Июнь 2028': 'June 2028',
    'Декабрь 2026': 'December 2026',
    'Апрель 2027': 'April 2027',
    'Готово, 2025': 'Ready, 2025',
    'Декабрь 2028': 'December 2028'
}

def clean_location(loc: str, country: str) -> str:
    if not loc:
        return loc
    s = loc
    for ru, en in LOCATION_REPLACEMENTS.items():
        s = s.replace(ru, en)
    if 'Paphos' in s and 'United Arab Emirates' in s:
        s = s.replace('United Arab Emirates', 'Cyprus')
    return s

def clean_handover(ho: str) -> str:
    if not ho:
        return ho
    s = ho
    for ru, en in HANDOVER_REPLACEMENTS.items():
        s = s.replace(ru, en)
    return s

def safe_num(v):
    if v is None:
        return None
    try:
        val = float(v)
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None

def format_price_display(price_str: str, currency: str, min_num, max_num) -> str:
    curr = (currency or "USD").upper().strip()
    pmin = safe_num(min_num)
    pmax = safe_num(max_num)
    if pmin is not None:
        if pmax is not None and pmax > pmin:
            return f"{curr} {pmin:,.0f} – {pmax:,.0f}"
        return f"{curr} {pmin:,.0f}"
    if price_str and price_str.strip():
        return price_str.strip()
    return "Price upon request"

def fetch_units_for_developer_project(pid: int):
    if not pid:
        return pid, []
    url = UNITS_URL_TEMPLATE.format(pid=pid)
    try:
        data = fetch_json(url, timeout=10)
        units = data.get("projects") or data.get("items") or []
        return pid, units
    except Exception as e:
        return pid, []

def sync_catalog(triggered_by: str = "scheduled"):
    sync_id = f"sync_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{os.urandom(2).hex()}"
    start_time = datetime.datetime.utcnow().isoformat() + "Z"
    
    print(f"=== ÖZARA REAL ESTATE CATALOG SYNC STARTED [{sync_id}] ===")
    
    # Initialize DBs
    active_conns = []
    for db_path in DB_PATHS:
        if os.path.exists(os.path.dirname(db_path)):
            c = sqlite3.connect(db_path)
            init_tables(c)
            active_conns.append(c)

    # Log initial status
    for c in active_conns:
        c.execute("""
            INSERT INTO investment_sync_logs (id, started_at, status, triggered_by)
            VALUES (?, ?, 'in_progress', ?)
        """, (sync_id, start_time, triggered_by))
        c.commit()

    try:
        # Step 1: Fetch all properties from upstream
        print("1. Fetching catalog properties from upstream endpoint...")
        raw_items = fetch_all_catalog_items()
        total_items = len(raw_items)
        print(f"   Successfully fetched {total_items} catalog properties.")

        if total_items == 0:
            raise ValueError("Upstream catalog returned 0 properties; aborting to preserve data.")

        # Step 2: Fetch units for projects in parallel
        print("2. Checking and fetching unit records for developer projects...")
        dev_project_ids = list(set([it.get("developerProjectId") for it in raw_items if it.get("developerProjectId")]))
        
        project_units_map = {}
        with ThreadPoolExecutor(max_workers=12) as executor:
            unit_results = executor.map(fetch_units_for_developer_project, dev_project_ids)
            for pid, units in unit_results:
                if units:
                    project_units_map[pid] = units

        total_units_count = sum(len(u) for u in project_units_map.values())
        print(f"   Found {total_units_count} published units across {len(project_units_map)} projects.")

        # Step 3: Insert / Update in Database
        print("3. Persisting catalog items and units to local database...")
        now_ts = datetime.datetime.utcnow().isoformat() + "Z"
        seen_source_ids = set()

        for c in active_conns:
            cursor = c.cursor()
            
            # Upsert properties
            for it in raw_items:
                source_id = str(it.get("id"))
                seen_source_ids.add(source_id)
                stable_id = f"re_cat_{source_id}"
                dev_pid = it.get("developerProjectId")
                
                title = it.get("title") or "Luxury Property"
                desc = it.get("description") or it.get("desc") or ""
                desc_full = it.get("description_full") or it.get("descFull") or desc
                prop_type = normalize_property_type(it.get("type") or it.get("property_type"), title, desc)
                raw_c = (it.get("country") or "Unspecified").strip()
                country = RAW_COUNTRY_MAP.get(raw_c.lower(), raw_c)
                raw_city = (it.get("city") or "Unspecified").strip()
                city = RAW_CITY_MAP.get(raw_city.lower(), raw_city)

                if "new york" in (city or "").lower() or "new york" in (it.get("location") or "").lower():
                    city = "New York"
                    country = "United States"
                if "paphos" in (city or "").lower() or "100767" in str(source_id):
                    country = "Cyprus"
                if str(source_id) in ("100887", "100888", "100760", "100761") or "spain" in (it.get("location") or "").lower():
                    country = "Spain"

                raw_loc = it.get("location") or f"{city}, {country}"
                location = clean_location(raw_loc, country)
                
                currency = (it.get("currency") or "USD").upper().strip()
                p_min = it.get("priceMinNum") or it.get("lots_price_min") or it.get("price")
                p_max = it.get("priceMaxNum") or it.get("lots_price_max") or it.get("price")
                price_display = format_price_display(it.get("price"), currency, p_min, p_max)
                
                beds = it.get("beds")
                baths = it.get("baths")
                beds_min = it.get("bedsMin") or it.get("bedrooms_min")
                beds_max = it.get("bedsMax") or it.get("bedrooms_max")
                sqft = it.get("sqft")
                area_range = it.get("areaRange") or it.get("area_range") or (f"{sqft} m²" if sqft else None)
                
                year = it.get("year") or it.get("handover_year")
                try:
                    year = int(year) if year and str(year).isdigit() else None
                except:
                    year = None
                
                handover = clean_handover(it.get("handover") or it.get("handover_quarter") or "")
                badge = it.get("badge") or "Prime"
                
                features = it.get("features") or []
                images = it.get("images") or []
                floor_plans = it.get("floorPlan") or []
                if isinstance(floor_plans, str):
                    floor_plans = [floor_plans]
                
                map_url = it.get("mapUrl")
                payment_terms = {
                    "installment_plan": None,
                    "mortgage_available": bool(it.get("mortgageAvailable")),
                    "post_handover": bool(it.get("postHandover"))
                }
                
                # Check units count
                units_list = project_units_map.get(dev_pid, [])
                has_units = 1 if len(units_list) > 0 else 0
                units_count = len(units_list)
                
                # Internal sync metadata (NEVER user-facing)
                source_meta = {
                    "source_id": source_id,
                    "developer_project_id": dev_pid,
                    "upstream_record_type": it.get("recordType"),
                    "sync_timestamp": now_ts
                }
                
                cursor.execute("""
                    INSERT INTO real_estate_catalog (
                        id, source_id, developer_project_id, title, description, description_full,
                        property_type, country, city, location, price_display, currency,
                        price_min_num, price_max_num, beds, baths, beds_min, beds_max,
                        sqft, area_range, year, handover, completion_status, badge,
                        features_json, images_json, floor_plans_json, map_url,
                        payment_terms_json, has_units, units_count, status,
                        source_meta_json, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, 'published',
                        ?, ?
                    )
                    ON CONFLICT(id) DO UPDATE SET
                        developer_project_id = excluded.developer_project_id,
                        title = excluded.title,
                        description = excluded.description,
                        description_full = excluded.description_full,
                        property_type = excluded.property_type,
                        country = excluded.country,
                        city = excluded.city,
                        location = excluded.location,
                        price_display = excluded.price_display,
                        currency = excluded.currency,
                        price_min_num = excluded.price_min_num,
                        price_max_num = excluded.price_max_num,
                        beds = excluded.beds,
                        baths = excluded.baths,
                        beds_min = excluded.beds_min,
                        beds_max = excluded.beds_max,
                        sqft = excluded.sqft,
                        area_range = excluded.area_range,
                        year = excluded.year,
                        handover = excluded.handover,
                        badge = excluded.badge,
                        features_json = excluded.features_json,
                        images_json = CASE WHEN real_estate_catalog.images_json LIKE '%/api/media/catalog/%' THEN real_estate_catalog.images_json ELSE excluded.images_json END,
                        floor_plans_json = excluded.floor_plans_json,
                        map_url = excluded.map_url,
                        payment_terms_json = excluded.payment_terms_json,
                        has_units = excluded.has_units,
                        units_count = excluded.units_count,
                        status = 'published',
                        source_meta_json = excluded.source_meta_json,
                        updated_at = excluded.updated_at
                """, (
                    stable_id, source_id, dev_pid, title, desc, desc_full,
                    prop_type, country, city, location, price_display, currency,
                    p_min, p_max, beds, baths, beds_min, beds_max,
                    sqft, area_range, year, handover, None, badge,
                    json.dumps(features), json.dumps(images), json.dumps(floor_plans), map_url,
                    json.dumps(payment_terms), has_units, units_count,
                    json.dumps(source_meta), now_ts
                ))

                # Mirror into real_estate_listings for foreign key compatibility and legacy routes
                cursor.execute("""
                    INSERT INTO real_estate_listings (
                        id, title, short_summary, location, property_type, status,
                        images_json, brochure_document_url, disclaimer, created_by,
                        eligibility_requirements
                    ) VALUES (
                        ?, ?, ?, ?, ?, 'active',
                        ?, NULL, 'Informational listing only. Does not constitute investment advice or offer of securities.', 'Julia',
                        '{"investor_type": "accredited_or_qualified", "conditions_version": "2026-10-v1"}'
                    )
                    ON CONFLICT(id) DO UPDATE SET
                        title = excluded.title,
                        short_summary = excluded.short_summary,
                        location = excluded.location,
                        property_type = excluded.property_type,
                        status = 'active',
                        images_json = excluded.images_json
                """, (
                    stable_id, title, (desc[:240] if desc else title), location, prop_type,
                    json.dumps(images)
                ))
            
            # Upsert units
            for pid, u_list in project_units_map.items():
                parent_catalog_id = None
                # Find matching catalog id
                match_row = cursor.execute("SELECT id FROM real_estate_catalog WHERE developer_project_id = ?", (pid,)).fetchone()
                if match_row:
                    parent_catalog_id = match_row[0]
                else:
                    parent_catalog_id = f"re_dev_{pid}"

                for u in u_list:
                    unit_id = f"unit_{u.get('id')}"
                    u_title = u.get("title") or "Apartment Unit"
                    u_desc = u.get("description") or ""
                    u_types = u.get("unit_types") or []
                    u_curr = (u.get("currency") or "USD").upper().strip()
                    u_price = safe_num(u.get("price"))
                    u_pmin = safe_num(u.get("lots_price_min")) or u_price
                    u_pmax = safe_num(u.get("lots_price_max")) or u_price
                    u_price_disp = format_price_display(str(u.get("price") or ""), u_curr, u_pmin, u_pmax)
                    u_area = u.get("area_range")
                    u_bed_range = str(u.get("bedrooms_range") or "")
                    u_bmin = int(u.get("bedrooms_min")) if str(u.get("bedrooms_min") or "").isdigit() else None
                    u_bmax = int(u.get("bedrooms_max")) if str(u.get("bedrooms_max") or "").isdigit() else None
                    u_hquarter = u.get("handover_quarter")
                    u_hyear = int(u.get("handover_year")) if str(u.get("handover_year") or "").isdigit() else None
                    u_inst = u.get("installment_plan")
                    u_imgs = u.get("images") or []

                    cursor.execute("""
                        INSERT INTO real_estate_units (
                            id, parent_project_id, parent_catalog_id, title, description,
                            unit_types_json, price_display, currency, price, price_min, price_max,
                            area_range, bedrooms_range, bedrooms_min, bedrooms_max,
                            handover_quarter, handover_year, installment_plan, images_json,
                            status, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, ?, ?, ?,
                            'published', ?
                        )
                        ON CONFLICT(id) DO UPDATE SET
                            parent_project_id = excluded.parent_project_id,
                            parent_catalog_id = excluded.parent_catalog_id,
                            title = excluded.title,
                            description = excluded.description,
                            unit_types_json = excluded.unit_types_json,
                            price_display = excluded.price_display,
                            currency = excluded.currency,
                            price = excluded.price,
                            price_min = excluded.price_min,
                            price_max = excluded.price_max,
                            area_range = excluded.area_range,
                            bedrooms_range = excluded.bedrooms_range,
                            bedrooms_min = excluded.bedrooms_min,
                            bedrooms_max = excluded.bedrooms_max,
                            handover_quarter = excluded.handover_quarter,
                            handover_year = excluded.handover_year,
                            installment_plan = excluded.installment_plan,
                            images_json = excluded.images_json,
                            status = 'published',
                            updated_at = excluded.updated_at
                    """, (
                        unit_id, pid, parent_catalog_id, u_title, u_desc,
                        json.dumps(u_types), u_price_disp, u_curr, u_price, u_pmin, u_pmax,
                        u_area, u_bed_range, u_bmin, u_bmax,
                        u_hquarter, u_hyear, u_inst, json.dumps(u_imgs),
                        now_ts
                    ))

            # Step 4: Archive listings absent from verified full sync
            withdrawn_count = 0
            if total_items >= 200: # Confirm that we had a complete harvest
                cursor.execute("SELECT id, source_id FROM real_estate_catalog WHERE status = 'published'")
                existing_published = cursor.fetchall()
                for exp_id, exp_sid in existing_published:
                    if exp_sid not in seen_source_ids:
                        cursor.execute("UPDATE real_estate_catalog SET status = 'withdrawn' WHERE id = ?", (exp_id,))
                        withdrawn_count += 1

            # Log successful sync completion
            end_time = datetime.datetime.utcnow().isoformat() + "Z"
            cursor.execute("""
                UPDATE investment_sync_logs
                SET completed_at = ?, status = 'success',
                    total_catalog_count = ?, projects_imported = ?,
                    units_imported = ?, withdrawn_count = ?
                WHERE id = ?
            """, (end_time, total_items, total_items, total_units_count, withdrawn_count, sync_id))

            c.commit()

        print(f"[SUCCESS] Sync completed: {total_items} catalog properties, {total_units_count} units synchronized across databases.")
        return {
            "success": True,
            "sync_id": sync_id,
            "catalog_count": total_items,
            "units_count": total_units_count
        }

    except Exception as err:
        err_msg = str(err)
        print(f"[ERROR] Synchronization failed: {err_msg}")
        end_time = datetime.datetime.utcnow().isoformat() + "Z"
        for c in active_conns:
            c.execute("""
                UPDATE investment_sync_logs
                SET completed_at = ?, status = 'failed', error_message = ?
                WHERE id = ?
            """, (end_time, err_msg, sync_id))
            c.commit()
        raise err
    finally:
        for c in active_conns:
            c.close()

if __name__ == "__main__":
    triggered = "admin_manual" if "--manual" in sys.argv else "scheduled"
    sync_catalog(triggered_by=triggered)
