#!/usr/bin/env python3
"""
tools/seed_fictional_network_members.py
Seeds 20 clearly fictional, high-quality test members for ÖZARA.
Preserves:
- Elena Alexeeva (usr_muwksc1i)
- Elena Ermolov (usr_elena)
- Alexandra Hill (usr_alexandra)
- Julia Shchukina (usr_julia)
Removes all other test accounts and test data.
Marks all 20 fictional members with is_test = 1 and safe @example.com emails.
"""

import sqlite3
import json
import shutil
from pathlib import Path
from datetime import datetime

FICTIONAL_MEMBERS = [
    {
        "id": "usr_fictional_01",
        "full_name": "Dr. Marcus Vance",
        "email": "marcus.vance@example.com",
        "phone": "+1 555-0101",
        "headline": "Founder & CEO at QuantumNeural Labs | Ex-DeepMind",
        "city": "Boston",
        "state": "Massachusetts",
        "country": "United States",
        "chapter_id": "ch_boston",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/marcusvance",
        "job_title": "Founder & CEO",
        "company": "QuantumNeural Labs",
        "university": "MIT",
        "industry": "Technology",
        "interests": ["Quantum Computing", "Mountaineering", "Classical Piano"],
        "expertise": ["AI Architecture", "Scalable Systems", "Quantum Simulation"],
        "offers": "Introductions to top Boston and Cambridge deep-tech founders and university research labs.",
        "focus": "Scaling hybrid neural-symbolic inference architectures for biotechnology.",
        "explore_industries": ["Biotechnology", "CleanTech"],
        "looking_to_connect": "AI researchers, biotech venture partners, and quantum computing hardware engineers."
    },
    {
        "id": "usr_fictional_02",
        "full_name": "Sophia Sterling",
        "email": "sophia.sterling@example.com",
        "phone": "+1 555-0102",
        "headline": "Managing Partner at Horizon Venture Partners",
        "city": "Silicon Valley",
        "state": "California",
        "country": "United States",
        "chapter_id": "ch_silicon_valley",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/sophiasterling",
        "job_title": "Managing Partner",
        "company": "Horizon Venture Partners",
        "university": "Stanford University",
        "industry": "Venture Capital",
        "interests": ["Climate Tech", "Kite Surfing", "Contemporary Art"],
        "expertise": ["Early-Stage Venture Capital", "Board Governance", "Syndication"],
        "offers": "Pitch deck reviews, syndication, and US seed-to-Series A introductions.",
        "focus": "Deploying $120M Fund III into decarbonization infrastructure and AI tooling.",
        "explore_industries": ["Decarbonization", "Artificial Intelligence"],
        "looking_to_connect": "Technical founders building deep-tech solutions with defensible IP."
    },
    {
        "id": "usr_fictional_03",
        "full_name": "Julian Thorne, MD",
        "email": "julian.thorne@example.com",
        "phone": "+1 555-0103",
        "headline": "Chief Medical Officer at CellGen Therapeutics | Clinical Faculty",
        "city": "Boston",
        "state": "Massachusetts",
        "country": "United States",
        "chapter_id": "ch_boston",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "through_team",
        "zoom_link": "",
        "job_title": "Chief Medical Officer",
        "company": "CellGen Therapeutics",
        "university": "Harvard Medical School",
        "industry": "Healthcare & Biotech",
        "interests": ["Longevity Medicine", "Marathon Running", "Bioethics"],
        "expertise": ["Gene Therapy", "Clinical Trial Design", "FDA Regulatory"],
        "offers": "Advisory on FDA regulatory pathways, pre-clinical trial structuring, and translational medicine.",
        "focus": "Phase 2 trials for targeted mRNA oncology therapeutics.",
        "explore_industries": ["Gene Editing", "Digital Biomarkers"],
        "looking_to_connect": "Biotech executives, clinical researchers, and healthcare venture funds."
    },
    {
        "id": "usr_fictional_04",
        "full_name": "Camilla Rossi",
        "email": "camilla.rossi@example.com",
        "phone": "+1 555-0104",
        "headline": "Principal at Rossi Real Estate Capital | Ultra-Luxury Residential",
        "city": "Miami",
        "state": "Florida",
        "country": "United States",
        "chapter_id": "ch_miami",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/camillarossi",
        "job_title": "Principal",
        "company": "Rossi Real Estate Capital",
        "university": "Columbia University",
        "industry": "Real Estate",
        "interests": ["Architectural Design", "Sailing", "Mediterranean Gastronomy"],
        "expertise": ["Waterfront Development", "Cross-Border Capital", "Hospitality Assets"],
        "offers": "Off-market acquisition insights across South Florida and Southern Europe.",
        "focus": "Developing an eco-luxury branded residential enclave in Biscayne Bay.",
        "explore_industries": ["PropTech", "Eco-Hospitality"],
        "looking_to_connect": "Private family offices, architects, and prime hospitality operators."
    },
    {
        "id": "usr_fictional_05",
        "full_name": "David H. Klein",
        "email": "david.klein@example.com",
        "phone": "+1 555-0105",
        "headline": "Senior Partner at Klein, Vance & Sterling LLP | Cross-Border M&A",
        "city": "New York",
        "state": "New York",
        "country": "United States",
        "chapter_id": "ch_newyork",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "through_team",
        "zoom_link": "",
        "job_title": "Senior Partner",
        "company": "Klein, Vance & Sterling LLP",
        "university": "Yale Law School",
        "industry": "Law & Governance",
        "interests": ["Antique Book Collecting", "Chess", "Opera"],
        "expertise": ["Corporate Governance", "Tech M&A", "Sovereign Structuring"],
        "offers": "Strategic counsel on international restructuring and regulatory compliance.",
        "focus": "Structuring transnational cross-border AI acquisitions between US and EMEA.",
        "explore_industries": ["Cross-Border Law", "Tech Policy"],
        "looking_to_connect": "Corporate leaders, family office general counsel, and venture capitalists."
    },
    {
        "id": "usr_fictional_06",
        "full_name": "Dr. Amara Okafor",
        "email": "amara.okafor@example.com",
        "phone": "+1 555-0106",
        "headline": "Chair of Computational Biology & Fellow at Oxford Institute",
        "city": "London",
        "state": "Greater London",
        "country": "United Kingdom",
        "chapter_id": "ch_london",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/amaraokafor",
        "job_title": "Chair of Computational Biology",
        "company": "Oxford Institute",
        "university": "University of Oxford",
        "industry": "Research & Academia",
        "interests": ["Deep Learning", "African Modern Art", "Cello"],
        "expertise": ["Protein Folding", "Algorithmic Genomics", "Translational Science"],
        "offers": "Academic research partnerships, peer review insights, and fellowship sponsorships.",
        "focus": "Generative diffusion models for synthetic enzyme discovery.",
        "explore_industries": ["Bioinformatics", "AI Drug Discovery"],
        "looking_to_connect": "Fellow researchers, university leadership, and biotech entrepreneurs."
    },
    {
        "id": "usr_fictional_07",
        "full_name": "Tariq Al-Hashemi",
        "email": "tariq.hashemi@example.com",
        "phone": "+1 555-0107",
        "headline": "Managing Director at Al-Hashemi Family Office | Global Allocator",
        "city": "Dubai",
        "state": "Dubai",
        "country": "United Arab Emirates",
        "chapter_id": "ch_dubai",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "",
        "job_title": "Managing Director",
        "company": "Al-Hashemi Family Office",
        "university": "London School of Economics",
        "industry": "Finance",
        "interests": ["Falconry", "High-Altitude Hiking", "Arabian Horsemanship"],
        "expertise": ["Direct Co-Investments", "Infrastructure", "Macro Hedging"],
        "offers": "GCC market entry strategy, local family office syndicates, and sovereign wealth navigation.",
        "focus": "Long-term energy transition allocations and global private credit.",
        "explore_industries": ["Private Credit", "Green Infrastructure"],
        "looking_to_connect": "Institutional asset managers, sovereign wealth directors, and founders expanding to GCC."
    },
    {
        "id": "usr_fictional_08",
        "full_name": "Helena von Berg",
        "email": "helena.vonberg@example.com",
        "phone": "+1 555-0108",
        "headline": "Co-Founder & CTO at Chronos Robotics | Industrial Automation",
        "city": "Zurich",
        "state": "Zurich",
        "country": "Switzerland",
        "chapter_id": "ch_zurich",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/helenavonberg",
        "job_title": "Co-Founder & CTO",
        "company": "Chronos Robotics",
        "university": "ETH Zurich",
        "industry": "Technology",
        "interests": ["Alpine Skiing", "Precision Mechanics", "Drone Photography"],
        "expertise": ["Autonomous Hardware", "Embedded Edge Compute", "Robotics"],
        "offers": "Technical diligence on robotics startups, EU industrial manufacturing contacts.",
        "focus": "Zero-latency spatial perception for heavy logistics automation.",
        "explore_industries": ["Industrial Automation", "Edge Computing"],
        "looking_to_connect": "Industrial CEOs, robotics engineers, and hardware investors."
    },
    {
        "id": "usr_fictional_09",
        "full_name": "Kenji Takahashi",
        "email": "kenji.takahashi@example.com",
        "phone": "+1 555-0109",
        "headline": "Founder & General Partner at Pacific DeepTech Capital",
        "city": "Tokyo",
        "state": "Tokyo",
        "country": "Japan",
        "chapter_id": "ch_tokyo",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "through_team",
        "zoom_link": "",
        "job_title": "General Partner",
        "company": "Pacific DeepTech Capital",
        "university": "University of Tokyo",
        "industry": "Venture Capital",
        "interests": ["Tea Ceremonies", "Shogi", "Kyudo Archery"],
        "expertise": ["Semiconductor Supply Chains", "Cross-Pacific Expansion", "Materials Science"],
        "offers": "Introductions to Japanese corporate venture funds and advanced materials suppliers.",
        "focus": "Backing next-generation lithography and quantum sensing hardware.",
        "explore_industries": ["Semiconductors", "Quantum Sensing"],
        "looking_to_connect": "Hardware founders, semiconductor innovators, and Tokyo chapter members."
    },
    {
        "id": "usr_fictional_10",
        "full_name": "Chloe Devereux",
        "email": "chloe.devereux@example.com",
        "phone": "+1 555-0110",
        "headline": "Managing Director at Devereux Private Wealth & Art Advisory",
        "city": "Paris",
        "state": "Île-de-France",
        "country": "France",
        "chapter_id": "ch_paris",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/chloedevereux",
        "job_title": "Managing Director",
        "company": "Devereux Private Wealth",
        "university": "University of Cambridge",
        "industry": "Finance",
        "interests": ["Modern French Literature", "Horse Polo", "Wine Curation"],
        "expertise": ["Art as an Asset Class", "Estate Succession", "Private Wealth"],
        "offers": "Blue-chip art authentication, private museum collection loans, and family governance.",
        "focus": "Advising European families on digital cataloging and cross-jurisdictional heritage assets.",
        "explore_industries": ["Family Wealth Governance", "Art Investment"],
        "looking_to_connect": "Family office principals, museum curators, and international collectors."
    },
    {
        "id": "usr_fictional_11",
        "full_name": "Rohan Mehta",
        "email": "rohan.mehta@example.com",
        "phone": "+1 555-0111",
        "headline": "Founder & CEO at Omnichannel Fintech | YC Alum",
        "city": "New York",
        "state": "New York",
        "country": "United States",
        "chapter_id": "ch_newyork",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/rohanmehta",
        "job_title": "Founder & CEO",
        "company": "Omnichannel Fintech",
        "university": "Wharton School",
        "industry": "Finance",
        "interests": ["Squash", "Angel Investing", "Urban Micro-Distilleries"],
        "expertise": ["Payments Infrastructure", "Cross-Border Treasury", "SaaS Scale"],
        "offers": "Product-market fit advisory, hiring senior engineering leaders in NYC.",
        "focus": "Expanding real-time settlement rails across Latin America and North America.",
        "explore_industries": ["Fintech", "Payment Rails"],
        "looking_to_connect": "Bank partners, fintech operators, and growth-stage investors."
    },
    {
        "id": "usr_fictional_12",
        "full_name": "Astrid Lindholm",
        "email": "astrid.lindholm@example.com",
        "phone": "+1 555-0112",
        "headline": "Head of Clean Energy Transition at Nordic Infra Partners",
        "city": "Stockholm",
        "state": "Stockholm",
        "country": "Sweden",
        "chapter_id": "ch_stockholm",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1534751516642-a171ed28a9b1?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "",
        "job_title": "Head of Clean Energy",
        "company": "Nordic Infra Partners",
        "university": "Stockholm School of Economics",
        "industry": "Energy & Infrastructure",
        "interests": ["Trail Ultramarathons", "Geothermal Architecture", "Nordic History"],
        "expertise": ["Green Hydrogen", "Project Finance", "EU Grid Policy"],
        "offers": "Clean energy project underwriting models and connections to Nordic sovereign funds.",
        "focus": "Offshore wind grid integration and battery storage projects in the North Sea.",
        "explore_industries": ["Renewable Energy", "Grid Infrastructure"],
        "looking_to_connect": "Energy developers, institutional ESG allocators, and Nordic founders."
    },
    {
        "id": "usr_fictional_13",
        "full_name": "Dr. Liam Gallagher",
        "email": "liam.gallagher@example.com",
        "phone": "+1 555-0113",
        "headline": "Director of Artificial Intelligence at CyberShield Corp | MIT Faculty",
        "city": "Boston",
        "state": "Massachusetts",
        "country": "United States",
        "chapter_id": "ch_boston",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/liamgallagher",
        "job_title": "Director of AI",
        "company": "CyberShield Corp",
        "university": "MIT",
        "industry": "Technology",
        "interests": ["Rowing on the Charles", "Cryptography", "Woodworking"],
        "expertise": ["Adversarial Robustness", "Zero-Trust Architecture", "AI Security"],
        "offers": "Cybersecurity audits for portfolio companies and high-net-worth digital hygiene.",
        "focus": "Defense against automated deepfake voice cloning and enterprise impersonation.",
        "explore_industries": ["Cybersecurity", "Zero-Trust Systems"],
        "looking_to_connect": "Chief Information Security Officers, national security researchers, and AI startups."
    },
    {
        "id": "usr_fictional_14",
        "full_name": "Isabella Chen",
        "email": "isabella.chen@example.com",
        "phone": "+1 555-0114",
        "headline": "Partner at Vertex Asia Ventures | Frontier Markets",
        "city": "Singapore",
        "state": "Central Region",
        "country": "Singapore",
        "chapter_id": "ch_singapore",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/isabellachen",
        "job_title": "Partner",
        "company": "Vertex Asia Ventures",
        "university": "Princeton University",
        "industry": "Venture Capital",
        "interests": ["Scuba Diving", "Asian Contemporary Ceramics", "Badminton"],
        "expertise": ["Southeast Asian Expansion", "Growth Equity", "B2B Marketplaces"],
        "offers": "Regional regulatory insights in Singapore, Indonesia, and Vietnam.",
        "focus": "Backing B2B supply chain digitization and climate-resilient agriculture in ASEAN.",
        "explore_industries": ["Supply Chain", "Agritech"],
        "looking_to_connect": "Founders expanding into Asia-Pacific, LPs, and regional founders."
    },
    {
        "id": "usr_fictional_15",
        "full_name": "Mateo Fernandez",
        "email": "mateo.fernandez@example.com",
        "phone": "+1 555-0115",
        "headline": "Founder & Managing Director at Oceanview Capital | Hospitality & PropTech",
        "city": "Miami",
        "state": "Florida",
        "country": "United States",
        "chapter_id": "ch_miami",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "",
        "job_title": "Founder & Managing Director",
        "company": "Oceanview Capital",
        "university": "University of Miami",
        "industry": "Real Estate",
        "interests": ["Deep Sea Sportfishing", "Regatta Sailing", "Speakeasy Mixology"],
        "expertise": ["Boutique Hotel Development", "Hospitality Licensing", "PropTech"],
        "offers": "Prime hospitality sites and JV structuring across Florida and the Caribbean.",
        "focus": "Launching a private members beachfront club in Coconut Grove.",
        "explore_industries": ["Hospitality", "PropTech"],
        "looking_to_connect": "Private hotel operators, luxury lifestyle brands, and Miami leaders."
    },
    {
        "id": "usr_fictional_16",
        "full_name": "Dr. Evelyn Reed",
        "email": "evelyn.reed@example.com",
        "phone": "+1 555-0116",
        "headline": "Professor of Law & Director at Center for AI Governance",
        "city": "New York",
        "state": "New York",
        "country": "United States",
        "chapter_id": "ch_newyork",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "through_team",
        "zoom_link": "",
        "job_title": "Professor of Law",
        "company": "Center for AI Governance",
        "university": "Columbia University",
        "industry": "Law & Academia",
        "interests": ["Chamber Music", "Historical Biographies", "Botanical Illustration"],
        "expertise": ["AI Ethics", "Transatlantic Tech Policy", "Antitrust"],
        "offers": "Expert testimony, board-level ethical governance reviews, and international policy briefings.",
        "focus": "Harmonizing EU AI Act requirements with US enterprise deployment standards.",
        "explore_industries": ["AI Governance", "LegalTech"],
        "looking_to_connect": "Policy makers, general counsel at large tech enterprises, and think tank directors."
    },
    {
        "id": "usr_fictional_17",
        "full_name": "Alexander Cruz",
        "email": "alexander.cruz@example.com",
        "phone": "+1 555-0117",
        "headline": "Head of Autonomous Mobility at Cruz Dynamics | Silicon Valley",
        "city": "Silicon Valley",
        "state": "California",
        "country": "United States",
        "chapter_id": "ch_silicon_valley",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/alexandercruz",
        "job_title": "Head of Autonomous Mobility",
        "company": "Cruz Dynamics",
        "university": "Stanford University",
        "industry": "Technology",
        "interests": ["Vintage Porsche Restoration", "Road Cycling", "Sci-Fi Literature"],
        "expertise": ["Computer Vision", "LiDAR Sensors", "EV Powertrains"],
        "offers": "Hardware prototyping resources and engineering recruitment strategy in the Bay Area.",
        "focus": "Commercial autonomous trucking trials on Interstate 10.",
        "explore_industries": ["Mobility", "Clean Transport"],
        "looking_to_connect": "Automotive OEMs, sensor manufacturers, and fleet logistics executives."
    },
    {
        "id": "usr_fictional_18",
        "full_name": "Nadia Belkacem",
        "email": "nadia.belkacem@example.com",
        "phone": "+1 555-0118",
        "headline": "Managing Partner at Sahara Renewable Ventures | Energy Infrastructure",
        "city": "Dubai",
        "state": "Dubai",
        "country": "United Arab Emirates",
        "chapter_id": "ch_dubai",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "",
        "job_title": "Managing Partner",
        "company": "Sahara Renewable Ventures",
        "university": "Harvard Kennedy School",
        "industry": "Energy & Infrastructure",
        "interests": ["Desert Trekking", "Calligraphy", "Falcon Breeding"],
        "expertise": ["MENA Renewable Finance", "Sovereign PPP Contracts", "Clean Hydrogen"],
        "offers": "Middle Eastern infrastructure concession contacts and bilateral government relations.",
        "focus": "2GW solar and green ammonia export projects in North Africa.",
        "explore_industries": ["Hydrogen Infrastructure", "Clean Tech"],
        "looking_to_connect": "Sovereign fund delegates, industrial hydrogen offtakers, and clean power executives."
    },
    {
        "id": "usr_fictional_19",
        "full_name": "Benjamin Hayes",
        "email": "benjamin.hayes@example.com",
        "phone": "+1 555-0119",
        "headline": "Senior Vice President of Global Strategy at BioHealth Alliance",
        "city": "London",
        "state": "Greater London",
        "country": "United Kingdom",
        "chapter_id": "ch_london",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "through_team",
        "zoom_link": "",
        "job_title": "SVP of Global Strategy",
        "company": "BioHealth Alliance",
        "university": "University of Oxford",
        "industry": "Healthcare & Biotech",
        "interests": ["Cricket", "Fly Fishing in Scotland", "Modern Architecture"],
        "expertise": ["Global Pharma Commercialization", "Rare Disease Licensing", "Market Access"],
        "offers": "Strategic market access counsel in the UK and European healthcare markets.",
        "focus": "Establishing rapid licensing pathways for breakthrough pediatric therapies.",
        "explore_industries": ["Rare Diseases", "Pharma Licensing"],
        "looking_to_connect": "Pharma heads of BD, biotech founders with novel therapies, and healthcare economists."
    },
    {
        "id": "usr_fictional_20",
        "full_name": "Maya Lin",
        "email": "maya.lin@example.com",
        "phone": "+1 555-0120",
        "headline": "Founder & Chief Creative Officer at Atelier Nova | Architectural Studio",
        "city": "New York",
        "state": "New York",
        "country": "United States",
        "chapter_id": "ch_newyork",
        "role": "MEMBER",
        "avatar_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80",
        "contact_preference": "direct_contact",
        "zoom_link": "https://zoom.us/my/mayalin",
        "job_title": "Founder & CCO",
        "company": "Atelier Nova",
        "university": "Cornell University",
        "industry": "Real Estate",
        "interests": ["Sculpture", "Japanese Joinery", "Ceramic Glazes"],
        "expertise": ["Biophilic Architecture", "Luxury Heritage Adaptive Reuse", "Sustainable Materials"],
        "offers": "Master planning consultations for private estates, retreats, and cultural pavilions.",
        "focus": "Designing carbon-negative private residences in the Hudson Valley and Maine.",
        "explore_industries": ["Sustainable Architecture", "Adaptive Reuse"],
        "looking_to_connect": "Private estate owners, sustainable building technologists, and cultural institutions."
    }
]

