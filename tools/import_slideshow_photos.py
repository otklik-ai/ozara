#!/usr/bin/env python3
"""
Import Telegram photos from ChatExport into intro_pics for the front-page slideshow.
Preserves existing photos, adds new non-thumb photos with sanitized filenames,
and synchronizes across public/intro_pics and DesignGuidline directories.
"""

import os
import re
import shutil
import hashlib
from PIL import Image

EXPORT_DIR = "/Users/bikram6am/Downloads/Telegram Desktop/ChatExport_2026-11-04/photos"
TARGET_DIRS = [
    "/Users/bikram6am/Sila/public/intro_pics",
    "/Users/bikram6am/Sila/tools/DesignGuidlines/intro_pics",
    "/Users/bikram6am/Sila/DesignGuidline/intro_pics",
]

def hash_file(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def sanitize_filename(name):
    # e.g. photo_100@26-10-2026_03-53-54.jpg -> photo_100_2026-10-26_03-53-54.jpg
    clean = name.replace("@", "_").replace(":", "-")
    return clean

def main():
    if not os.path.exists(EXPORT_DIR):
        print(f"[ERROR] Export directory not found: {EXPORT_DIR}")
        return

    for t_dir in TARGET_DIRS:
        os.makedirs(t_dir, exist_ok=True)

    # Hash existing photos in primary public/intro_pics to prevent duplicates
    primary_dir = TARGET_DIRS[0]
    existing_hashes = {}
    for f in os.listdir(primary_dir):
        if f.startswith(".") or f.startswith("onboarding_"):
            continue
        full_p = os.path.join(primary_dir, f)
        if os.path.isfile(full_p):
            try:
                existing_hashes[hash_file(full_p)] = f
            except Exception as e:
                print(f"[WARN] Error reading {f}: {e}")

    print(f"[*] Found {len(existing_hashes)} existing unique intro photos.")

    # Read export photos (excluding all thumbnail variants)
    export_files = [
        f for f in sorted(os.listdir(EXPORT_DIR))
        if "thumb" not in f.lower() and f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ]

    print(f"[*] Found {len(export_files)} full-size candidate photos in export.")

    added_count = 0
    skipped_existing = 0

    for f in export_files:
        src_path = os.path.join(EXPORT_DIR, f)
        f_hash = hash_file(src_path)

        if f_hash in existing_hashes:
            skipped_existing += 1
            continue

        clean_name = sanitize_filename(f)
        
        # Verify image validity with PIL
        try:
            with Image.open(src_path) as img:
                img.verify()
        except Exception as e:
            print(f"[SKIP] Invalid image file {f}: {e}")
            continue

        # Copy to all target directories
        for t_dir in TARGET_DIRS:
            dest_path = os.path.join(t_dir, clean_name)
            shutil.copy2(src_path, dest_path)

        existing_hashes[f_hash] = clean_name
        added_count += 1
        print(f"[ADDED] {clean_name}")

    print("\n" + "=" * 50)
    print(f"IMPORT COMPLETE:")
    print(f"  Existing photos retained: {skipped_existing}")
    print(f"  New photos added:         {added_count}")
    print(f"  Total intro photos now:   {len(existing_hashes)}")
    print("=" * 50)

if __name__ == "__main__":
    main()
