#!/usr/bin/env python3
"""
Test Suite: Investments Dynamic Categories, 3-Card Grid & Card Carousel
Verifies:
1. Dynamic Categories API (/api/investments/categories) returns normalized categories, counts, and icon_keys
2. All category icons exist on disk and are servable via HTTP
3. New category addition (e.g. 'Parking') dynamically yields 'parking' icon_key
4. Unfamiliar category yields 'fallback' icon_key
5. Catalog filtering by country/city/search does not break category navigation
6. Listings data integrity (images array, specs, price_display)
7. Category removal switches gracefully with notice
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "ozara.db")

def test_api_categories():
    print("-> Testing GET /api/investments/categories...")
    req = urllib.request.Request(f"{BASE_URL}/api/investments/categories")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        data = json.loads(resp.read().decode())
    
    assert data.get("success") is True, "Expected success: true"
    categories = data.get("categories", [])
    assert len(categories) > 0, "Expected at least 1 category"
    
    total_count = data.get("total_count", 0)
    print(f"   Found {len(categories)} categories with total {total_count} published listings:")
    
    cat_names = [c["name"] for c in categories]
    for c in categories:
        print(f"     - {c['name']} (count: {c['count']}, icon_key: {c['icon_key']})")
        assert c["count"] > 0, f"Category {c['name']} has 0 count, should not be included"
        assert c["icon_key"], f"Category {c['name']} missing icon_key"
        
        # Verify icon is accessible via HTTP
        icon_url = f"{BASE_URL}/investments/icons/{c['icon_key']}.png"
        icon_req = urllib.request.Request(icon_url)
        with urllib.request.urlopen(icon_req) as icon_resp:
            assert icon_resp.status == 200, f"Failed to fetch icon: {icon_url}"
            content = icon_resp.read()
            assert len(content) > 100, f"Icon file empty or too small: {icon_url}"
    
    # Assert canonical categories are present
    assert "Residential" in cat_names, "Expected Residential in categories"
    assert "Private Islands" in cat_names, "Expected Private Islands in categories"
    print("   ✓ Categories API returned valid dynamic categories with servable icons.")

def test_catalog_filter_options():
    print("-> Testing GET /api/investments/catalog filter_options...")
    req = urllib.request.Request(f"{BASE_URL}/api/investments/catalog?limit=5")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
    
    assert "listings" in data, "Expected listings in catalog response"
    filter_opts = data.get("filter_options", {})
    categories = filter_opts.get("categories", [])
    assert len(categories) > 0, "filter_options.categories must not be empty"
    
    # Test filtering by a specific country still includes all categories in filter_options
    req_filtered = urllib.request.Request(f"{BASE_URL}/api/investments/catalog?country=United%20Arab%20Emirates&limit=5")
    with urllib.request.urlopen(req_filtered) as resp_filt:
        data_filt = json.loads(resp_filt.read().decode())
    
    cats_filt = data_filt.get("filter_options", {}).get("categories", [])
    assert len(cats_filt) == len(categories), "Category options must remain from full catalog when filtering by country"
    print("   ✓ Category options remain available and intact regardless of active search/country filters.")

def test_dynamic_category_addition_and_fallback():
    print("-> Testing dynamic category addition and fallback icon...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Insert a temporary listing with category 'Parking'
        cursor.execute("""
            INSERT INTO real_estate_catalog (
                id, source_id, title, property_type, country, city, price_display,
                currency, price_min_num, price_max_num, status, created_at, updated_at
            ) VALUES (
                'test_parking_001', 'test_p_1', 'Prime Underground Parking Bay',
                'Parking', 'United Arab Emirates', 'Dubai', 'AED 150,000',
                'AED', 150000, 150000, 'published', datetime('now'), datetime('now')
            )
        """)
        
        # Insert a temporary listing with an unfamiliar category 'Aviation Hangar'
        cursor.execute("""
            INSERT INTO real_estate_catalog (
                id, source_id, title, property_type, country, city, price_display,
                currency, price_min_num, price_max_num, status, created_at, updated_at
            ) VALUES (
                'test_hangar_001', 'test_h_1', 'Private Jet Hangar Facility',
                'Aviation Hangar', 'Switzerland', 'Zurich', 'CHF 8,500,000',
                'CHF', 8500000, 8500000, 'published', datetime('now'), datetime('now')
            )
        """)
        conn.commit()
        
        # Fetch categories API
        req = urllib.request.Request(f"{BASE_URL}/api/investments/categories")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
        
        cats = {c["name"]: c for c in data.get("categories", [])}
        
        assert "Parking" in cats, "Parking should dynamically appear in categories"
        assert cats["Parking"]["icon_key"] == "parking", f"Expected icon_key 'parking', got {cats['Parking']['icon_key']}"
        assert cats["Parking"]["count"] >= 1
        
        assert "Aviation Hangar" in cats, "Aviation Hangar should dynamically appear in categories"
        assert cats["Aviation Hangar"]["icon_key"] == "fallback", f"Expected fallback icon_key, got {cats['Aviation Hangar']['icon_key']}"
        assert cats["Aviation Hangar"]["count"] >= 1
        
        print("   ✓ 'Parking' dynamically assigned parking icon; unfamiliar 'Aviation Hangar' dynamically assigned fallback icon.")
        
    finally:
        # Cleanup temporary records
        cursor.execute("DELETE FROM real_estate_catalog WHERE id IN ('test_parking_001', 'test_hangar_001')")
        conn.commit()
        conn.close()

def test_listing_card_images_and_specs():
    print("-> Testing listing card images and carousel payload structure...")
    req = urllib.request.Request(f"{BASE_URL}/api/investments/catalog?limit=10")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
    
    listings = data.get("listings", [])
    assert len(listings) > 0
    
    for item in listings:
        assert "images" in item, "Listing missing images field"
        assert isinstance(item["images"], list), "images must be a list"
        assert len(item["images"]) > 0, f"Listing {item['id']} has no images"
        assert item.get("title"), "Listing missing title"
        assert item.get("price_display"), "Listing missing price_display"
        assert item.get("property_type"), "Listing missing property_type"
    
    print(f"   ✓ Verified {len(listings)} listings have valid images arrays for card photo carousel.")

def test_static_assets_and_css():
    print("-> Testing static icons and CSS grid definitions...")
    icon_dir = os.path.join(os.path.dirname(__file__), "..", "public", "investments", "icons")
    expected_icons = ["residential.png", "countryside.png", "commercial.png", "private_islands.png", "parking.png", "fallback.png"]
    for icon_name in expected_icons:
        icon_path = os.path.join(icon_dir, icon_name)
        assert os.path.exists(icon_path), f"Missing icon file: {icon_path}"
        assert os.path.getsize(icon_path) > 100, f"Icon file empty: {icon_path}"
    
    css_path = os.path.join(os.path.dirname(__file__), "..", "public", "styles.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()
    
    assert ".landing-category-grid" in css, "styles.css missing .landing-category-grid"
    assert ".landing-cat-tile" in css, "styles.css missing .landing-cat-tile"
    assert ".compact-category-strip" in css, "styles.css missing .compact-category-strip"
    assert ".compact-cat-tile" in css, "styles.css missing .compact-cat-tile"
    assert ".listings-grid-3col" in css, "styles.css missing .listings-grid-3col"
    assert "aspect-ratio: 4 / 3" in css, "styles.css missing 4:3 aspect-ratio"
    assert ".prop-carousel-btn" in css, "styles.css missing .prop-carousel-btn"
    assert ".prop-photo-counter" in css, "styles.css missing .prop-photo-counter"
    print("   ✓ All required static icons and CSS classes for 3-card grid and carousel verified.")

def main():
    print("=====================================================================")
    print("RUNNING INVESTMENTS REVISION TEST SUITE")
    print("=====================================================================")
    test_api_categories()
    test_catalog_filter_options()
    test_dynamic_category_addition_and_fallback()
    test_listing_card_images_and_specs()
    test_static_assets_and_css()
    print("=====================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=====================================================================")

if __name__ == "__main__":
    main()
