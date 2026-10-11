#!/usr/bin/env python3
"""
Generates public/history_preview.html with:
- The single latest post (message686 / message686–message693, 8 October 2026)
- Author header: Picture + "Julia Shchukina | Founder" and nothing else (clean luxury)
- Large image with smooth swipe support (touch swipe + mouse drag + arrows)
- Smaller thumbnails removed completely
- English version only (Russian source removed completely)
- Minimal status notice
"""

import os
import html
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(BASE_DIR, "public", "history_preview.html")

LATEST_POST = {
    "index": 1,
    "mid": "message686",
    "messages": "message686 – message693",
    "date": "8 October 2026, 11:33:14",
    "iso": "2026-10-08 11:33:14",
    "author_name": "Julia Shchukina | Founder",
    "photos": [
        {"file": "photo_686_0.jpg", "label": "Slide 1 of 8"},
        {"file": "photo_687_0.jpg", "label": "Slide 2 of 8"},
        {"file": "photo_688_0.jpg", "label": "Slide 3 of 8"},
        {"file": "photo_689_0.jpg", "label": "Slide 4 of 8"},
        {"file": "photo_690_0.jpg", "label": "Slide 5 of 8"},
        {"file": "photo_691_0.jpg", "label": "Slide 6 of 8"},
        {"file": "photo_692_0.jpg", "label": "Slide 7 of 8"},
        {"file": "photo_693_0.jpg", "label": "Slide 8 of 8"}
    ],
    "english": """Where millionaires are moving. And why I, as an investor with 12 years of experience, buy real estate not where everyone goes 👇

Top 5 countries by millionaire inflow according to Henley & Partners forecast:
5️⃣ Saudi Arabia: +2,400 
The country is opening its real estate market to foreigners. Interesting, but the rules are only now being formed.
4️⃣ Switzerland: +3,000
Reliable, but the most expensive of all, and residential property purchase by foreigners there is heavily restricted.
3️⃣ Italy: +3,600
People go for the tax regime for wealthy new residents. The market is quiet, growth is moderate.
2️⃣ USA: +7,500
The most liquid market and dollar income. For the conservative portion of capital - excellent. I am also looking at real estate for myself in the USA.
1️⃣ UAE: +9,800
Leader for many years in a row. I personally made a 2x return there: bought in 2021 for $100,000, sold in 2025 for $200,000.

And now the main point.
When a country tops such ratings, big money has already entered. Prices reflect demand, and multiples like in 2021 I do not see in Dubai right now.
I look where money is only beginning to flow:
📍 Georgia: Trump Organization announced Trump Tower in Tbilisi. I already have properties there, and in the tower I also plan to buy an apartment.
📍 Albania: Trump's son-in-law is planning a resort on the coast.
📍 Vietnam: Trump Organization is building a $1.5 billion project with golf courses.

Rule: enter where money is emerging, not where it already is.
📌 Save and forward to anyone planning to move or invest abroad.
Past results do not guarantee future ones.
#investments #realestateinvesting #diversification"""
}