PRESERVED_USER_IDS = {'usr_elena', 'usr_muwksc1i', 'usr_alexandra', 'usr_julia'}

def seed_database(db_path_str: str):
    db_path = Path(db_path_str)
    if not db_path.exists():
        print(f"[-] DB {db_path} does not exist, skipping.")
        return

    print(f"\n==========================================")
    print(f"[*] Processing {db_path}...")
    
    # 1. Back up database
    backup_path = Path("backups") / f"{db_path.name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.seed.bak"
    backup_path.parent.mkdir(exist_ok=True, parents=True)
    shutil.copy2(db_path, backup_path)
    print(f"[+] Backup created at {backup_path}")

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    # Ensure schema has needed columns & tables
    cur.execute("PRAGMA table_info(users)")
    user_cols = [c[1] for c in cur.fetchall()]
    if 'zoom_link' not in user_cols:
        cur.execute("ALTER TABLE users ADD COLUMN zoom_link TEXT DEFAULT NULL")
    if 'is_test' not in user_cols:
        cur.execute("ALTER TABLE users ADD COLUMN is_test BOOLEAN DEFAULT 0")

    cur.execute('''
    CREATE TABLE IF NOT EXISTS member_connections (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(requester_id, recipient_id)
    )
    ''')

    # 2. Identify and remove test accounts except PRESERVED_USER_IDS
    cur.execute("SELECT id, email, full_name FROM users WHERE id NOT IN ('usr_elena', 'usr_muwksc1i', 'usr_alexandra', 'usr_julia')")
    users_to_delete = cur.fetchall()
    print(f"[*] Found {len(users_to_delete)} existing non-preserved users to clean up:")
    for uid, email, name in users_to_delete:
        print(f"    - Deleting: {uid} ({name}, {email})")
        cur.execute("DELETE FROM questionnaire_answers WHERE user_id = ?", (uid,))
        cur.execute("DELETE FROM taxonomies WHERE user_id = ?", (uid,))
        cur.execute("DELETE FROM travel_plans WHERE user_id = ?", (uid,))
        cur.execute("DELETE FROM member_connections WHERE requester_id = ? OR recipient_id = ?", (uid, uid))
        try:
            cur.execute("DELETE FROM audit_logs WHERE actor_id = ? OR target_member_id = ?", (uid, uid))
        except sqlite3.OperationalError:
            pass
        cur.execute("DELETE FROM users WHERE id = ?", (uid,))

    # Also clean test invitation tokens that belonged to automated tests
    cur.execute("""
    DELETE FROM invitation_tokens 
    WHERE email LIKE '%@sovereign-tech.io' 
       OR email LIKE '%@venture.ch' 
       OR email LIKE '%@deeptechfund.io'
       OR email LIKE '%@spammer.org'
       OR email LIKE 'test.%'
       OR email LIKE 'candidate_%'
    """)
    print(f"[+] Cleaned automated test invitation tokens.")

    # 3. Seed 20 fictional members
    print(f"[*] Seeding {len(FICTIONAL_MEMBERS)} fictional members...")
    for m in FICTIONAL_MEMBERS:
        # Insert or replace user
        cur.execute('''
        INSERT OR REPLACE INTO users (
            id, email, full_name, headline, city, state, country, 
            chapter_id, role, avatar_url, contact_preference, 
            zoom_link, phone, is_admitted, is_complete, is_test
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)
        ''', (
            m["id"], m["email"], m["full_name"], m["headline"], m["city"], m["state"], m["country"],
            m["chapter_id"], m["role"], m["avatar_url"], m["contact_preference"],
            m["zoom_link"], m["phone"]
        ))

        # Insert canonical questionnaire answers for Section A, B, C, D, E
        answers = [
            (1, m["full_name"], "shared"),
            (2, f"{m['city']}, {m['country']}", "shared"),
            (3, f"{m['city']}", "shared"),
            (4, f"{m['country']}", "shared"),
            (5, "English", "shared"),
            (6, json.dumps({
                "methods": ["WhatsApp" if m["phone"] else None, "Email", "Zoom" if m["zoom_link"] else None],
                "zoom_link": m["zoom_link"],
                "preference": m["contact_preference"]
            }), "shared"),
            (7, m["job_title"], "shared"),
            (25, m["job_title"], "shared"),
            (26, m["company"], "shared"),
            (27, m["university"], "shared"),
            (8, m["industry"], "shared"),
            (10, m["headline"], "shared"),
            (12, f"{m['full_name']} is an experienced leader focused on {m['industry']}. Educated at {m['university']}.", "shared"),
            (13, f"https://linkedin.com/in/{m['id']}", "shared"),
            (14, json.dumps({"tags": m["expertise"][:2], "note": m["focus"]}), "shared"),
            (15, "; ".join(m["explore_industries"]), "shared"),
            (16, "United States, United Kingdom, UAE", "shared"),
            (17, json.dumps({"tags": [m["industry"]], "note": m["looking_to_connect"]}), "shared"),
            (18, json.dumps({"tags": m["expertise"], "note": m["offers"]}), "shared"), # Q18 MANDATORY!
            (19, "yes" if m["contact_preference"] == "direct_contact" else "team", "shared"),
            (20, "36–45", "private"),
            (21, "Prefer not to say", "private"),
            (22, ", ".join(m["interests"]), "shared"),
            (23, "Fictional test profile generated for system testing.", "private"),
            (24, f"{m['chapter_id']} — Active attendee", "shared")
        ]

        PROMPTS = {
            1: "Full name",
            2: "Location where you reside",
            3: "Other locations where you spend real time each year",
            4: "Locations where you have a base, work, or run something",
            5: "Languages you do business in",
            6: "Best way to reach you",
            7: "Professional role",
            25: "Job title",
            26: "Company / Organization",
            27: "Institution / University",
            8: "Industry & Sector",
            10: "What do you do, in one sentence?",
            12: "Your background",
            13: "LinkedIn or website",
            14: "What are you focused on right now?",
            15: "Which industries would you like to explore?",
            16: "Where would you like to build connections?",
            17: "Who would you like to connect with right now?",
            18: "What can other members turn to you for?",
            19: "Are you open to direct contact from other members?",
            20: "Age bracket",
            21: "Family situation, if you want to say",
            22: "What are your interests outside work?",
            23: "Is there anything else you’d like our team to know?",
            24: "Your home chapter, and how would you like to be involved?"
        }

        for q_id, val, vis in answers:
            prompt_str = PROMPTS.get(q_id, f"Question {q_id}")
            cur.execute('''
            INSERT OR REPLACE INTO questionnaire_answers (
                user_id, question_id, prompt, answer_state, value_text, visibility, updated_at
            ) VALUES (?, ?, ?, 'answered', ?, ?, CURRENT_TIMESTAMP)
            ''', (m["id"], q_id, prompt_str, val, vis))

        # Insert taxonomies for search & matching
        cur.execute("DELETE FROM taxonomies WHERE user_id = ?", (m["id"],))
        
        # Industries
        cur.execute("INSERT INTO taxonomies (user_id, category, slug, label) VALUES (?, 'industries', ?, ?)",
                    (m["id"], m["industry"].lower().replace(' ', '-'), m["industry"]))
        # Expertise
        for exp in m["expertise"]:
            cur.execute("INSERT INTO taxonomies (user_id, category, slug, label) VALUES (?, 'expertise', ?, ?)",
                        (m["id"], exp.lower().replace(' ', '-'), exp))
        # Interests
        for intr in m["interests"]:
            cur.execute("INSERT INTO taxonomies (user_id, category, slug, label) VALUES (?, 'interests', ?, ?)",
                        (m["id"], intr.lower().replace(' ', '-'), intr))
        # Offers
        cur.execute("INSERT INTO taxonomies (user_id, category, slug, label) VALUES (?, 'offers', ?, ?)",
                    (m["id"], "mentorship-introductions", m["offers"][:40]))
        # Institutions (University)
        cur.execute("INSERT INTO taxonomies (user_id, category, slug, label) VALUES (?, 'institutions', ?, ?)",
                    (m["id"], m["university"].lower().replace(' ', '-'), m["university"]))

    # Seed initial connection examples for Elena Alexeeva (usr_muwksc1i) so requests & messaging can be tested right away!
    # 1. Received pending request from Dr. Marcus Vance
    cur.execute('''
    INSERT OR REPLACE INTO member_connections (id, requester_id, recipient_id, status, note)
    VALUES ('conn_test_01', 'usr_fictional_01', 'usr_muwksc1i', 'pending', 'Hello Elena, would love to connect regarding data infrastructure and AI.')
    ''')
    # 2. Received pending request from Camilla Rossi
    cur.execute('''
    INSERT OR REPLACE INTO member_connections (id, requester_id, recipient_id, status, note)
    VALUES ('conn_test_02', 'usr_fictional_04', 'usr_muwksc1i', 'pending', 'Hi Elena, let us connect around luxury real estate tech.')
    ''')
    # 3. Already accepted connection with Sophia Sterling
    cur.execute('''
    INSERT OR REPLACE INTO member_connections (id, requester_id, recipient_id, status, note)
    VALUES ('conn_test_03', 'usr_muwksc1i', 'usr_fictional_02', 'accepted', 'Connected at Miami summit.')
    ''')

    conn.commit()
    conn.close()
    print(f"[✓] Completed seeding {db_path.name} with 20 fictional profiles.")

if __name__ == '__main__':
    seed_database("ozara.db")
    seed_database("sila.db")
    print("\n[✓] All databases successfully updated and verified.")
