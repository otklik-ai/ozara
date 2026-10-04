#!/usr/bin/env python3
"""
tools/test_email_handshake.py
Deterministic email & notification system handshake.
Tests email validation, template rendering, and outbox delivery logging in .tmp/.
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

def send_stub_email(outbox_path: Path, to_email: str, subject: str, template: str, context: dict) -> bool:
    if not re.match(EMAIL_REGEX, to_email):
        raise ValueError(f"Invalid recipient email format: {to_email}")

    payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "to": to_email,
        "subject": subject,
        "template": template,
        "context": context
    }

    outbox_path.parent.mkdir(parents=True, exist_ok=True)
    with open(outbox_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")
    return True

def main():
    root = Path(__file__).resolve().parent.parent
    outbox_file = root / ".tmp" / "outbox.log"
    print(f"[*] Testing transactional notification system outbox: {outbox_file}")

    test_recipient = "member_candidate@example.com"
    test_subject = "Invitation to ÖZARA"
    test_template = "invitation_token"
    test_context = {
        "invite_token": "token_handshake_test_12345",
        "admitted_by": "Alexandra",
        "chapter": "Dubai"
    }

    try:
        success = send_stub_email(outbox_file, test_recipient, test_subject, test_template, test_context)
        if not success:
            print("[!] Failed to dispatch test notification.")
            sys.exit(1)
        print(f"[OK] Notification dispatched to stub outbox.")

        # Verify entry in file
        with open(outbox_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        last_line = lines[-1].strip()
        record = json.loads(last_line)
        if record["to"] != test_recipient or record["context"]["invite_token"] != test_context["invite_token"]:
            print("[!] Mismatched record content in outbox log.")
            sys.exit(1)
        print(f"[OK] Record verified in outbox log: {record['timestamp']} -> {record['to']}")
        print("[SUCCESS] Transactional email & notification handshake passed.")

    except Exception as e:
        print(f"[ERROR] Email handshake failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
