# ÖZARA Membership Intake Form Specification

This document provides the complete, authoritative specification for all intake forms in ÖZARA:
1. **Initial Access Request Form** (Step 3: Application before admin review)
2. **Canonical 24 Profile Questions** (Step 8: Member onboarding questionnaire)

---

## Part 1: Initial Access Request Form (Application)

When a prospective candidate does not already have an invitation code, they complete a short application form reviewed by ÖZARA leadership (Alexandra Hill, Julia Shchukina, Elena Ermolov).

| Field Name | Input Type | Required? | Visibility | Options / Dropdown | Guidance / Helper Text |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Full Name** | Single-line Text | Yes | Admin Only | Free text | Candidate's legal or professional full name |
| **Email Address** | Email Input | Yes | Admin Only | Free text (validated email format) | Business or primary email; bound 1:1 to invitation upon approval |
| **Professional Role / Headline** | Dropdown / Single-line Text | Optional | Admin Only | Standalone roles list (or custom text) | e.g., *Founder & CEO*, *Managing Director*, *Partner* |
| **Country** | Dropdown (Searchable) | Optional | Admin Only | Standardized Country list (18 primary countries) | Residential or primary operating country |
| **City** | Dropdown / Text | Optional | Admin Only | Cities dynamically matched to selected country | Primary residential city |
| **Industry & Sector** | Dropdown (Searchable) | Optional | Admin Only | 23 Standardized Industries list | Primary operating industry |
| **LinkedIn URL or Background** | Single-line URL / Text | Optional | Admin Only | URL / Free text | LinkedIn profile link or a 1-sentence background summary |
| **What brings you to ÖZARA? (Notes)** | Multi-line Text Area | Optional | Admin Only | Free text | Goals, mutual connections, or community interests |

---

## Part 2: The 24 Canonical Profile Questions (Onboarding Intake)

After invitation code verification (Step 6) and SMS phone verification (Step 7), new members complete the membership profile questionnaire (Step 8).

### Fundamental Invariants:
1. **The Question 18 Mandate**: Question 18 (*"What can you offer other members?"*) is the **only mandatory question** required to mark a profile complete (`is_complete = 1`). A directory of askers without offers fails; peer offers are foundational.
2. **Question 23 Permanent Lock**: Question 23 (*Confidential note to Alexandra & Julia*) is permanently private (`is_confidential = true`). No sharing toggle exists; it is never exposed to search, public profiles, API payloads, or recommendations.
3. **Inline Visibility Control**: Every question features an inline toggle:
   - **`shared`**: Visible to all verified community members.
   - **`private`**: Visible only to the member and administrators (Alexandra and Julia).
4. **All Other Questions Skippable**: Questions can be saved or skipped (recorded as `skipped`, never `null`). Incomplete questions can be returned to at any time.
5. **Content Moderation / Broker-Dealer Rule**: Free-text guidance line: *"Members describe what they do and what they are interested in. Members do not post specific offerings, amounts being raised, valuations, terms, returns, or minimum investments."* Text containing financial solicitation keywords is automatically held for review.

---

### Section A: Where you are
*Primary geographical footprint and communication channels. Default visibility: `shared`.*

#### Question 1: Full name
- **Type**: Single-line text
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable (Pre-filled from account registration)
- **Dropdown / Selection List**: Free text

#### Question 2: Location where you reside
- **Type**: Location selector (Country & City dropdowns with fallback free text)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  - **Country**: Dropdown of 18 core countries (see Reference Taxonomies below)
  - **City**: Dropdown of major cities for the selected country (e.g., Dubai, Abu Dhabi, London, New York, San Francisco, Seattle, Zurich, Geneva, etc.) + custom city input

#### Question 3: Other locations where you spend real time each year
- **Type**: `city_multi` (Multiselect tags + custom city entry)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  - Amsterdam, Astana, Berlin, Boston, Chicago, Dubai, Geneva, Hong Kong, Limassol, London, Los Angeles, Miami, Monaco, New York, Paris, San Francisco, Seattle, Singapore, Sydney, Tokyo, Toronto, Zurich (+ custom city input)

