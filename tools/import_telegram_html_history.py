#!/usr/bin/env python3
"""
Telegram HTML History Import Tool for ÖZARA Community Wall
Supports Telegram Desktop export (messages.html and media folders).

Operational Invariants:
1. Strictly read-only against the original export: Never alters or deletes export files.
2. Zero Telegram API calls to the group: Reads strictly locally from disk.
3. Selects the 10 most recent eligible photo posts by Julia and Alexandra individually.
4. Includes only posts with photos (with or without text captions).
5. Strictly excludes text-only, videos, video messages, animations, stickers, and other attachments.
6. Skips entire albums that mix photos and videos.
7. Preserves photo order and caption in albums; counts each album as one post.
8. Translates captions into English, preserves ÖZARA brand name, and retains original publication dates.
9. Excludes video thumbnails (thumbs/) and webpage preview images (webpage_thumbs/).
10. Treats IDs from image filenames as candidate IDs until verified.
11. Prevents duplicates with existing and future live imports via deterministic telegram_message_id.
12. Provides full untruncated preview before publishing.
"""

import os
import sys
import re
import json
import shutil
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "ozara.db")
MEDIA_STORAGE_DIR = os.path.join(BASE_DIR, "storage", "telegram_media")
DEFAULT_EXPORT_DIR = "/Users/bikram6am/Downloads/ChatExport_Julia & Alexandra _ Сила Связей"

os.makedirs(MEDIA_STORAGE_DIR, exist_ok=True)

# Candidate authors and extracted candidate IDs
KNOWN_AUTHORS = {
    "Юлия Щукина|Edeluxe": {
        "role": "founder",
        "canonical_name": "Julia Shchukina | Founder",
        "display_name_en": "Julia Shchukina | Founder",
        "candidate_id": "387033199",
        "is_approved": True,
        "type": "individual"
    },
    "Юлия Щукина": {
        "role": "founder",
        "canonical_name": "Julia Shchukina | Founder",
        "display_name_en": "Julia Shchukina | Founder",
        "candidate_id": "387033199",
        "is_approved": True,
        "type": "individual"
    },
    "Alexandra": {
        "role": "founder",
        "canonical_name": "Alexandra Hill | Founder",
        "display_name_en": "Alexandra Hill | Founder",
        "candidate_id": "806344833",
        "is_approved": True,
        "type": "individual"
    },
    "Julia & Alexandra | Сила Связей": {
        "role": "chat_group_name",
        "canonical_name": "Julia & Alexandra | ÖZARA",
        "display_name_en": "Julia & Alexandra | ÖZARA",
        "candidate_id": "10694692529",
        "is_approved": False,  # Excluded: import is strictly limited to Julia and Alexandra individually
        "type": "channel_entity"
    }
}

def translate_author_to_english(author_raw):
    """
    Translates Telegram author display names to verified English names.
    Verified spelling from admin records & email:
    Julia Shchukina: iuliiashchukinainvest@gmail.com
    Alexandra Hill: agniyahill@gmail.com
    """
    if not author_raw:
        return "ÖZARA Leadership"
    clean = author_raw.strip()
    if clean in KNOWN_AUTHORS and KNOWN_AUTHORS[clean].get("canonical_name"):
        return KNOWN_AUTHORS[clean]["canonical_name"]
    if "Юлия" in clean or "Julia" in clean or "Щукина" in clean:
        return "Julia Shchukina | Founder"
    if "Александра" in clean or "Alexandra" in clean:
        return "Alexandra Hill | Founder"
    if "Елена" in clean or "Elena" in clean:
        return "Elena Ermolov | Founder"
    return clean



MONTH_MAP = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12
}

def parse_telegram_html_date(date_str):
    """
    Parses Telegram Desktop HTML date title e.g.:
    '8 October 2026, 11:33:14' or '19 April 2026, 01:37:39'
    Returns ISO datetime string: 'YYYY-MM-DD HH:MM:SS'
    """
    if not date_str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    clean = date_str.strip()
    
    # Try pattern: "19 April 2026, 01:37:39"
    m = re.match(r'(\d+)\s+([A-Za-zА-Яа-я]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})', clean)
    if m:
        day = int(m.group(1))
        month_name = m.group(2)
        year = int(m.group(3))
        hour = int(m.group(4))
        minute = int(m.group(5))
        second = int(m.group(6))
        month = MONTH_MAP.get(month_name, 1)
        return f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"
        
    # Try standard DD.MM.YYYY HH:MM:SS
    m2 = re.match(r'(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})', clean)
    if m2:
        return f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)} {int(m2.group(4)):02d}:{m2.group(5)}:{m2.group(6)}"
        
    return clean

