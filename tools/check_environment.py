#!/usr/bin/env python3
"""
tools/check_environment.py
Deterministic environment verification script.
Checks runtime versions, directory structure, and .env configuration.
"""

import os
import sys
from pathlib import Path

def parse_env_file(filepath: Path) -> dict:
    env_vars = {}
    if not filepath.exists():
        return env_vars
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

def main():
    root = Path(__file__).resolve().parent.parent
    print(f"[*] Checking workspace root: {root}")

    # Required directories
    required_dirs = ["architecture", "tools", ".tmp", "storage"]
    for d in required_dirs:
        dir_path = root / d
        if not dir_path.is_dir():
            print(f"[!] Directory missing: {d}")
            sys.exit(1)
        print(f"[OK] Directory present: {d}")

    # Required memory files
    required_files = ["claude.md", "gemini.md", "task_plan.md", "findings.md", "progress.md", ".env"]
    for f in required_files:
        file_path = root / f
        if not file_path.is_file():
            print(f"[!] File missing: {f}")
            sys.exit(1)
        print(f"[OK] File present: {f}")

    # Check .env keys
    env = parse_env_file(root / ".env")
    expected_keys = ["DATABASE_URL", "APP_SECRET", "STORAGE_DIR", "EMAIL_PROVIDER", "FOUNDER_EMAILS"]
    for key in expected_keys:
        if key not in env or not env[key]:
            print(f"[!] Missing required .env key: {key}")
            sys.exit(1)
        print(f"[OK] Environment key verified: {key}")

    print("[SUCCESS] Environment and directory structure verified.")

if __name__ == "__main__":
    main()
