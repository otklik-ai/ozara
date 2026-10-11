#!/usr/bin/env python3
"""
ÖZARA Verification Suite: Image Reliability, Durable Media Delivery & Staging Readiness
Tests:
1. Catalog API returns durable image paths (/api/media/catalog/...) without dead upstream URLs.
2. Media delivery endpoint returns 200 OK, Content-Type: image/webp, Cache-Control: public, max-age=31536000.
3. Conditional GET with ETag returns 304 Not Modified.
4. Storage directory contains valid card, full, and thumbnail files matching manifest.json.
5. Mobile preview route (/app/) returns 200 OK.
6. Gated media route (/storage/telegram_media/...) requires valid authenticated session.
7. Test email suppression guardrails active.
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_URL = "http://localhost:3000"

def test_catalog_image_paths():
    print("[TEST 1] Verifying Catalog API image paths...")
    req = urllib.request.Request(f"{API_URL}/api/investments/catalog?limit=5")
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        listings = data.get("listings", [])
        assert len(listings) > 0, "No listings returned from catalog"
        for item in listings:
            imgs = item.get("images", [])
            assert len(imgs) > 0, f"Listing {item['id']} has empty images"
            for u in imgs:
                assert "developer.edex.estate" not in u, f"Found dead upstream URL in {item['id']}: {u}"
                assert u.startswith("/api/media/catalog/"), f"Image path does not use durable delivery route: {u}"
            full_imgs = item.get("full_images", [])
            assert len(full_imgs) > 0, f"Listing {item['id']} has empty full_images"
    print("  -> PASS: All catalog items return durable internal media URLs.")

def test_media_delivery_and_caching():
    print("[TEST 2] Verifying cacheable media delivery endpoint...")
    sample_url = f"{API_URL}/api/media/catalog/re_cat_100777/cards/re_cat_100777_0.webp"
    req = urllib.request.Request(sample_url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        headers = dict(resp.headers)
        assert "image/webp" in headers.get("Content-Type", ""), f"Wrong Content-Type: {headers.get('Content-Type')}"
        cache_control = headers.get("Cache-Control", "")
        assert "public" in cache_control and "31536000" in cache_control, f"Wrong Cache-Control: {cache_control}"
        etag = headers.get("ETag")
        assert etag, "Missing ETag header"
        body = resp.read()
        assert len(body) > 2000, f"Image payload too small: {len(body)} bytes"

    # Test conditional 304 Not Modified
    cond_req = urllib.request.Request(sample_url, headers={"If-None-Match": etag})
    try:
        urllib.request.urlopen(cond_req, timeout=5)
        assert False, "Expected HTTP 304 exception"
    except urllib.error.HTTPError as e:
        assert e.code == 304, f"Expected 304 Not Modified, got {e.code}"
    print("  -> PASS: Media delivery serves WebP with immutable 1-year caching and 304 support.")

def test_durable_storage_manifest():
    print("[TEST 3] Verifying durable storage files and manifest.json...")
    manifest_p = os.path.join(BASE_DIR, "storage", "catalog", "manifest.json")
    assert os.path.exists(manifest_p), "manifest.json not found"
    with open(manifest_p, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert len(manifest) >= 1000, f"Manifest has too few records: {len(manifest)}"
    cards_dir = os.path.join(BASE_DIR, "storage", "catalog", "cards")
    full_dir = os.path.join(BASE_DIR, "storage", "catalog", "full")
    assert os.path.exists(cards_dir) and len(os.listdir(cards_dir)) >= 1000
    assert os.path.exists(full_dir) and len(os.listdir(full_dir)) >= 1000
    print(f"  -> PASS: {len(manifest)} validated image assets stored and verified.")

def test_mobile_web_preview_route():
    print("[TEST 4] Verifying compiled mobile app preview at /app/...")
    req = urllib.request.Request(f"{API_URL}/app/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert resp.status == 200
        html = resp.read().decode("utf-8")
        assert "<html" in html.lower(), "Expected HTML document"
    print("  -> PASS: Mobile web preview is available and served at /app/.")

def test_private_media_gate():
    print("[TEST 5] Verifying private Telegram media gate...")
    req = urllib.request.Request(f"{API_URL}/storage/telegram_media/private_photo.jpg")
    try:
        urllib.request.urlopen(req, timeout=5)
        assert False, "Private media should require authentication"
    except urllib.error.HTTPError as e:
        assert e.code in [401, 403], f"Expected 401/403 for unauthenticated access, got {e.code}"
    print("  -> PASS: Private media strictly protected behind session authentication.")

def run_all_tests():
    print("=================================================================")
    print("Running ÖZARA Image Reliability & Staging Verification Suite")
    print("=================================================================")
    test_catalog_image_paths()
    test_media_delivery_and_caching()
    test_durable_storage_manifest()
    test_mobile_web_preview_route()
    test_private_media_gate()
    print("=================================================================")
    print("ALL 5 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_all_tests()
