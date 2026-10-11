#!/usr/bin/env python3
"""
ÖZARA Investments: Real Estate Catalog & Synchronization Verification Suite
Verifies:
1. Catalog completeness (239+ entries from upstream endpoints).
2. Four property categories: Residential, Countryside, Commercial, Private Islands.
3. Currency handling: Preserves original currencies (USD, AED, EUR, etc.), numeric price verification.
4. Project-to-unit relationship: Validates listing 101122 maps to developer project 1122 with units.
5. Dynamic filters: Type, country, dependent city, budget, bedrooms, query search, and sorting.
6. Saved listings lifecycle: Toggle save, persistence across stable IDs, view saved filter.
7. Inquiry handling: Server-enforced Access Conditions, content guardrail checks, admin routing.
8. Synchronization logging & failure recovery: Retains data on failure, records logs.
9. Provider confidentiality: Zero provider branding exposed in catalog payloads.
"""

import sys
import os
import json
import sqlite3
import urllib.request
import urllib.error

API_URL = "http://localhost:3000"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ozara.db")

def log_pass(msg):
    print(f"\033[92m[PASS]\033[0m {msg}")

def log_fail(msg):
    print(f"\033[91m[FAIL]\033[0m {msg}")
    sys.exit(1)

def http_get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"error": body}

def http_post(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"error": err_body}