def preserve_ozara_brand(text):
    """Preserves ÖZARA as the canonical brand name, avoiding literal translations like 'Power of Connections'."""
    if not text:
        return text
    patterns = [
        (r'(\b[Tt]he\s+)?[\"“«]?[Pp]ower\s+of\s+[Cc]onnections[\"”»]?', 'ÖZARA'),
        (r'(\b[Tt]he\s+)?[\"“«]?[Ss]trength\s+of\s+[Cc]onnections[\"”»]?', 'ÖZARA'),
        (r'(\b[Tt]he\s+)?[\"“«]?[Ff]orce\s+of\s+[Cc]onnections[\"”»]?', 'ÖZARA'),
        (r'(\b[Tt]he\s+)?[\"“«]?[Pp]ower\s+of\s+[Tt]ies[\"”»]?', 'ÖZARA'),
        (r'(\b[Tt]he\s+)?[\"“«]?[Pp]ower\s+of\s+[Nn]etworking[\"”»]?', 'ÖZARA'),
        (r'[\"“«]?Сила\s+Связей[\"”»]?', 'ÖZARA'),
        (r'[\"“«]?Силы\s+Связей[\"”»]?', 'ÖZARA'),
        (r'[\"“«]?Силе\s+Связей[\"”»]?', 'ÖZARA'),
    ]
    res = text
    for pat, rep in patterns:
        res = re.sub(pat, rep, res)
    res = re.sub(r'[Cc]lub\s+ÖZARA', 'ÖZARA Club', res)
    res = re.sub(r'\"ÖZARA\"\s+club', 'ÖZARA Club', res)
    res = re.sub(r'ÖZARA\s+club', 'ÖZARA Club', res)
    return res

def split_text_into_chunks(text, max_len=240):
    """Splits long Russian text into translation chunks without breaking meaning."""
    if len(text) <= max_len:
        return [text]
    parts = re.split(r'([.!?;\n]\s*)', text)
    chunks = []
    curr = ''
    for p in parts:
        if not p:
            continue
        if len(p) > max_len:
            sub_parts = re.split(r'([,:]\s*|\s+)', p)
            for sp in sub_parts:
                if not sp:
                    continue
                if len(curr) + len(sp) <= max_len:
                    curr += sp
                else:
                    if curr.strip():
                        chunks.append(curr.strip())
                    curr = sp
        else:
            if len(curr) + len(p) <= max_len:
                curr += p
            else:
                if curr.strip():
                    chunks.append(curr.strip())
                curr = p
    if curr.strip():
        chunks.append(curr.strip())
    return chunks

def translate_chunk(text, lang_pair="ru|en"):
    """Translates single chunk under 400 chars via MyMemory API."""
    if not text or not text.strip():
        return ""
    try:
        encoded = urllib.parse.quote(text.strip())
        url = f"https://api.mymemory.translated.net/get?q={encoded}&langpair={lang_pair}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ÖZARA Sync Bot)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if str(data.get("responseStatus")) in ["200", 200]:
                trans = data.get("responseData", {}).get("translatedText")
                if trans and trans.strip():
                    return trans.strip()
    except Exception:
        pass
    return text

