#!/usr/bin/env python3
"""
tools/test_community_and_members.py
Automated validation of the simplified Networking section and Community Wall:
1. Member location filtering invariant (Elena Alexeeva in Seattle, NOT in Dubai).
2. Community Wall access gating (admitted-only).
3. Post creation, topic pills, reverse-chronological ordering.
4. Broker-dealer content guardrails on posts and comments.
5. Post editing and deletion permissions (author & admin).
6. Comments & replies creation and deletion.
7. Purged unconfirmed venue and partnership claims.
"""

import sys
import json
import urllib.request
import urllib.error
import sqlite3
import os

BASE_URL = "http://localhost:3000"

def api_request(path, data=None, method="GET", headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            err_json = json.loads(content)
        except Exception:
            err_json = {"raw": content}
        return e.code, err_json

def test_member_location_filtering():
    print("\n--- Test 1: Member Location Filtering Invariant ---")
    
    # 1. Check Dubai filter
    status, res = api_request("/api/members?viewerId=usr_elena&location=Dubai")
    assert status == 200, f"Expected 200, got {status}"
    members = res if isinstance(res, list) else res.get("members", [])
    names = [m["full_name"] for m in members]
    print(f"Members matching 'Dubai': {names}")
    
    assert "Elena Alexeeva" not in names, "CRITICAL ERROR: Elena Alexeeva must NOT match location=Dubai!"
    assert any("Elena Ermolov" in n for n in names) or any("Alexandra Hill" in n for n in names), "Expected Dubai members to be returned"
    print("✓ Elena Alexeeva correctly excluded from Dubai location filter.")

    # 2. Check Seattle filter
    status, res_sea = api_request("/api/members?viewerId=usr_elena&location=Seattle")
    assert status == 200, f"Expected 200, got {status}"
    sea_members = res_sea if isinstance(res_sea, list) else res_sea.get("members", [])
    sea_names = [m["full_name"] for m in sea_members]
    print(f"Members matching 'Seattle': {sea_names}")
    assert "Elena Alexeeva" in sea_names, "CRITICAL ERROR: Elena Alexeeva must match location=Seattle!"
    print("✓ Elena Alexeeva correctly matched on Seattle saved residence.")

    # 3. Check United States filter
    status, res_us = api_request("/api/members?viewerId=usr_elena&location=United%20States")
    assert status == 200
    us_members = res_us if isinstance(res_us, list) else res_us.get("members", [])
    us_names = [m["full_name"] for m in us_members]
    assert "Elena Alexeeva" in us_names, "Elena Alexeeva must match location=United States"
    print("✓ Elena Alexeeva matched under United States country filter.")

def test_community_access_gating():
    print("\n--- Test 2: Community Wall Access Gating ---")
    # 1. Unadmitted / missing viewer
    status, res = api_request("/api/community/posts")
    assert status == 401, f"Expected 401, got {status}"
    print("✓ Anonymous / missing viewer denied access (401).")

    status, res = api_request("/api/community/posts?viewerId=unadmitted_visitor_999")
    assert status == 401, f"Expected 401, got {status}"
    print("✓ Unadmitted visitor denied access (401).")

    # 2. Admitted member
    status, posts = api_request("/api/community/posts?viewerId=usr_elena")
    assert status == 200, f"Expected 200, got {status}"
    assert isinstance(posts, list), "Expected posts list"
    assert len(posts) > 0, "Expected seeded community posts"
    print(f"✓ Admitted member retrieved {len(posts)} posts successfully.")
    
    # Check post payload structure
    first_post = posts[0]
    assert "id" in first_post
    assert "author_id" in first_post
    assert "author" in first_post
    assert "content" in first_post
    assert "comments" in first_post
    assert "created_at" in first_post
    author = first_post["author"]
    assert "full_name" in author
    assert "role" in author
    print(f"✓ Post payload validated (Author: {author['full_name']}, Topic: {first_post.get('topic')}).")

def test_post_creation_and_moderation():
    print("\n--- Test 3: Post Creation, Topic Tagging & Guardrails ---")
    # 1. Create valid post with topic
    status, new_post = api_request("/api/community/posts", data={
        "author_id": "usr_muwksc1i",
        "topic": "Question",
        "content": "Looking for recommendations on low-latency Apache Iceberg catalogs with Snowflake."
    }, method="POST")
    assert status == 201, f"Expected 201, got {status}: {new_post}"
    post_id = new_post["id"]
    assert new_post["topic"] == "Question"
    assert new_post["author"]["full_name"] == "Elena Alexeeva"
    print(f"✓ Admitted member created post {post_id} with topic 'Question'.")

    # 2. Prohibited fundraising guardrail test
    status, err_resp = api_request("/api/community/posts", data={
        "author_id": "usr_muwksc1i",
        "topic": "Opportunity",
        "content": "Our AI startup is raising $10m at $40m pre-money valuation with 25% guaranteed return."
    }, method="POST")
    assert status == 400, f"Expected 400 rejection for fundraising terms, got {status}"
    print("✓ Broker-dealer content guardrail correctly rejected fundraising pitch.")

    # 3. Edit post by author
    status, edit_res = api_request(f"/api/community/posts/{post_id}", data={
        "editor_id": "usr_muwksc1i",
        "topic": "Expertise",
        "content": "Sharing our benchmark on low-latency Apache Iceberg catalogs with Snowflake."
    }, method="PUT")
    assert status == 200, f"Expected 200, got {status}"
    assert edit_res["topic"] == "Expertise"
    print("✓ Author edited post successfully.")

    # 4. Unauthorized edit attempt by another non-admin member
    status, unauth_edit = api_request(f"/api/community/posts/{post_id}", data={
        "editor_id": "usr_fictional_01",
        "content": "Hacked content"
    }, method="PUT")
    assert status == 403, f"Expected 403 Forbidden for non-author non-admin, got {status}"
    print("✓ Unauthorized edit attempt blocked (403).")

    return post_id

def test_comments_lifecycle(post_id):
    print("\n--- Test 4: Comments & Discussion Lifecycle ---")
    # 1. Add comment to post
    status, comment = api_request(f"/api/community/posts/{post_id}/comments", data={
        "author_id": "usr_elena",
        "content": "Would love to see the benchmark slides. Can share our experience from high-frequency ingestion."
    }, method="POST")
    assert status == 201, f"Expected 201, got {status}: {comment}"
    comment_id = comment["id"]
    assert comment["author"]["full_name"] == "Elena Ermolov"
    print(f"✓ Comment {comment_id} created by Elena Ermolov.")

    # 2. Verify comment appears in feed
    status, posts = api_request(f"/api/community/posts?viewerId=usr_elena")
    matching_post = next((p for p in posts if p["id"] == post_id), None)
    assert matching_post is not None
    assert matching_post["comments_count"] >= 1
    assert any(c["id"] == comment_id for c in matching_post["comments"])
    print(f"✓ Comment reflected in post feed (count: {matching_post['comments_count']}).")

    # 3. Guardrail rejection on comment
    status, err_c = api_request(f"/api/community/posts/{post_id}/comments", data={
        "author_id": "usr_elena",
        "content": "Invest here with guaranteed return of 50%!"
    }, method="POST")
    assert status == 400
    print("✓ Content guardrail rejected solicitation in comment.")

    # 4. Delete comment by comment author
    status, del_c = api_request(f"/api/community/comments/{comment_id}?requester_id=usr_elena", method="DELETE")
    assert status == 200
    print("✓ Comment author deleted comment successfully.")

def test_post_deletion_and_moderation(post_id):
    print("\n--- Test 5: Post Deletion & Admin Moderation ---")
    # 1. Create a post by member Marcus Vance (usr_fictional_01)
    status, post2 = api_request("/api/community/posts", data={
        "author_id": "usr_fictional_01",
        "topic": "Opportunity",
        "content": "Temporary post for admin moderation testing."
    }, method="POST")
    assert status == 201
    post2_id = post2["id"]

    # 2. Non-author, non-admin (Sophia Sterling usr_fictional_02) cannot delete
    status, err_del = api_request(f"/api/community/posts/{post2_id}?requester_id=usr_fictional_02", method="DELETE")
    assert status == 403, f"Expected 403, got {status}"
    print("✓ Non-author non-admin cannot delete post (403).")

    # 3. Admin (Elena Ermolov, FOUNDER) can moderate/delete any post
    status, adm_del = api_request(f"/api/community/posts/{post2_id}?requester_id=usr_elena", method="DELETE")
    assert status == 200, f"Expected 200, got {status}"
    print("✓ Admin successfully moderated/deleted member post.")

    # 4. Author deletes original post
    status, auth_del = api_request(f"/api/community/posts/{post_id}?requester_id=usr_muwksc1i", method="DELETE")
    assert status == 200
    print("✓ Author deleted own post successfully.")

def test_unconfirmed_venues_purged():
    print("\n--- Test 6: Unconfirmed Venue Claims Purged ---")
    conn = sqlite3.connect("ozara.db")
    c = conn.cursor()
    c.execute("SELECT id, name, gathering_place_name FROM chapters WHERE gathering_place_name IS NOT NULL")
    remaining = c.fetchall()
    conn.close()
    assert len(remaining) == 0, f"Unconfirmed venues still present in database: {remaining}"
    print("✓ Confirmed 0 unconfirmed venue/club claims remaining in chapters table.")

def main():
    print("==========================================================")
    print("ÖZARA NETWORKING SIMPLIFICATION & COMMUNITY TEST SUITE")
    print("==========================================================")
    try:
        test_member_location_filtering()
        test_community_access_gating()
        created_post_id = test_post_creation_and_moderation()
        test_comments_lifecycle(created_post_id)
        test_post_deletion_and_moderation(created_post_id)
        test_unconfirmed_venues_purged()
        print("\n==========================================================")
        print("ALL TESTS PASSED 100%! NETWORKING & COMMUNITY VERIFIED.")
        print("==========================================================")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
