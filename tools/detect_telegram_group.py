#!/usr/bin/env python3
"""
Diagnostic tool to inspect Telegram Bot status, detect the group ID
for 'Julia & Alexandra | Сила Связей', and list detected authors.
Non-destructive: Uses unified shared offset in telegram_sync_state.
Never prints bot tokens. Never auto-approves senders.
"""

import os
import sys
import json
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "ozara.db")
sys.path.insert(0, BASE_DIR)

from tools.sync_telegram_channel import get_config, call_telegram

def print_detected_identities():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT chat_id, chat_title, chat_type, COUNT(*) as cnt
        FROM telegram_detected_identities
        GROUP BY chat_id, chat_title, chat_type
        ORDER BY cnt DESC
    """)
    chats = cursor.fetchall()
    
    cursor.execute("""
        SELECT user_id, user_name, username, is_bot, chat_title, sample_text, COUNT(*) as cnt
        FROM telegram_detected_identities
        WHERE user_id != ''
        GROUP BY user_id, user_name, username, is_bot, chat_title, sample_text
        ORDER BY cnt DESC
    """)
    users = cursor.fetchall()
    conn.close()
    
    print("\n=======================================================")
    print("DETECTED TELEGRAM GROUPS / CHATS (FROM DATABASE):")
    print("=======================================================")
    if not chats:
        print("No group updates recorded yet.")
        print("-> Awaiting next normal message in 'Julia & Alexandra | Сила Связей' to record the group ID.")
    for c in chats:
        print(f"Chat ID: {c[0]} | Title: '{c[1]}' | Type: {c[2]} | Messages: {c[3]}")
        
    print("\n=======================================================")
    print("DETECTED TELEGRAM SENDER & ADMINISTRATOR IDENTITIES:")
    print("=======================================================")
    if not users:
        print("No identities recorded yet in database.")
    for u in users:
        role_info = f" | Note: {u[5]}" if u[5] else ""
        print(f"User ID: {u[0]} | Name: '{u[1]}' | Username: @{u[2]} | Bot: {bool(u[3])} | Chat: '{u[4]}'{role_info}")
    print("=======================================================\n")

def main():
    config = get_config()
    token = config["token"]
    if not token:
        print("[ERROR] TELEGRAM_BOT_TOKEN missing in .env")
        sys.exit(1)
        
    print("[*] Checking bot status...")
    me = call_telegram(token, "getMe")
    if not me.get("ok"):
        print(f"[-] Bot connection error: {me.get('description')}")
        sys.exit(1)
        
    bot_info = me.get("result", {})
    print(f"[✓] Bot verified: @{bot_info.get('username')} (ID: {bot_info.get('id')}, Name: '{bot_info.get('first_name')}')")
    
    print("[*] Reading recorded identities from database (single receiver architecture)...")
    print_detected_identities()

if __name__ == "__main__":
    main()