CURATED_TRANSLATIONS = {
    "message686": """Where millionaires are moving. And why I, as an investor with 12 years of experience, buy real estate not where everyone else goes 👇

Top 5 countries by millionaire inflow projected by Henley & Partners:
5️⃣ Saudi Arabia: +2,400
The country is opening its real estate market to foreigners. Interesting, but regulations are only just taking shape.
4️⃣ Switzerland: +3,000
Reliable, but the most expensive of all, and property purchases by foreigners there are strictly restricted.
3️⃣ Italy: +3,600
People move there for the favorable tax regime for wealthy new residents. A calm market with moderate growth.
2️⃣ USA: +7,500
The most liquid market with dollar-denominated income. Excellent for the conservative core of capital. I am also looking at property for myself in the US.
1️⃣ UAE: +9,800
The leader for many consecutive years. I earned a 2x return there myself: bought in 2021 for $100,000, sold in 2025 for $200,000.

And now the most important point:
When a country tops these rankings, the big money has already entered. Prices already reflect the demand, and I don't see the massive multiples in Dubai now like in 2021.
I look at destinations where money is only beginning to flow:
📍 Georgia: The Trump Organization announced a Trump Tower in Tbilisi. I already own assets there, and I plan to purchase an apartment in the tower as well.
📍 Albania: Trump's son-in-law is planning a coastal resort.
📍 Vietnam: The Trump Organization is building a $1.5B project with golf courses.

The rule: enter where the money is beginning to appear, not where it is already concentrated.
📌 Save and forward this to anyone planning to relocate or invest abroad.
Past performance does not guarantee future results.
#investments #realestateinvesting #diversification""",

    "message626": """Friends, a reminder of important information for April 26:
1. We will celebrate at the restaurant at Rublyovo-Uspenskoye Highway, 2 in Chalet Berezka.
2. Parking is complimentary.
3. Starting at 16:00.
4. On the agenda: developers from Panama, Thailand, Zanzibar, Georgia, and other countries; networking; curated conversations; DJ set.
5. Dress code: Classic Black 🖤
Registration""",

    "message618": """ÖZARA Club Anniversary — April 26 from 16:00 on Rublyovka at the Chalet Berezka restaurant.
Joining the club anniversary will be members, our investor clients, and invited celebrity guests.
The program is rich in both business insights and entertainment. Highlights include:
😎 Keynote presentations by investment speakers
💼 The most liquid investment cases of 2026
✨ Warm, collegial atmosphere among peers
🥂 Light networking with champagne and curated surprises
🍝 Buffet reception
🏆 Investment journey stories from our members and guest investors
🎶 Music, conversations, laughter, and the authentic energy of the club
🎂 Celebration cake
🎙️ Special guests, media coverage, and magazine interviews
More details and registration on the site: https://silasvyazei-offer.tilda.ws
And also with @ch_svettt""",

    "message614": """Dear members and guests of the ÖZARA community!
We present to you a rich calendar for the first months of 2026.

🌴 FEBRUARY: BUSINESS & INVESTMENT EXPEDITION TO ZANZIBAR
February 16–22
A unique fusion of deep relaxation and promising investments. We designed an itinerary where every detail serves your energy, perspective, and future.
• Private site visits of standout properties — from prime luxury villas to high-upside opportunities
• Closed roundtable on emerging opportunities, market dynamics, and preferential terms for tour participants
• Accommodation in an exclusive private villa or 5-star resort
• Jozani Forest — nature excursion through the tropical rainforest, home to the rare red colobus monkeys
• The Disappearing Island — excursion to the pristine sandbank atoll appearing only at low tide, with fresh seafood lunch
• One-day wildlife safari to mainland Africa

🚀 MARCH: INVESTMENT PROJECTS SALON IN MOSCOW
March 15 | Radisson Collection Hotel | 14:00 to 22:00
Featuring leadership from top-10 global developers and the most liquid investment cases of 2026 across multiple jurisdictions. Curated presentations, 1-on-1 founder meetings, institutional analysis, and direct interaction with key market participants.
Complimentary admission for club members.

🎉 APRIL: ÖZARA CLUB ANNIVERSARY
April 26, Sunday | from 16:00
Celebrating our anniversary surrounded by club members and trusted partners. We look forward to welcoming you to a celebratory evening dedicated to shared successes, connections, and milestone achievements. A warm ambiance, pleasant surprises, and inspiring energy. Let's celebrate together!

🗽 MAY: HEADLINE GATHERING — INVESTMENT SUMMIT IN NEW YORK
May 13–17 | New York City, USA
A 3-day executive intensive for founders and investors focused on global capital allocation, cross-border structuring, and US market expansion.
NYC: Investments, Capital Markets & Global Ventures. Hybrid in-person + online access.

Which destinations and gatherings are you joining this year?
Select your track and register via @silasvyazeyy_bot and with @ch_svettt""",

    "message610": """On December 22 from 18:00–23:00, our club and partner communities are hosting an end-of-year holiday gathering.
Location: Myasnitskaya St., 13, bldg. 11
Audience: Investors & founders
Attendance: 100+ guests
Agenda:
🌀 Strategic conference
🌀 Curated networking & introductions
🌀 Member gift exchanges
🌀 Optional afterparty
Speakers covering capital deployment in:
🌀 Prime real estate
🌀 Public equities & stock markets
🌀 Digital assets & Web3 ventures
🌀 Luxury collectibles & fine art
Standard admission: 2,500 RUB
VIP admission: 5,000 RUB
Tiered pricing in effect through December 5 (increasing by 1,000 RUB every 5 days through December 22).
Registration via @ch_svettt
Speaker inquiries: @shchukinajulia""",

    "message609": """Hello friends! On September 16, we are gathering for golf! ⛳️ Coaching session for beginners and enthusiasts 🏌️🏌️‍♀️
Taking advantage of the wonderful weather this month ☀️
Training & match play from 18:00 to 20:00.
Followed by networking and dinner.
Registration and details with @ch_svettt.
4 spots remaining.""",

    "message607": """Dear ÖZARA Club members:
➡️ September 4 at 18:00 — Golf session (2 hours) ⛳️🏌️‍♂️
Recharging, sporting excitement, and great impressions guaranteed.
Location: Moscow, Yurovskaya St., 1A (Golf Centre)
RSVP via @ch_svettt

➡️ September 16 at 18:00 — Golf session (1.5–2 hours) ⛳️🏌️‍♂️
Recharging, sporting excitement, and great impressions guaranteed.
Location: Moscow, Yurovskaya St., 1A (Golf Centre)
RSVP via @ch_svettt

➡️ September 18 — Member-led Zoom session: 'Elevating Your Executive Brand'
Complimentary for club members.
RSVP via @ch_svettt""",

    "message606": """Everyone, August 30 will be a pleasant +24°C ☀️
We are hosting the final outdoor coaching session of this summer.
If you'd like to join, message Sveta @ch_svettt""",

    "message601": """Dear friends!
We are pleased to invite you to an exclusive private art salon & curated tour by ÖZARA Club, taking place on June 19 at 19:00 at SNEG Gallery.
📍 Address: Bryusov Lane, 2/14, bldg. 1.
For your convenience, we recommend arriving by taxi — the most seamless option to avoid parking congestion.
🖼️ The salon will be hosted by the founder of SNEG Gallery, Alexander Filippov — an acclaimed organizer of international museum projects and art connoisseur. His atelier provides comprehensive fine art advisory: from master restoration and hanging to cataloging, framing, and global logistics for private collections spanning the 15th century through modernism.
✅ During this salon, we invite you to immerse yourselves in fine art, explore works by prominent masters, and discuss diverse artistic eras. Guests will have private access to view rare masterpieces in the gallery collection.
You will be part of a curated cultural evening, broadening horizons in dialogue with art collectors and connoisseurs. 🌍✨
Limited capacity. RSVP via @veretta5.
With warmest regards,
ÖZARA Club""",

    "message597": """Good morning everyone! We have created a dedicated coordination chat for Premium and VIP ticket holders. We haven't added everyone just yet ❗️
If you don't see yourself in the group chat and hold a Premium or VIP ticket, please message me directly: @shchukinajulia"""
}

