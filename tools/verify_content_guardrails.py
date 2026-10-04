#!/usr/bin/env python3
"""
tools/verify_content_guardrails.py
Deterministic verification for regulatory and content guardrails.
Validates detection of prohibited fundraising promises, valuations, and check sizes.
"""

import re
import sys

PROHIBITED_PATTERNS = [
    (r"(?i)\bguaranteed\b.{0,20}\breturn\b", "Prohibits guaranteed return claims"),
    (r"(?i)\brisk[- ]free\b.{0,20}\bprofit\b", "Prohibits risk-free profit claims"),
    (r"(?i)\bpre[- ]money valuation\b", "Prohibits explicit company valuation postings"),
    (r"(?i)\bvalued at \$\d+[\d,.]*(?:[kKmMbB]| million| billion)?\b", "Prohibits specific valuation claims"),
    (r"(?i)\bminimum (?:investment|ticket|check)(?: size)? (?:of )?\$?[\d,]+", "Prohibits minimum check size mandates"),
    (r"(?i)\bannual(?:ized)? (?:roi|yield) (?:of )?\d+%", "Prohibits guaranteed annualized yield promises")
]

def check_text_for_prohibited_terms(text: str) -> list:
    violations = []
    for pattern, rule_desc in PROHIBITED_PATTERNS:
        match = re.search(pattern, text)
        if match:
            violations.append({"matched_text": match.group(0), "rule": rule_desc})
    return violations

def test_guardrails():
    # Test 1: Compliant member bio
    clean_bio = "Scaling enterprise B2B infrastructure with a focus on cross-border logistics and compliance."
    violations_clean = check_text_for_prohibited_terms(clean_bio)
    if violations_clean:
        print(f"[FAIL] False positive on clean bio: {violations_clean}")
        sys.exit(1)
    print("[PASS] Clean profile text successfully accepted.")

    # Test 2: Prohibited guaranteed return
    bad_return = "We offer a guaranteed 25% return on our proprietary arbitrage system."
    violations_return = check_text_for_prohibited_terms(bad_return)
    if not violations_return:
        print("[FAIL] Failed to catch guaranteed return violation!")
        sys.exit(1)
    print(f"[PASS] Caught prohibited return: {violations_return[0]['matched_text']}")

    # Test 3: Prohibited valuation claim
    bad_valuation = "Raising capital for our fintech valued at $50M pre-money valuation."
    violations_val = check_text_for_prohibited_terms(bad_valuation)
    if len(violations_val) < 2:
        print(f"[FAIL] Failed to catch both valuation violations: {violations_val}")
        sys.exit(1)
    print(f"[PASS] Caught prohibited valuation terms: {[v['matched_text'] for v in violations_val]}")

    # Test 4: Prohibited minimum check
    bad_check = "Open only to angels with a minimum check size of $100,000."
    violations_check = check_text_for_prohibited_terms(bad_check)
    if not violations_check:
        print("[FAIL] Failed to catch minimum check size violation!")
        sys.exit(1)
    print(f"[PASS] Caught prohibited minimum check size: {violations_check[0]['matched_text']}")

def main():
    print("[*] Running Content & Regulatory Guardrail Verification...")
    test_guardrails()
    print("[SUCCESS] Content Guardrails successfully verified.")

if __name__ == "__main__":
    main()