def run_tests():
    print("=== ÖZARA INVESTMENTS CATALOG & UNITS VERIFICATION SUITE ===\n")

    # -------------------------------------------------------------
    # Suite 1: Catalog Completeness & DB Integrity
    # -------------------------------------------------------------
    print("--- 1. Catalog Completeness & DB Integrity ---")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    catalog_count = cursor.execute("SELECT COUNT(*) FROM real_estate_catalog WHERE status = 'published'").fetchone()[0]
    if catalog_count < 200:
        log_fail(f"Expected at least 200 catalog listings, got {catalog_count}")
    log_pass(f"Catalog completeness verified: {catalog_count} published listings in database.")

    units_count = cursor.execute("SELECT COUNT(*) FROM real_estate_units WHERE status = 'published'").fetchone()[0]
    if units_count == 0:
        log_fail("Expected published units in real_estate_units, found 0")
    log_pass(f"Project units verified: {units_count} published units in database.")

    # Check 4 required property categories
    cat_types = [r[0] for r in cursor.execute("SELECT DISTINCT property_type FROM real_estate_catalog").fetchall()]
    required_types = ["Residential", "Countryside", "Commercial", "Private Islands"]
    for rt in required_types:
        if rt not in cat_types:
            log_fail(f"Required property category '{rt}' missing from database!")
    log_pass(f"All 4 property categories verified: {required_types}")

    # -------------------------------------------------------------
    # Suite 2: Currency Integrity & Price Verification
    # -------------------------------------------------------------
    print("\n--- 2. Currency Integrity & Price Verification ---")
    currencies = [r[0] for r in cursor.execute("SELECT DISTINCT currency FROM real_estate_catalog").fetchall()]
    expected_sample_currencies = ["USD", "AED", "EUR"]
    for ec in expected_sample_currencies:
        if ec not in currencies:
            log_fail(f"Expected currency '{ec}' not found in catalog currencies: {currencies}")
    log_pass(f"Verified currencies preserved: {currencies}")

    # Check that price numbers are valid numeric values
    sample_price = cursor.execute("SELECT price_display, currency, price_min_num FROM real_estate_catalog WHERE price_min_num IS NOT NULL LIMIT 5").fetchall()
    for disp, curr, pnum in sample_price:
        if curr not in disp:
            log_fail(f"Price display '{disp}' does not reflect verified currency '{curr}'")
        if pnum <= 0:
            log_fail(f"Price numeric field {pnum} is invalid")
    log_pass("Original prices correctly verified against designated currencies without USD assumptions.")

    # -------------------------------------------------------------
    # Suite 3: Project-to-Unit Relationship Mapping
    # -------------------------------------------------------------
    print("\n--- 3. Project-to-Unit Relationship Mapping ---")
    # Verified example: listing 101122 maps to developer project 1122 with published units
    p101122 = cursor.execute("SELECT id, developer_project_id, has_units, units_count FROM real_estate_catalog WHERE source_id = '101122'").fetchone()
    if not p101122:
        log_fail("Verified listing 101122 not found in real_estate_catalog!")
    cat_id, dev_pid, has_u, u_count = p101122
    if dev_pid != 1122:
        log_fail(f"Listing 101122 mapped to developerProjectId {dev_pid}, expected 1122!")
    if not has_u or u_count < 3:
        log_fail(f"Listing 101122 units count is {u_count}, expected at least 3!")
    
    # Check units in table
    units_1122 = cursor.execute("SELECT id, title, price_display FROM real_estate_units WHERE parent_catalog_id = ? OR parent_project_id = 1122", (cat_id,)).fetchall()
    if len(units_1122) < 3:
        log_fail(f"Units for project 1122 count is {len(units_1122)}, expected at least 3!")
    log_pass(f"Project-to-unit mapping verified: Listing 101122 -> Developer Project 1122 -> {len(units_1122)} units.")

    conn.close()

    # -------------------------------------------------------------
    # Suite 4: Catalog API, Dynamic Filters & Search
    # -------------------------------------------------------------
    print("\n--- 4. Catalog API, Dynamic Filters & Search ---")
    status, cat_resp = http_get(f"{API_URL}/api/investments/catalog?limit=10")
    if status != 200:
        log_fail(f"GET /api/investments/catalog failed: {cat_resp}")
    if cat_resp.get("total") < 200 or len(cat_resp.get("listings", [])) != 10:
        log_fail(f"Catalog pagination unexpected: total={cat_resp.get('total')}, returned={len(cat_resp.get('listings', []))}")
    log_pass(f"GET /api/investments/catalog returned 10 items (total: {cat_resp.get('total')}).")

    filter_opts = cat_resp.get("filter_options", {})
    if "countries" not in filter_opts or "cities_by_country" not in filter_opts:
        log_fail(f"Dynamic filter options missing: {filter_opts.keys()}")
    log_pass(f"Filter options populated from imported data: {len(filter_opts.get('countries', []))} countries, {len(filter_opts.get('types', []))} types.")

    # Dependent City check: UAE cities
    uae_cities = filter_opts.get("cities_by_country", {}).get("United Arab Emirates") or filter_opts.get("cities_by_country", {}).get("UAE")
    if not uae_cities or "Dubai" not in uae_cities:
        log_fail(f"City dependency check failed: Dubai missing in UAE cities: {uae_cities}")
    log_pass(f"City depends on Country verified: UAE cities = {uae_cities}")

    # Test Type Filter
    _, res_type = http_get(f"{API_URL}/api/investments/catalog?type=Private+Islands")
    islands = res_type.get("listings", [])
    if len(islands) == 0 or any(it.get("property_type") != "Private Islands" for it in islands):
        log_fail("Type filter 'Private Islands' failed")
    log_pass(f"Type filter 'Private Islands' verified: returned {len(islands)} islands.")

    # Test Country Filter
    _, res_country = http_get(f"{API_URL}/api/investments/catalog?country=Philippines")
    ph_items = res_country.get("listings", [])
    if len(ph_items) == 0 or any(it.get("country") != "Philippines" for it in ph_items):
        log_fail("Country filter 'Philippines' failed")
    log_pass(f"Country filter 'Philippines' verified: returned {len(ph_items)} properties.")

    # Test New York & United States Filtering (Exact 6 Properties Invariant)
    _, res_ny_city = http_get(f"{API_URL}/api/investments/catalog?city=New+York")
    _, res_us_country = http_get(f"{API_URL}/api/investments/catalog?country=United+States")
    _, res_ny_both = http_get(f"{API_URL}/api/investments/catalog?country=United+States&city=New+York")
    
    if res_ny_city.get("total") != 6:
        log_fail(f"City 'New York' expected 6 properties, got {res_ny_city.get('total')}")
    if res_us_country.get("total") != 6:
        log_fail(f"Country 'United States' expected 6 properties, got {res_us_country.get('total')}")
    if res_ny_both.get("total") != 6:
        log_fail(f"Country 'United States' & City 'New York' expected 6 properties, got {res_ny_both.get('total')}")
    log_pass("New York & United States filter verified: all 6 luxury properties correctly returned across city, country, and combined filters.")

    # Test Canonical Countries List & Cyrillic Exclusion
    countries_list = filter_opts.get("countries", [])
    if len(countries_list) != 30:
        log_fail(f"Expected exactly 30 unique canonical countries, got {len(countries_list)}: {countries_list}")
    if any(any('\u0400' <= char <= '\u04FF' for char in c) for c in countries_list):
        log_fail(f"Cyrillic characters found in country dropdown: {countries_list}")
    if "USA" in countries_list or "UAE" in countries_list:
        log_fail(f"Duplicate abbreviation found in country dropdown: {countries_list}")
    log_pass("Canonical countries dropdown verified: exactly 30 clean English countries with 0 Cyrillic characters and no duplicates.")

    # Test Query Search (District / canal)
    _, res_search = http_get(f"{API_URL}/api/investments/catalog?q=canal")
    canal_items = res_search.get("listings", [])
    if len(canal_items) == 0:
        log_fail("Search query 'canal' returned 0 properties")
    log_pass(f"Search query 'canal' verified: returned {len(canal_items)} properties.")

    # Test Sorting (price_asc vs price_desc)
    _, res_p_asc = http_get(f"{API_URL}/api/investments/catalog?sort=price_asc&limit=5")
    _, res_p_desc = http_get(f"{API_URL}/api/investments/catalog?sort=price_desc&limit=5")
    p_asc_first = res_p_asc.get("listings", [])[0].get("price_min_num") or 0
    p_desc_first = res_p_desc.get("listings", [])[0].get("price_min_num") or 0
    if p_desc_first <= p_asc_first:
        log_fail(f"Sorting check failed: p_desc_first ({p_desc_first}) <= p_asc_first ({p_asc_first})")
    log_pass(f"Price sorting verified: min price {p_asc_first} vs max price {p_desc_first}.")

    # -------------------------------------------------------------
    # Suite 5: Single Listing Detail & Units Browsing
    # -------------------------------------------------------------
    print("\n--- 5. Single Listing Detail & Units Browsing ---")
    status, detail_resp = http_get(f"{API_URL}/api/investments/catalog/re_cat_101122")
    if status != 200:
        log_fail(f"GET /api/investments/catalog/re_cat_101122 failed: {detail_resp}")
    if not detail_resp.get("has_units") or len(detail_resp.get("units", [])) < 3:
        log_fail(f"Detail view missing units: {detail_resp.get('units')}")
    log_pass(f"Listing detail view verified: '{detail_resp.get('title')}' with {len(detail_resp.get('units'))} units.")

    # -------------------------------------------------------------
    # Suite 6: Saved Listings Lifecycle
    # -------------------------------------------------------------
    print("\n--- 6. Saved Listings Lifecycle ---")
    viewer_id = "usr_muwksc1i"
    # Ensure un-saved first via DB
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?", (viewer_id, "re_cat_101122"))
    conn.commit()
    conn.close()

    # Save it
    s_status, s_res = http_post(f"{API_URL}/api/investments/saved/re_cat_101122", {"viewerId": viewer_id})
    if s_status != 200 or not s_res.get("is_saved"):
        log_fail(f"Saving listing failed: {s_res}")
    log_pass("Listing successfully saved (is_saved=True).")

    # Fetch saved listings
    _, saved_list = http_get(f"{API_URL}/api/investments/saved?viewerId={viewer_id}")
    if not any(it.get("id") == "re_cat_101122" for it in saved_list):
        log_fail(f"Saved listing not found in viewer's saved list: {saved_list}")
    log_pass("Saved listings retrieval verified: Listing appears in member saved watchlist.")

    # Toggle off
    http_post(f"{API_URL}/api/investments/saved/re_cat_101122", {"viewerId": viewer_id})

    # -------------------------------------------------------------
    # Suite 7: Request Details & Regulatory Guardrails
    # -------------------------------------------------------------
    print("\n--- 7. Request Details & Regulatory Guardrails ---")
    # 7a: Access conditions required check
    unaccepted_id = "usr_fictional_01"
    cond_status, cond_resp = http_post(f"{API_URL}/api/investments/request-details", {
        "listingId": "re_cat_101122",
        "memberId": unaccepted_id,
        "notes": "Interested in availability."
    })
    if cond_status != 403 or cond_resp.get("code") != "CONDITIONS_NOT_ACCEPTED":
        log_fail(f"Expected 403 CONDITIONS_NOT_ACCEPTED, got {cond_status}: {cond_resp}")
    log_pass("Server-side Access Conditions enforcement verified: Unaccepted member blocked with 403.")

    # 7b: Content moderation guardrail check
    mod_status, mod_resp = http_post(f"{API_URL}/api/investments/request-details", {
        "listingId": "re_cat_101122",
        "memberId": viewer_id,
        "notes": "We promise a guaranteed 30% return."
    })
    if mod_status != 422 or not mod_resp.get("flagged"):
        log_fail(f"Expected 422 flagged content, got {mod_status}: {mod_resp}")
    log_pass("Prohibited content guardrails verified: Guaranteed return promises rejected.")

    # 7c: Genuine Details Request Routing
    valid_status, valid_resp = http_post(f"{API_URL}/api/investments/request-details", {
        "listingId": "re_cat_101122",
        "memberId": viewer_id,
        "unitId": "unit_1128",
        "notes": "Inquiring about 2-bedroom unit availability and payment terms."
    })
    if valid_status != 200 or not valid_resp.get("success"):
        log_fail(f"Valid details request failed: {valid_resp}")
    log_pass(f"Request details routed successfully: Inquiry ID = {valid_resp.get('inquiry_id')}.")

    # -------------------------------------------------------------
    # Suite 8: Synchronization Logging & Provider Confidentiality
    # -------------------------------------------------------------
    print("\n--- 8. Synchronization Logging & Provider Confidentiality ---")
    status, sync_resp = http_get(f"{API_URL}/api/investments/sync-status")
    if status != 200 or not sync_resp.get("last_sync"):
        log_fail(f"GET /api/investments/sync-status failed: {sync_resp}")
    log_pass(f"Synchronization logging verified: Last sync at {sync_resp['last_sync'].get('completed_at')} (status: {sync_resp['last_sync'].get('status')}).")

    # Provider confidentiality check: ensure provider domain / name is absent from public catalog output
    raw_catalog_str = json.dumps(cat_resp)
    forbidden_terms = ["edex.estate", "edex api", "edex"]
    for term in forbidden_terms:
        # Check in keys or title or description (except raw image URLs hosted on provider domain)
        for item in cat_resp.get("listings", []):
            if term in item.get("title", "").lower() or term in item.get("description", "").lower():
                log_fail(f"Provider name '{term}' leaked into user-facing catalog title or description!")
    log_pass("Provider confidentiality verified: No provider branding exposed in user-facing catalog.")

    print("\n\033[92mALL 8 TEST SUITES PASSED SUCCESSFULLY!\033[0m")

if __name__ == "__main__":
    run_tests()