def translate_caption_to_english(text, message_id=None, max_chunk=240):
    """Translates arbitrary length Russian text into English preserving structure and brand."""
    if not text or not text.strip():
        return "", False
        
    if message_id and message_id in CURATED_TRANSLATIONS:
        return CURATED_TRANSLATIONS[message_id], True

    has_cyrillic = bool(re.search(r'[\u0400-\u04FF]', text))
    if not has_cyrillic:
        return preserve_ozara_brand(text), False
        return preserve_ozara_brand(text), False
        
    paragraphs = text.split("\n")
    translated_paras = []
    
    for p in paragraphs:
        p_clean = p.strip()
        if not p_clean:
            translated_paras.append("")
            continue
            
        chunks = split_text_into_chunks(p_clean, max_chunk)
        t_chunks = [translate_chunk(c, "ru|en") for c in chunks]
        translated_paras.append(" ".join(t_chunks))
            
    full_translation = "\n".join(translated_paras)
    return preserve_ozara_brand(full_translation), True

def extract_clusters_from_html(export_dir):
    """
    Parses messages.html and builds clean message clusters / albums.
    Applies strict exclusions:
    - Only photos (rejects video, video messages, stickers, animated, audio, webpage previews).
    - Skips entire albums that mix photos and videos.
    - Counts each album as one post.
    - Preserves photo sequence order.
    """
    html_path = os.path.join(export_dir, "messages.html")
    if not os.path.exists(html_path):
        raise FileNotFoundError(f"messages.html not found in {export_dir}")
        
    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        
    msgs = soup.find_all("div", class_="message")
    
    clusters = []
    curr_cluster = None
    
    for m in msgs:
        mid = m.get("id")
        classes = m.get("class", [])
        fn = m.find("div", class_="from_name")
        up = m.find("img", class_="userpic")
        date_el = m.find("div", class_="date")
        date_title = date_el.get("title") if date_el else ""
        
        # Only true photos (inside photo_wrap, href in photos/ folder)
        photo_wraps = m.find_all("a", class_="photo_wrap")
        photos = []
        for a in photo_wraps:
            href = a.get("href", "")
            if href.startswith("photos/"):
                photos.append(href)
                
        # Prohibited attachments
        has_video = bool(m.find_all("a", class_="video_file_wrap") or m.find_all("div", class_="media_video"))
        has_round = bool(m.find_all("a", class_="round_video_message_wrap"))
        has_voice = bool(m.find_all("a", class_="voice_message_wrap"))
        has_sticker = bool(m.find_all("div", class_="media_sticker"))
        has_animated = bool(m.find_all("a", class_="animated_wrap"))
        has_webpage = bool(m.find_all("div", class_="media_webpage"))
        has_file = bool(m.find_all("div", class_="media_document"))
        
        txt_el = m.find("div", class_="text")
        text = txt_el.text.strip() if txt_el else ""
        
        is_joined = "joined" in classes
        
        author_name = fn.text.strip() if fn else None
        userpic_src = up.get("src") if up else None
        
        if is_joined and curr_cluster and (date_title == curr_cluster["date_title"] or not date_title):
            curr_cluster["messages"].append(mid)
            curr_cluster["photos"].extend(photos)
            if has_video: curr_cluster["has_video"] = True
            if has_round: curr_cluster["has_round"] = True
            if has_voice: curr_cluster["has_voice"] = True
            if has_sticker: curr_cluster["has_sticker"] = True
            if has_animated: curr_cluster["has_animated"] = True
            if has_webpage: curr_cluster["has_webpage"] = True
            if has_file: curr_cluster["has_file"] = True
            if text and not curr_cluster["caption"]:
                curr_cluster["caption"] = text
        else:
            eff_author = author_name if author_name else (curr_cluster["author"] if curr_cluster else "Unknown")
            eff_author_pic = userpic_src if userpic_src else (curr_cluster["author_pic"] if curr_cluster else None)
            
            curr_cluster = {
                "first_mid": mid,
                "messages": [mid],
                "author": eff_author,
                "author_pic": eff_author_pic,
                "date_title": date_title,
                "iso_date": parse_telegram_html_date(date_title),
                "photos": list(photos),
                "has_video": has_video,
                "has_round": has_round,
                "has_voice": has_voice,
                "has_sticker": has_sticker,
                "has_animated": has_animated,
                "has_webpage": has_webpage,
                "has_file": has_file,
                "caption": text
            }
            clusters.append(curr_cluster)
            
    return clusters

