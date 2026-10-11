#!/usr/bin/env python3
"""
Test Suite: ÖZARA Inbox, Direct Messaging, and Transactional Notifications
Verifies:
1. Inbox summary & unread badges.
2. Connection permission gate (mutual connection required for regular members, admin bypass).
3. 1:1 direct messaging, unread counts, block controls, peer reporting.
4. In-app notifications with inline actions & category filtering.
5. Transactional email queue, ÖZARA-branded HTML templates, message body omission, 15-minute debouncing, test sandbox suppression.
6. Granular notification preferences (email vs in-app only).
7. Unified Admin Activity feed & privacy enforcement (no private message content exposure).
"""

import sys
import os
import requests
import sqlite3
import json

BASE_URL = os.environ.get("OZARA_API_URL", "http://localhost:3000")

def assert_true(cond, msg):
    if not cond:
        print(f"❌ FAIL: {msg}")
        sys.exit(1)
    else:
        print(f"✓ PASS: {msg}")

def main():
    print("=" * 70)
    print("RUNNING ÖZARA PHASE 8: INBOX, MESSAGING & NOTIFICATIONS TEST SUITE")
    print(f"Target: {BASE_URL}")
    print("=" * 70)

    member_1 = "usr_fictional_01"  # Dr. Marcus Vance
    member_2 = "usr_fictional_02"  # Sophia Sterling
    admin_user = "usr_elena"       # Elena Ermolov (Founder/Admin)

    # Clean test fixtures from prior runs if any
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("DELETE FROM member_connections WHERE requester_id = ? AND recipient_id = ?", (member_1, member_2))
    c.execute("DELETE FROM member_connections WHERE requester_id = ? AND recipient_id = ?", (member_2, member_1))
    c.execute("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", (member_1, member_2))
    c.execute("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", (member_2, member_1))
    conn.commit()
    conn.close()

    # 1. Test Inbox Summary
    print("\n--- TEST 1: Inbox Summary & Badges ---")
    res = requests.get(f"{BASE_URL}/api/inbox/summary?userId={admin_user}")
    assert_true(res.status_code == 200, "Fetch summary for admin Elena returns 200")
    data = res.json()
    assert_true("unread_messages" in data and "unread_notifications" in data and "total_unread" in data, "Summary contains unread message and notification counts")
    assert_true(data["is_admin"] is True, "Elena recognized as admin")

    res_member = requests.get(f"{BASE_URL}/api/inbox/summary?userId={member_1}")
    assert_true(res_member.status_code == 200, f"Fetch summary for member {member_1} returns 200")
    data_member = res_member.json()
    assert_true(data_member["is_admin"] is False, "Regular member recognized with is_admin=False")

    # 2. Test Connection Gate on Direct Messaging
    print("\n--- TEST 2: Connection Gate & Permissions ---")
    # Member 1 and Member 2 are not connected yet
    # Verify regular member cannot message a non-connected member
    res_start_unconnected = requests.post(
        f"{BASE_URL}/api/inbox/conversations/start",
        json={"userId": member_1, "recipientId": member_2}
    )
    assert_true(res_start_unconnected.status_code == 403, "Cannot message non-connected member (403 Forbidden)")
    err_json = res_start_unconnected.json()
    assert_true(
        err_json.get("error") == "MUTUAL_CONNECTION_REQUIRED" or "mutually accepted connection" in err_json.get("message", "").lower(),
        "Clear rejection message indicating mutual connection requirement"
    )

    # Founder/Admin bypass: Elena (Admin/Founder) can initiate conversation with any verified member
    res_founder_start = requests.post(
        f"{BASE_URL}/api/inbox/conversations/start",
        json={"userId": admin_user, "recipientId": member_1}
    )
    assert_true(res_founder_start.status_code in (200, 201), "Leadership can start conversation with any member (200/201)")
    admin_convo_id = res_founder_start.json()["conversation"]["id"]
    assert_true(bool(admin_convo_id), "Valid conversation ID created for leadership conversation")

    # Connect Member 1 and Member 2 directly in DB to test mutual connection messaging
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO member_connections (id, requester_id, recipient_id, status, created_at, updated_at)
        VALUES ('conn_test_m1_m2', ?, ?, 'accepted', datetime('now'), datetime('now'))
    """, (member_1, member_2))
    conn.commit()
    conn.close()

    # Now Member 1 can start conversation with Member 2
    res_member_convo = requests.post(
        f"{BASE_URL}/api/inbox/conversations/start",
        json={"userId": member_1, "recipientId": member_2}
    )
    assert_true(res_member_convo.status_code in (200, 201), "Mutually connected regular members can start conversation")
    member_convo_id = res_member_convo.json()["conversation"]["id"]

    # 3. Test 1:1 Direct Messaging & Unread Counts
    print("\n--- TEST 3: 1:1 Direct Messaging & Unread Counts ---")
    # Member 1 sends message to Member 2
    secret_text = "Private peer exchange regarding luxury hospitality partnerships."
    res_send = requests.post(
        f"{BASE_URL}/api/inbox/messages/send",
        json={"userId": member_1, "conversationId": member_convo_id, "content": secret_text}
    )
    assert_true(res_send.status_code == 201, "Message sent successfully (201 Created)")
    msg_data = res_send.json()["message"]
    assert_true(msg_data["content"] == secret_text, "Message content matches exactly")

    # Check Member 2's inbox summary: unread_messages should be at least 1
    res_m2_sum = requests.get(f"{BASE_URL}/api/inbox/summary?userId={member_2}")
    assert_true(res_m2_sum.json()["unread_messages"] >= 1, "Recipient has unread message in inbox summary")

    # Member 2 reads the conversation:
    res_m2_read = requests.get(f"{BASE_URL}/api/inbox/conversations/{member_convo_id}?userId={member_2}")
    assert_true(res_m2_read.status_code == 200, "Recipient opens conversation details")
    assert_true(len(res_m2_read.json()["messages"]) >= 1, "Messages returned to recipient")

    # Check Member 2 unread count is reset for that conversation
    res_m2_sum_after = requests.get(f"{BASE_URL}/api/inbox/summary?userId={member_2}")
    assert_true(res_m2_sum_after.json()["unread_messages"] == 0, "Unread count reset to 0 after viewing conversation")

    # 4. Test Block & Report Controls
    print("\n--- TEST 4: Block & Report Controls ---")
    # Member 2 blocks Member 1
    res_block = requests.post(
        f"{BASE_URL}/api/inbox/block",
        json={"userId": member_2, "targetUserId": member_1, "reason": "Testing block function"}
    )
    assert_true(res_block.status_code == 200, "Member block succeeds (200)")

    # Member 1 attempts to send message to Member 2 now -> must fail 403
    res_send_blocked = requests.post(
        f"{BASE_URL}/api/inbox/messages/send",
        json={"userId": member_1, "conversationId": member_convo_id, "content": "Are you there?"}
    )
    assert_true(res_send_blocked.status_code == 403, "Sending message to blocking user rejected (403 Forbidden)")

    # Unblock Member 1 in DB for cleanup
    conn = sqlite3.connect("ozara.db")
    conn.cursor().execute("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", (member_2, member_1))
    conn.commit()
    conn.close()

    # Test peer report
    res_report = requests.post(
        f"{BASE_URL}/api/inbox/report",
        json={
            "userId": member_2,
            "targetUserId": member_1,
            "reason": "unsolicited_fundraising",
            "details": "Peer report test for constitution compliance",
            "blockUser": False
        }
    )
    assert_true(res_report.status_code == 200, "Peer report successfully recorded (200)")

    # 5. Test Email Queue, Debouncing & Privacy
    print("\n--- TEST 5: Transactional Email Queue, Debouncing & Body Omission ---")
    # Send a message from Elena to Member 1
    res_elena_send = requests.post(
        f"{BASE_URL}/api/inbox/messages/send",
        json={"userId": admin_user, "conversationId": admin_convo_id, "content": "Welcome to the ÖZARA private circle."}
    )
    assert_true(res_elena_send.status_code == 201, "Leadership sent direct message")

    # Check test sandbox mailbox
    res_mailbox = requests.get(f"{BASE_URL}/api/inbox/test-mailbox")
    assert_true(res_mailbox.status_code == 200, "Fetch test mailbox returns 200")
    emails = res_mailbox.json()["emails"]
    assert_true(len(emails) > 0, "Email queue contains generated notifications")

    # Find the direct message notification email
    dm_emails = [e for e in emails if e["template_type"] == "direct_message"]
    assert_true(len(dm_emails) > 0, "Direct message transactional email generated")
    latest_dm_email = dm_emails[0]

    # Verify subject does not expose sensitive text and follows rule:
    # "You have a new message from [name]"
    assert_true("You have a new message from" in latest_dm_email["subject"], "Email subject uses standard alert format without message snippet")
    # Crucial Invariant: The email body must NOT contain the private message content
    assert_true("Welcome to the ÖZARA private circle." not in latest_dm_email["body_html"], "Confidential message content strictly omitted from email body")
    assert_true("Open Conversation" in latest_dm_email["body_html"] or "View Message" in latest_dm_email["body_html"], "ÖZARA branded email includes direct action button")
    assert_true(latest_dm_email["delivery_status"] in ("suppressed", "delivered"), "Email logged safely as suppressed/delivered without hitting external inbox")

    # Test 15-minute debouncing: Elena sends another message immediately
    dm_count_before = len(dm_emails)
    requests.post(
        f"{BASE_URL}/api/inbox/messages/send",
        json={"userId": admin_user, "conversationId": admin_convo_id, "content": "Second line sent immediately."}
    )
    res_mailbox_after = requests.get(f"{BASE_URL}/api/inbox/test-mailbox")
    dm_emails_after = [e for e in res_mailbox_after.json()["emails"] if e["template_type"] == "direct_message" and e["recipient_id"] == member_1]
    assert_true(len(dm_emails_after) == dm_count_before, "Second message within 15 mins correctly debounced (no duplicate email queued)")

    # 6. Test In-App Notifications & Inline Actions
    print("\n--- TEST 6: In-App Notifications & Inline Actions ---")
    # Member 1 should have an in-app notification for the message from Elena
    res_notifs = requests.get(f"{BASE_URL}/api/inbox/notifications?userId={member_1}")
    assert_true(res_notifs.status_code == 200, "Fetch notifications returns 200")
    notifs = res_notifs.json()["notifications"]
    assert_true(len(notifs) > 0, "In-app notifications exist for user")

    # Mark one read
    first_notif = notifs[0]
    res_read = requests.post(f"{BASE_URL}/api/inbox/notifications/{first_notif['id']}/read", json={"userId": member_1})
    assert_true(res_read.status_code == 200, "Mark single notification read returns 200")

    # Mark all read
    res_read_all = requests.post(f"{BASE_URL}/api/inbox/notifications/read-all", json={"userId": member_1})
    assert_true(res_read_all.status_code == 200, "Mark all notifications read returns 200")
    res_notifs_after = requests.get(f"{BASE_URL}/api/inbox/notifications?userId={member_1}&unreadOnly=true")
    assert_true(len(res_notifs_after.json()["notifications"]) == 0, "All notifications successfully marked read")

    # 7. Test Notification Preferences
    print("\n--- TEST 7: Notification Preferences ---")
    res_prefs = requests.get(f"{BASE_URL}/api/inbox/preferences?userId={member_1}")
    assert_true(res_prefs.status_code == 200, "Fetch preferences returns 200")
    prefs = res_prefs.json()["preferences"]
    assert_true("email_connection_requests" in prefs, "Preferences contains email_connection_requests")

    # Update preferences to in_app_only for events and daily_digest for posts
    res_update_prefs = requests.put(
        f"{BASE_URL}/api/inbox/preferences",
        json={
            "userId": member_1,
            "preferences": {
                "email_event_invitations": "in_app_only",
                "email_community_posts": "daily_digest"
            }
        }
    )
    assert_true(res_update_prefs.status_code == 200, "Update preferences returns 200")
    updated_prefs = res_update_prefs.json()["preferences"]
    assert_true(updated_prefs["email_event_invitations"] == "in_app_only", "Updated preference persisted")

    # 8. Test Admin Activity Feed & Security
    print("\n--- TEST 8: Shared Admin Activity Feed & Permissions ---")
    # Non-admin attempting to access /api/admin/activity must receive 403
    res_member_act = requests.get(f"{BASE_URL}/api/admin/activity?userId={member_1}")
    assert_true(res_member_act.status_code == 403, "Non-admin blocked from admin activity feed (403 Forbidden)")

    # Admin accessing /api/admin/activity
    res_admin_act = requests.get(f"{BASE_URL}/api/admin/activity?userId={admin_user}")
    assert_true(res_admin_act.status_code == 200, "Admin can access shared activity feed (200 OK)")
    activities = res_admin_act.json()["activity"]
    assert_true(len(activities) > 0, "Admin activity feed contains operational events")

    # Verify categories present in activity feed
    categories = {a["category"] for a in activities}
    print(f"Recorded activity categories in feed: {categories}")
    assert_true(len(categories) >= 3, "Activity feed covers multiple operational categories")

    # Check that NO activity item leaks private message body
    for a in activities:
        meta_str = json.dumps(a.get("metadata") or {})
        assert_true("luxury hospitality" not in meta_str, "Private conversation message content strictly absent from admin activity logs")

    print("\n" + "=" * 70)
    print("✅ ALL INBOX, MESSAGING & NOTIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