#### Question 4: Locations where you have a base, work, or run something
- **Type**: `country_multi` (Multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  - Australia, Canada, Cyprus, France, Germany, Hong Kong, Italy, Japan, Kazakhstan, Monaco, Netherlands, Saudi Arabia, Singapore, Spain, Switzerland, United Arab Emirates, United Kingdom, United States (+ custom country input)

#### Question 5: Languages you do business in
- **Type**: `multi` (Multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  1. English
  2. Arabic
  3. Russian
  4. French
  5. German
  6. Spanish
  7. Mandarin
  8. Kazakh
  *(+ custom entry)*

#### Question 6: Best way to reach you
- **Type**: `multi` (Multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  1. WhatsApp
  2. Email
  3. Zoom
  4. In app
  5. Telegram
  6. Through the team

---

### Section B: What you do
*Professional background and identity (The LinkedIn layer). Default visibility: `shared`.*

#### Question 7: Professional role
- **Type**: `multi` (Multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List (22 Standardized Roles)**:
  1. Founder / Co-founder
  2. CEO / Executive / Managing Director
  3. Business Owner
  4. Partner / General Partner
  5. Investor / Fund Manager / Family Office Principal
  6. Investor Relations Professional
  7. Software Engineering
  8. AI & Machine Learning
  9. Data & Analytics
  10. Product Management
  11. Design & Creative Professional
  12. IT & Infrastructure
  13. Professor / Academic / Researcher
  14. Doctor / Healthcare Professional
  15. Lawyer / Legal Professional
  16. Finance / Accounting Professional
  17. Real Estate Professional / Developer
  18. Consultant / Advisor
  19. Marketing / Sales / Business Development Professional
  20. Nonprofit / Public Sector Professional
  21. Student / Early-career Professional
  22. Other — please specify

#### Question 25: Job title
- **Type**: Single-line text
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Free text (e.g., *Managing Partner*, *Chief Investment Officer*, *Head of Product*)

#### Question 26: Company / Organization
- **Type**: Single-line text
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Free text (e.g., *ÖZARA Ventures*, *Alphabet*, *Sequioa*)

#### Question 27: Institution / University
- **Type**: Single-line text
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Free text (e.g., *Stanford University*, *Oxford*, *INSEAD*, *Harvard Business School*)

#### Question 8: Industry & Sector
- **Type**: `multi` (Multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List (23 Standardized Industries)**:
  1. Technology & Software
  2. Artificial Intelligence & Data
  3. Robotics, Hardware & Deep Tech
  4. Finance, Banking & FinTech
  5. Venture Capital & Private Equity
  6. Wealth Management & Family Offices
  7. Real Estate & Construction
  8. Healthcare & Medicine
  9. Biotechnology & Life Sciences
  10. Education & Academia
  11. Research & Development
  12. Law & Legal Services
  13. Consulting & Professional Services
  14. Energy, Climate & Sustainability
  15. Manufacturing & Industrial
  16. Retail, E-commerce & Consumer Goods
  17. Media, Entertainment & Creative Industries
  18. Marketing & Advertising
  19. Travel, Hospitality & Events
  20. Transportation & Logistics
  21. Agriculture & Food
  22. Government & Public Policy
  23. Nonprofit & Social Impact
  24. Other — please specify

#### Question 10: What do you do, in one sentence?
- **Type**: Single-line text (`char_limit: 200`)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Helper text**: *"Describe your work in your own words."*
- **Placeholder**: *"e.g. I help founders turn AI research into practical products."*
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Free text

#### Question 12: Your background
- **Type**: Multi-line long text (`char_limit: 600`)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Helper text**: *"Share previous companies, education, research, or projects you’re proud of."*
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Free text

#### Question 13: LinkedIn or website
- **Type**: URL (`url`)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Placeholder**: *"linkedin.com/in/yourname or your website"*
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Free text (URL format validated)

---

### Section C: What you are working on now
*Active priorities, exploratory sectors, target connections, and foundational offers. Default visibility: `shared`.*

#### Question 14: What are you focused on right now?
- **Type**: `multi_with_note` (Multiselect tags + optional free-text context note)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List (15 Focus Priorities)**:
  1. Building or launching a project
  2. Growing a business
  3. Finding clients
  4. Developing partnerships
  5. Raising funding
  6. Exploring investment opportunities
  7. Buying or selling a business
  8. Hiring or building a team
  9. Exploring career opportunities
  10. Expanding into new markets
  11. Research & innovation
  12. Learning & professional development
  13. Finding mentors or expert guidance
  14. Growing my professional network
  15. Other — please specify
- **Optional Context Note**: *"Add any specific context about your current priorities..."*

#### Question 15: Which industries would you like to explore?
- **Type**: `multi` (Multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**: Same 23 Standardized Industries list as Question 8

#### Question 16: Where would you like to build connections?
- **Type**: `country_multi` (Multiselect tags, maximum 5 selections)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Helper text**: *"Choose up to five countries, or select open anywhere."*
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  1. Open to connections anywhere
  2. Australia
  3. Canada
  4. Cyprus
  5. France
  6. Germany
  7. Hong Kong
  8. Italy
  9. Japan
  10. Kazakhstan
  11. Monaco
  12. Netherlands
  13. Saudi Arabia
  14. Singapore
  15. Spain
  16. Switzerland
  17. United Arab Emirates
  18. United Kingdom
  19. United States

#### Question 17: Who would you like to connect with right now?
- **Type**: `multi_with_note` (Multiselect tags up to 5 selections + optional free-text note, `char_limit: 200`)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Helper text**: *"Choose up to five types of connections."*
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List (18 Connection Types)**:
  1. Founders & Business Owners
  2. Executives & Business Leaders
  3. Investors
  4. Technology & Product Professionals
  5. Professors & Researchers
  6. Healthcare Professionals
  7. Legal, Tax & Finance Professionals
  8. Real Estate Professionals
  9. Consultants & Industry Experts
  10. Mentors
  11. Peers in My Profession
  12. Potential Co-founders & Collaborators
  13. Potential Business Partners
  14. Potential Clients
  15. Talent & Hiring Connections
  16. Experts in a Specific Country or Market
  17. Other — please specify
  18. Open to Meeting Different People
- **Optional Context Note**: *"Add specific context about who you would like to meet..."*

#### Question 18: What can other members turn to you for?
- **Type**: `multi_with_note` (Multiselect tags + optional free-text note)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Helper text**: *"Choose the areas where you can share experience, help, or introductions."*
- **Requirement**: **STRICTLY REQUIRED** (`is_required: true`). Profile completion is gated on this question.
- **Dropdown / Selection List (18 Core Offer Categories)**:
  1. AI & Machine Learning
  2. Software Engineering
  3. Data & Analytics
  4. Product & Design
  5. Research & Academic Collaboration
  6. Education & Mentorship
  7. Healthcare & Medicine
  8. Legal Expertise
  9. Tax & Accounting
  10. Fundraising & Investor Introductions
  11. Investment & Due Diligence
  12. Real Estate
  13. Business Strategy & Operations
  14. Hiring & Team Building
  15. Marketing & Sales
  16. Partnerships & Introductions
  17. International Expansion
  18. Other — please specify
- **Optional Context Note**: *"Add specific details about what you can offer..."*

#### Question 19: Are you open to direct contact from other members?
- **Type**: `single` (Single-select radio buttons)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  1. Yes
  2. Through the team first
  3. Not right now

---

### Section D: Personal context
*Personal background and confidential notes. Default visibility: `private`.*

#### Question 20: Age bracket
- **Type**: `bracket` (Single-select radio buttons)
- **Default Visibility**: **`private`** (can be toggled to `shared`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  1. Under 35
  2. 35–44
  3. 45–54
  4. 55–64
  5. 65+

#### Question 21: Family situation, if you want to say
- **Type**: `single` (Single-select radio buttons)
- **Default Visibility**: **`private`** (can be toggled to `shared`)
- **Requirement**: Optional / Skippable
- **Dropdown / Selection List**:
  1. Partnered
  2. Single
  3. Partnered with children
  4. Children, grown

#### Question 22: What are your interests outside work?
- **Type**: `multi` (Categorized multiselect tags)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Helper text**: *"Select personal interests, sports, and creative pursuits outside of work."*
- **Requirement**: Optional / Skippable
- **Categorized Selection Groups (46 Standardized Interests)**:
  - **Sports & fitness**:
    - Triathlon, Running, Cycling, Swimming, Tennis, Padel, Pickleball, Golf, Yoga, Pilates, Strength training
  - **Outdoors & adventure**:
    - Hiking, Trail running, Skiing, Snowboarding, Climbing, Sailing, Diving, Surfing, Camping
  - **Arts & culture**:
    - Contemporary art, Photography, Painting, Architecture, Theatre, Opera, Classical music, Live music, Film
  - **Food & travel**:
    - Cooking, Baking, Wine tasting, Coffee, Food discovery, Cultural travel, Adventure travel
  - **Learning & leisure**:
    - Reading, Book clubs, Writing, Learning languages, Chess, Board games, Gardening
  - **Community**:
    - Volunteering, Mentoring, Animal welfare, Environmental causes

#### Question 23: Is there anything else you’d like our team to know?
- **Type**: Multi-line long text (`char_limit: 1000`)
- **Default Visibility**: **`private` (PERMANENTLY LOCKED)**
- **Confidential Flag**: `is_confidential: true`
- **Helper text**: *"Optional. Share any context or preferences you’d rather leave off your member profile."*
- **Placeholder**: *"Share any context or preferences you’d rather leave off your member profile."*
- **Requirement**: Optional / Skippable
- **Invariants**:
  - Permanently private; **NO sharing toggle exists**.
  - Visible **exclusively to Alexandra Hill and Julia Shchukina**.
  - Strictly excluded from member directory search, profile drawers, API payloads, and recommendation engines.
- **Dropdown / Selection List**: Free text

---

### Section E: Chapter and events
*Community affiliation and active participation tier. Default visibility: `shared`.*

#### Question 24: Your home chapter, and how would you like to be involved?
- **Type**: Two-part structured selector (`single` for Chapter + `single` for Involvement role)
- **Default Visibility**: `shared` (toggleable to `private`)
- **Requirement**: Optional / Skippable
- **Home Chapter Selection**:
  1. Boston
  2. Miami
  3. Silicon Valley
  4. New York
- **Involvement Role Selection**:
  1. Happy to host
  2. Would help organize
  3. Attend only

---

## Part 3: Summary Matrix of Canonical Questions

| Q# | Section | Prompt | Type | Default Visibility | Required? | Options / Dropdown Count |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| **1** | A. Where you are | Full name | text | Shared | No | Free text (prefilled) |
| **2** | A. Where you are | Location where you reside | text | Shared | No | Country + City dropdowns / text |
| **3** | A. Where you are | Other locations where you spend real time each year | city_multi | Shared | No | 22 Standardized Cities + Custom |
| **4** | A. Where you are | Locations where you have a base, work, or run something | country_multi | Shared | No | 18 Standardized Countries + Custom |
| **5** | A. Where you are | Languages you do business in | multi | Shared | No | 8 Languages + Custom |
| **6** | A. Where you are | Best way to reach you | multi | Shared | No | 6 Contact Channels |
| **7** | B. What you do | Professional role | multi | Shared | No | 22 Standardized Roles |
| **25** | B. What you do | Job title | text | Shared | No | Free text |
| **26** | B. What you do | Company / Organization | text | Shared | No | Free text |
| **27** | B. What you do | Institution / University | text | Shared | No | Free text |
| **8** | B. What you do | Industry & Sector | multi | Shared | No | 23 Standardized Industries |
| **10** | B. What you do | What do you do, in one sentence? | text (200c) | Shared | No | Free text |
| **12** | B. What you do | Your background | long_text (600c) | Shared | No | Free text |
| **13** | B. What you do | LinkedIn or website | url | Shared | No | Valid URL format |
| **14** | C. What you are working on | What are you focused on right now? | multi_with_note | Shared | No | 15 Focus Priorities + Note |
| **15** | C. What you are working on | Which industries would you like to explore? | multi | Shared | No | 23 Standardized Industries |
| **16** | C. What you are working on | Where would you like to build connections? | country_multi | Shared | No | 19 Country options (max 5) |
| **17** | C. What you are working on | Who would you like to connect with right now? | multi_with_note | Shared | No | 18 Connection Types + Note |
| **18** | C. What you are working on | What can other members turn to you for? | multi_with_note | Shared | **YES** | 18 Core Offers + Note |
| **19** | C. What you are working on | Are you open to direct contact from other members? | single | Shared | No | 3 Options (Yes / Team / Not now) |
| **20** | D. Personal context | Age bracket | bracket | **Private** | No | 5 Age Brackets |
| **21** | D. Personal context | Family situation, if you want to say | single | **Private** | No | 4 Options |
| **22** | D. Personal context | What are your interests outside work? | multi | Shared | No | 46 Interests across 6 categories |
| **23** | D. Personal context | Is there anything else you’d like our team to know? | long_text (1000c) | **Locked Private** | No | Free text (Founders only) |
| **24** | E. Chapter and events | Your home chapter, and how would you like to be involved? | single | Shared | No | 4 Chapters × 3 Involvement tiers |