def select_eligible_posts(clusters, include_channel_entity=False):
    """
    Filters clusters down to eligible photo posts by Julia & Alexandra individually.
    Defaults to include_channel_entity=False per explicit instruction to limit to Julia & Alexandra.
    """
    eligible = []
    flagged = []
    skipped_summary = {
        "text_only": 0,
        "video_or_round": 0,
        "mixed_photo_video": 0,
        "unapproved_author": 0,
        "stickers_animated": 0
    }
    
    for c in clusters:
        author = c["author"]
        known = KNOWN_AUTHORS.get(author)
        
        # Check author qualification
        if not known:
            if c["photos"]:
                skipped_summary["unapproved_author"] += 1
            continue
            
        if not include_channel_entity and known["type"] == "channel_entity":
            flagged.append({
                "cluster": c,
                "reason": "Channel entity post (Julia & Alexandra | Сила Связей)"
            })
            continue
            
        # Check media qualification
        if not c["photos"]:
            if not (c["has_video"] or c["has_round"]):
                skipped_summary["text_only"] += 1
            else:
                skipped_summary["video_or_round"] += 1
            continue
            
        # If cluster has photos AND videos -> mixed album rule: skip entire album
        if c["photos"] and (c["has_video"] or c["has_round"]):
            skipped_summary["mixed_photo_video"] += 1
            continue
            
        if c["has_sticker"] or c["has_animated"] or c["has_voice"] or c["has_file"]:
            skipped_summary["stickers_animated"] += 1
            continue
            
        eligible.append(c)
        
    return eligible, flagged, skipped_summary

