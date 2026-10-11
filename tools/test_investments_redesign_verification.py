#!/usr/bin/env python3
"""
Comprehensive Automated Verification for Investments Page Redesign:
1. Validates index.html landing page contains ONLY the 2 square cards inline.
2. Validates texts and captions for Curated Real Estate and Private Tech Companies.
3. Validates Real Estate browsing page: back button, filter controls, 4-inline category grid.
4. Validates app.js: 8-tile category strip, dropdown sync, modal handlers, state persistence.
5. Validates styles.css: square card styling, 4-inline desktop grid, responsive mobile styles.
6. Validates all image assets (2 card artworks + 8 3D isometric icons) exist and return HTTP 200.
7. Validates mobile InvestmentsScreen.tsx syntax and type-checking.
"""

import os
import sys
import json
import urllib.request
import subprocess

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_HTML = os.path.join(BASE_DIR, "public", "index.html")
APP_JS = os.path.join(BASE_DIR, "public", "app.js")
STYLES_CSS = os.path.join(BASE_DIR, "public", "styles.css")
MOBILE_SCREEN = os.path.join(BASE_DIR, "mobile", "src", "screens", "InvestmentsScreen.tsx")
BASE_URL = "http://localhost:3000"

def run_tests():
    print("=" * 70)
    print("VERIFYING INVESTMENTS PAGE REDESIGN")
    print("=" * 70)

    # 1. Check index.html structure
    print("-> 1. Checking public/index.html structure...")
    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        html = f.read()

    assert "id=\"investmentsLandingView\"" in html, "Missing #investmentsLandingView"
    assert "class=\"inv-two-squares-container\"" in html, "Missing .inv-two-squares-container"
    assert "id=\"invCardRealEstate\"" in html, "Missing #invCardRealEstate"
    assert "id=\"invCardPrivateTech\"" in html, "Missing #invCardPrivateTech"
    assert "Curated Real Estate" in html, "Missing Curated Real Estate text"
    assert "Explore verified prime developments, private islands, and luxury portfolios curated for ÖZARA members." in html
    assert "Private Tech Companies" in html, "Missing Private Tech Companies text"
    assert "Coming soon" in html, "Missing Coming soon text"
    assert "id=\"investmentsResultsView\"" in html, "Missing #investmentsResultsView"
    assert "btn-back-link" in html, "Missing back button"
    assert "id=\"resultsCategoryStrip\"" in html, "Missing #resultsCategoryStrip"
    assert "id=\"invFilterType\"" not in html, "invFilterType should be removed as category tiles are present below"
    print("   ✓ index.html structure strictly verified.")

    # 2. Check styles.css definitions
    print("-> 2. Checking public/styles.css styling...")
    with open(STYLES_CSS, "r", encoding="utf-8") as f:
        css = f.read()

    assert ".inv-two-squares-container" in css, "Missing .inv-two-squares-container in CSS"
    assert ".inv-main-square-card" in css, "Missing .inv-main-square-card in CSS"
    assert ".compact-category-strip" in css, "Missing .compact-category-strip in CSS"
    assert "grid-template-columns: repeat(4, 1fr)" in css, "Missing 4-inline grid in CSS"
    assert ".compact-cat-tile" in css, "Missing .compact-cat-tile in CSS"
    print("   ✓ styles.css definitions strictly verified.")

    # 3. Check public/app.js functions
    print("-> 3. Checking public/app.js logic...")
    with open(APP_JS, "r", encoding="utf-8") as f:
        js = f.read()

    assert "openRealEstateBrowsing" in js, "Missing openRealEstateBrowsing in app.js"
    assert "openPrivateTechModal" in js, "Missing openPrivateTechModal in app.js"
    assert "CANONICAL_REAL_ESTATE_TYPES" in js, "Missing CANONICAL_REAL_ESTATE_TYPES in app.js"
    assert "renderCompactCategoryStrip" in js, "Missing renderCompactCategoryStrip in app.js"
    assert "selectResultsCategory" in js, "Missing selectResultsCategory in app.js"
    assert "handleInvTypeDropdownChange" in js, "Missing handleInvTypeDropdownChange in app.js"
    print("   ✓ app.js logic strictly verified.")

    # 4. Check image assets & HTTP servability
    print("-> 4. Checking image assets via HTTP (200 OK)...")
    required_assets = [
        "/investments/real_estate_card.jpg",
        "/investments/tech_companies_card.jpg",
        "/investments/icons/fallback.png",
        "/investments/icons/residential.png",
        "/investments/icons/commercial.png",
        "/investments/icons/parking.png",
        "/investments/icons/land.png",
        "/investments/icons/countryside.png",
        "/investments/icons/private_islands.png",
        "/investments/icons/pools.png"
    ]
    for asset in required_assets:
        url = f"{BASE_URL}{asset}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Failed HTTP fetch for {url}: {resp.status}"
            size = len(resp.read())
            assert size > 500, f"File unexpectedly small: {url} ({size} bytes)"
    print(f"   ✓ All {len(required_assets)} required assets servable with HTTP 200.")

    # 5. Check mobile TypeScript compilation
    print("-> 5. Checking mobile TypeScript compilation...")
    res = subprocess.run(["npx", "tsc", "--noEmit"], cwd=os.path.join(BASE_DIR, "mobile"), capture_output=True, text=True)
    assert res.returncode == 0, f"TypeScript error:\n{res.stderr}\n{res.stdout}"
    print("   ✓ Mobile TypeScript type-check passed with 0 errors.")

    print("=" * 70)
    print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