def generate_preview():
    p = LATEST_POST
    photos = p["photos"]
    
    eng_formatted = html.escape(p['english']).replace('\n', '<br>')
    photos_json = json.dumps(photos)
    
    dots_items = []
    for i in range(len(photos)):
        active_cls = "active" if i == 0 else ""
        dots_items.append(f"""<button class="carousel-dot {active_cls}" data-index="{i}" onclick="goToSlide({i})" aria-label="Slide {i+1}"></button>""")
    dots_html = "".join(dots_items)

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ÖZARA — Latest Telegram Post Review</title>
  <style>
    :root {{
      --bg: #090d16;
      --card-bg: #101726;
      --card-border: #1e293b;
      --accent-gold: #c5a059;
      --accent-gold-light: #dfc082;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }}
    
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    
    body {{
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font);
      line-height: 1.6;
      padding: 2.5rem 1rem 5rem;
    }}
    
    .container {{
      max-width: 780px;
      margin: 0 auto;
    }}
    
    /* Post Card */
    .post-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    }}
    
    /* Clean Author Header: Picture + Name | Title ONLY */
    .author-header {{
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.015);
    }}
    
    .author-avatar {{
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1.5px solid var(--accent-gold);
      object-fit: cover;
      display: block;
    }}
    
    .author-name {{
      font-size: 1.05rem;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: -0.01em;
    }}
    
    /* Main Carousel Stage */
    .carousel-stage {{
      position: relative;
      width: 100%;
      height: 580px;
      background: #04070e;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      touch-action: pan-y;
      cursor: grab;
      overflow: hidden;
    }}
    
    .carousel-stage:active {{
      cursor: grabbing;
    }}
    
    .carousel-slide-img {{
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
      transition: opacity 0.2s ease-in-out;
      pointer-events: none;
    }}
    
    /* Overlay Arrows (Left & Right) */
    .carousel-arrow {{
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 42px;
      height: 42px;
      background: rgba(16, 23, 38, 0.8);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      cursor: pointer;
      z-index: 10;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    }}
    
    .carousel-arrow:hover {{
      background: var(--accent-gold);
      color: #0b0f19;
      border-color: var(--accent-gold-light);
      transform: translateY(-50%) scale(1.06);
    }}
    
    .carousel-arrow.prev {{
      left: 1rem;
    }}
    
    .carousel-arrow.next {{
      right: 1rem;
    }}
    
    /* Photo Counter Pill (📷 1 / 8) */
    .carousel-counter-pill {{
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(11, 15, 25, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      padding: 0.3rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      z-index: 8;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }}
    
    /* Subtle Pagination Dots */
    .carousel-dots {{
      display: flex;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.85rem 0 0.5rem;
      background: rgba(255, 255, 255, 0.015);
    }}
    
    .carousel-dot {{
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      border: none;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s ease;
    }}
    
    .carousel-dot.active {{
      background: var(--accent-gold);
      transform: scale(1.3);
      box-shadow: 0 0 6px rgba(197, 160, 89, 0.5);
    }}
    
    /* English Content Only */
    .content-container {{
      padding: 1.75rem 2rem 2.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }}
    
    .text-body {{
      font-size: 0.96rem;
      line-height: 1.75;
      color: var(--text-main);
      word-break: break-word;
    }}
    
    /* Card Footer / Staged Note */
    .card-footer {{
      padding: 1rem 1.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }}
    
    @media (max-width: 640px) {{
      .carousel-stage {{
        height: 420px;
      }}
      .content-container {{
        padding: 1.25rem 1.25rem 1.75rem;
      }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="post-card">
      <!-- Clean Author Header: Picture + "Julia Shchukina | Founder" and nothing else -->
      <div class="author-header">
        <img src="/avatars/julia_shchukina.jpg" alt="Julia Shchukina" class="author-avatar" onerror="this.src='/investments/icons/fallback.png'" />
        <span class="author-name">{p['author_name']}</span>
      </div>
      
      <!-- Big Picture Carousel with Swipe -->
      <div class="carousel-stage" id="carouselStage">
        <!-- Photo Counter -->
        <div class="carousel-counter-pill" id="counterPill">
          <span>📷</span>
          <span id="counterText">1 / {len(photos)}</span>
        </div>
        
        <!-- Navigation Arrows -->
        <button class="carousel-arrow prev" onclick="prevSlide(event)" aria-label="Previous">‹</button>
        <button class="carousel-arrow next" onclick="nextSlide(event)" aria-label="Next">›</button>
        
        <!-- Big Picture Image -->
        <img id="carouselImg" class="carousel-slide-img" src="/preview_media/{photos[0]['file']}" alt="Slide 1" />
      </div>
      
      <!-- Dots -->
      <div class="carousel-dots">
        {dots_html}
      </div>
      
      <!-- English Text Only -->
      <div class="content-container">
        <div class="text-body">{eng_formatted}</div>
      </div>
      
      <!-- Clean Footer -->
      <div class="card-footer">
        <div>
          <span>Staged status: <strong>Unpublished</strong> · Awaiting real group ID reconciliation</span>
        </div>
        <div>
          <span>Date: 8 October 2026</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    const photos = {photos_json};
    let currentIndex = 0;
    
    const carouselStage = document.getElementById('carouselStage');
    const carouselImg = document.getElementById('carouselImg');
    const counterText = document.getElementById('counterText');
    
    function updateCarousel() {{
      const p = photos[currentIndex];
      
      carouselImg.style.opacity = '0.3';
      setTimeout(() => {{
        carouselImg.src = '/preview_media/' + p.file;
        carouselImg.alt = p.label;
        carouselImg.style.opacity = '1';
      }}, 80);
      
      counterText.textContent = (currentIndex + 1) + ' / ' + photos.length;
      
      // Update dots
      document.querySelectorAll('.carousel-dot').forEach((dot, idx) => {{
        if (idx === currentIndex) {{
          dot.classList.add('active');
        }} else {{
          dot.classList.remove('active');
        }}
      }});
    }}
    
    function prevSlide(e) {{
      if (e) e.stopPropagation();
      currentIndex = (currentIndex - 1 + photos.length) % photos.length;
      updateCarousel();
    }}
    
    function nextSlide(e) {{
      if (e) e.stopPropagation();
      currentIndex = (currentIndex + 1) % photos.length;
      updateCarousel();
    }}
    
    function goToSlide(idx) {{
      if (idx >= 0 && idx < photos.length) {{
        currentIndex = idx;
        updateCarousel();
      }}
    }}
    
    // Touch swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    
    carouselStage.addEventListener('touchstart', (e) => {{
      touchStartX = e.changedTouches[0].screenX;
    }}, {{ passive: true }});
    
    carouselStage.addEventListener('touchend', (e) => {{
      touchEndX = e.changedTouches[0].screenX;
      handleGesture();
    }}, {{ passive: true }});
    
    // Mouse drag swipe support
    let isMouseDown = false;
    let mouseStartX = 0;
    
    carouselStage.addEventListener('mousedown', (e) => {{
      isMouseDown = true;
      mouseStartX = e.clientX;
    }});
    
    window.addEventListener('mouseup', (e) => {{
      if (!isMouseDown) return;
      isMouseDown = false;
      const diff = e.clientX - mouseStartX;
      if (diff > 40) {{
        prevSlide();
      }} else if (diff < -40) {{
        nextSlide();
      }}
    }});
    
    function handleGesture() {{
      const diff = touchEndX - touchStartX;
      if (diff > 40) {{
        prevSlide();
      }} else if (diff < -40) {{
        nextSlide();
      }}
    }}
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {{
      if (e.key === 'ArrowLeft') {{
        prevSlide();
      }} else if (e.key === 'ArrowRight') {{
        nextSlide();
      }}
    }});
  </script>
</body>
</html>
"""

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(full_html)
        
    print(f"✓ Successfully generated {OUTPUT_PATH}")
    print(f"  Author Header: {p['author_name']}")
    print(f"  Carousel: Big picture with swipe & arrows ({len(photos)} slides)")
    print(f"  Content: English only")

if __name__ == "__main__":
    generate_preview()