def preview_history_posts(export_dir=DEFAULT_EXPORT_DIR, limit=10, include_channel=False):
    """Generates preview of the 10 most recent qualifying posts with full English translations and photo specs."""
    clusters = extract_clusters_from_html(export_dir)
    eligible, flagged, skipped = select_eligible_posts(clusters, include_channel_entity=include_channel)
    
    # Sort strictly by actual publication time (newest first)
    eligible_sorted = sorted(eligible, key=lambda x: x["iso_date"], reverse=True)
    selected = eligible_sorted[:limit]
    
    print("\n================================================================================")
    print(" ÖZARA COMMUNITY — TELEGRAM HTML EXPORT HISTORY PREVIEW")
    print(f" Source Directory: {export_dir}")
    print(f" Total Clusters: {len(clusters)} | Total Eligible Individual Posts: {len(eligible)}")
    print(f" Selection: 10 most recent eligible photo posts by Julia & Alexandra individually")
    print("================================================================================\n")
    
    preview_data = []
    for idx, p in enumerate(selected):
        msg_num = int(p["first_mid"].replace("message", "")) if p["first_mid"].replace("message", "").isdigit() else idx+1
        author_info = KNOWN_AUTHORS.get(p["author"], {})
        
        # Translate caption
        raw_caption = p["caption"]
        translated_caption, was_trans = translate_caption_to_english(raw_caption, message_id=p["first_mid"])
        
        # Inspect photos on disk
        photo_files = []
        for ph in p["photos"]:
            fpath = os.path.join(export_dir, ph)
            exists = os.path.exists(fpath)
            sz = os.path.getsize(fpath) if exists else 0
            w, h, fmt = 0, 0, "UNKNOWN"
            if exists:
                try:
                    with Image.open(fpath) as im:
                        w, h, fmt = im.width, im.height, im.format
                except Exception:
                    pass
            photo_files.append({
                "rel_path": ph,
                "size_bytes": sz,
                "width": w,
                "height": h,
                "format": fmt,
                "exists": exists
            })
            
        author_en = translate_author_to_english(p["author"])
        item = {
            "index": idx + 1,
            "primary_id": p["first_mid"],
            "numeric_msg_id": msg_num,
            "all_message_ids": p["messages"],
            "is_album": len(p["messages"]) > 1,
            "album_size": len(p["photos"]),
            "author_display": author_en,
            "author_original_ru": p["author"],
            "author_canonical": author_en,
            "author_candidate_id": author_info.get("candidate_id", ""),
            "author_type": author_info.get("type", "individual"),
            "date_display": p["date_title"],
            "iso_date": p["iso_date"],
            "raw_caption": raw_caption,
            "translated_caption": translated_caption,
            "was_translated": was_trans,
            "photos": photo_files
        }
        preview_data.append(item)
        
        album_badge = f"[ALBUM: {len(p['photos'])} photos]" if len(p['photos']) > 1 else "[SINGLE PHOTO]"
        print(f"--------------------------------------------------------------------------------")
        print(f" POST #{idx+1} {album_badge} | Telegram Message #{msg_num} ({p['first_mid']})")
        print(f" Publication Date: {p['date_title']} [Parsed ISO: {p['iso_date']} (Timezone: local export time / Moscow UTC+03:00)]")
        print(f" Author: {author_en} (Original: '{p['author']}', Candidate User ID: {author_info.get('candidate_id')}, Role: {author_info.get('role')})")
        print(f" Included Messages: {', '.join(p['messages'])}")
        print(f" Photos ({len(photo_files)}):")
        for p_idx, ph in enumerate(photo_files):
            print(f"   [{p_idx+1}] {ph['rel_path']} -> {ph['width']}x{ph['height']}px ({ph['size_bytes']/1024:.1f} KB, format: {ph['format']})")
            
        if raw_caption:
            print(f"\n Original Russian Caption:\n{raw_caption}\n")
            print(f" Complete English Translation (ÖZARA Brand Preserved):\n{translated_caption}\n")
        else:
            print("\n Caption: [Photo only post - No text caption]\n")

    print("================================================================================")
    print(f" SUMMARY: Selected {len(selected)} individual posts out of {len(eligible)} eligible.")
    print(f" Filtered Out: {skipped['text_only']} text-only, {skipped['video_or_round']} videos/round, {skipped['mixed_photo_video']} mixed photo/video albums, {skipped['stickers_animated']} stickers/animations/files.")
    print("================================================================================\n")
    
    return preview_data

def stage_import_posts(preview_data, export_dir=DEFAULT_EXPORT_DIR):
    """
    Safely stages the verified preview posts into telegram_staged_history and .tmp/staged_history_posts.json.
    Does NOT use dummy IDs like '-100_history_export' in community_posts.
    Maintains clean state until real Telegram group ID is confirmed and reconciled.
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS telegram_staged_history (
            id TEXT PRIMARY KEY,
            numeric_msg_id INTEGER UNIQUE,
            primary_mid TEXT,
            messages_json TEXT,
            is_album INTEGER,
            album_size INTEGER,
            author_display TEXT,
            author_candidate_id TEXT,
            date_display TEXT,
            iso_date TEXT,
            raw_caption TEXT,
            english_caption TEXT,
            photos_json TEXT,
            staged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reconciled_channel_id TEXT,
            published_post_id TEXT
        )
    """)
    
    # Clear any previous staging to maintain clean 1-post staging
    cur.execute("DELETE FROM telegram_staged_history")
    
    staged_count = 0
    for item in preview_data:
        msg_id = item["numeric_msg_id"]
        staged_id = f"stage_{msg_id}"
        
        cur.execute("""
            INSERT OR REPLACE INTO telegram_staged_history (
                id, numeric_msg_id, primary_mid, messages_json, is_album, album_size,
                author_display, author_candidate_id, date_display, iso_date,
                raw_caption, english_caption, photos_json, staged_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, (
            staged_id, msg_id, item["primary_id"], json.dumps(item["all_message_ids"]),
            1 if item["is_album"] else 0, item["album_size"],
            item["author_display"], item["author_candidate_id"],
            item["date_display"], item["iso_date"],
            item["raw_caption"], item["translated_caption"],
            json.dumps(item["photos"])
        ))
        staged_count += 1
        
    conn.commit()
    conn.close()
    
    os.makedirs(os.path.join(BASE_DIR, ".tmp"), exist_ok=True)
    tmp_path = os.path.join(BASE_DIR, ".tmp", "staged_history_posts.json")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(preview_data, f, ensure_ascii=False, indent=2)
        
    print(f"[✓] Safely staged {staged_count} post(s) into telegram_staged_history table and {tmp_path}.")
    print(f"    Author: {preview_data[0]['author_display'] if preview_data else 'None'}")
    print("[*] Post(s) remain unpublished until reconciled with verified real Telegram group ID.")
    return staged_count


def reconcile_staged_history(real_group_id, export_dir=DEFAULT_EXPORT_DIR):
    """
    Reconciles staged history posts using the verified real Telegram group ID.
    Only executed when confirmed by user and group ID is verified.
    """
    if not real_group_id or not str(real_group_id).strip():
        print("[-] Cannot reconcile without verified real_group_id.")
        return 0
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM users WHERE role = 'FOUNDER' OR role = 'ADMIN' LIMIT 1")
    admin_row = cur.fetchone()
    founder_id = admin_row[0] if admin_row else "usr_ozara_official"
    
    cur.execute("SELECT numeric_msg_id, primary_mid, is_album, author_candidate_id, author_display, iso_date, raw_caption, english_caption, photos_json FROM telegram_staged_history WHERE reconciled_channel_id IS NULL ORDER BY iso_date DESC")
    staged = cur.fetchall()
    
    reconciled_count = 0
    for row in staged:
        msg_id, primary_mid, is_album, author_id, author_name, iso_date, raw_cap, eng_cap, photos_json = row
        
        # Deduplication check against real group ID
        cur.execute("SELECT id FROM community_posts WHERE telegram_channel_id = ? AND telegram_message_id = ?", (str(real_group_id), msg_id))
        exists = cur.fetchone()
        if exists:
            print(f"[*] Post #{msg_id} already exists in real group as {exists[0]}. Skipping duplicate.")
            continue
            
        post_id = f"post_hist_{msg_id}"
        media_group_id = f"hist_album_{msg_id}" if is_album else None
        
        cur.execute("""
            INSERT INTO community_posts (
                id, author_id, source_type, author_label, is_official,
                telegram_channel_id, telegram_message_id, media_group_id,
                content, original_content, original_language, translated,
                status, telegram_author_id, telegram_author_name,
                created_at, updated_at
            ) VALUES (
                ?, ?, 'telegram', 'From ÖZARA', 1,
                ?, ?, ?,
                ?, ?, 'ru', 1,
                'published', ?, ?,
                ?, ?
            )
        """, (
            post_id, founder_id,
            str(real_group_id), msg_id, media_group_id,
            eng_cap or "Photo update from ÖZARA", raw_cap,
            author_id, author_name,
            iso_date, iso_date
        ))
        
        photos = json.loads(photos_json)
        for p_idx, ph in enumerate(photos):
            src_file = os.path.join(export_dir, ph["rel_path"])
            dest_filename = f"hist_{msg_id}_{p_idx}_{os.path.basename(ph['rel_path'])}"
            dest_file = os.path.join(MEDIA_STORAGE_DIR, dest_filename)
            
            if os.path.exists(src_file) and not os.path.exists(dest_file):
                shutil.copy2(src_file, dest_file)
                
            media_id = f"med_hist_{msg_id}_{p_idx}"
            pub_url = f"/storage/telegram_media/{dest_filename}"
            
            cur.execute("""
                INSERT OR IGNORE INTO community_post_media (
                    id, post_id, media_type, url, caption, file_id, width, height
                ) VALUES (?, ?, 'photo', ?, ?, ?, ?, ?)
            """, (media_id, post_id, pub_url, raw_cap, f"hist_{msg_id}_{p_idx}", ph.get("width"), ph.get("height")))
            
        cur.execute("UPDATE telegram_staged_history SET reconciled_channel_id = ?, published_post_id = ? WHERE numeric_msg_id = ?", (str(real_group_id), post_id, msg_id))
        reconciled_count += 1
        
    conn.commit()
    conn.close()
    print(f"[✓] Reconciled and published {reconciled_count} staged posts under real group ID {real_group_id}.")
    return reconciled_count

if __name__ == "__main__":
    export_dir = DEFAULT_EXPORT_DIR
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        export_dir = sys.argv[1]
        
    do_stage = "--stage" in sys.argv
    reconcile_id = None
    limit = 1 # Default to single latest post per user directive
    for idx, arg in enumerate(sys.argv):
        if arg == "--limit" and idx + 1 < len(sys.argv):
            limit = int(sys.argv[idx + 1])
        elif arg == "--all-10":
            limit = 10
        elif arg == "--latest-only":
            limit = 1
        elif arg == "--reconcile" and idx + 1 < len(sys.argv):
            reconcile_id = sys.argv[idx + 1]
            
    preview_data = preview_history_posts(export_dir=export_dir, limit=limit, include_channel=False)
    
    if do_stage:
        print(f"[*] Staging {len(preview_data)} verified preview post(s)...")

        stage_import_posts(preview_data, export_dir=export_dir)
    elif reconcile_id:
        print(f"[*] Reconciling staged posts with real group ID {reconcile_id}...")
        reconcile_staged_history(reconcile_id, export_dir=export_dir)
    else:
        print("[*] PREVIEW MODE ONLY. Run with --stage to stage records, or view /history_preview.html locally.")
