# Findings & Research Log: ÖZARA

## 1. Project Overview & Discovery Insights
- **Platform Name**: ÖZARA
- **Vision**: Private, invitation-only community platform enabling verified members to connect, find relevant expertise, schedule calls, join targeted events, and view curated real estate investments without requiring founders (Alexandra & Julia) to coordinate every interaction manually.
- **Founders**: Alexandra and Julia (Super-Admin / Founder role with exclusive access to permanently private fields).

## 2. Core Pillars & Functional Requirements
### A. Networking & Matchmaking
- Searchable verified member profiles using canonical IDs and structured multi-select taxonomies (roles, industries, expertise, offers, needs, interests, institutions, cities, countries) alongside optional explanatory context text.
- **Explainable Recommendations**: Matching algorithm based on Needs ↔ Offers/Expertise, enhanced by shared industry, market knowledge, location, interests, and affiliations. Plain-language rationales provided for every recommendation.
- **Contact Preference Enforcement**:
  - `direct_contact`: Members can reach out and request calls directly.
  - `through_team`: Requests route to the founder/team queue.
  - `unavailable`: Profile indicates temporary unavailability.
- **"Ask the Team" Intro Queue**: Fallback mechanism when self-service search yields no match; automatically creates a tracked resolution ticket for admins.
- **Call Scheduling**: Direct proposal, acceptance, rescheduling, and cancellation with explicit timezone conversion and manual video link entry (Zoom, Google Meet, Telegram, etc.).

### B. Events
- Admin-curated events with an interactive calendar and list views.
- Member RSVP / registration.
- **Targeted Invitation Engine**:
  - Filter criteria: shared profile fields, chapters/locations, visible travel schedules, attendance history.
  - Preview recipients prior to sending, prevent duplicate invitations, and respect user notification preferences.

### C. Curated Investments (Real Estate)
- Admin-managed property listings.
- Member actions: "Request Information / Brochure" and "Request a Call".
- Strict regulatory boundaries: Zero automated financial advice, zero fund transfers, zero transaction commission calculations.

## 3. Privacy, Security & Data Invariants
- **Question 23 Permanent Lock**:
  - Question 23 has no sharing toggle and is permanently private.
  - Accessible ONLY to Alexandra and Julia.
  - Never appears in member searches, public profiles, API payloads, or recommendation algorithms.
  - Log every view to Question 23 and any private questionnaire answers in an immutable audit log.
- **Profile Completeness (Question 18)**:
  - All profile questions are optional except Question 18, which is the sole requirement to mark a profile complete.
- **Answer State Model**:
  - Every questionnaire answer explicitly tracks: `unanswered`, `answered`, or `deliberately_skipped`.
  - Every answer (except Q23 which is always private) maintains a visibility setting: `shared` (visible to verified members) or `private`.
- **Prohibited Data Policy**:
  - Strictly DO NOT collect: Date of birth, government ID numbers, bank account numbers, net worth, income, financial institution account details, health info, or real-time GPS location.
- **Travel Plans**:
  - Voluntarily declared, city-level only, time-bounded (`start_date` to `end_date`), with visibility toggles.
  - Automatically hidden and excluded from discovery upon passing `end_date`.
- **Two-Person Approval Rule**:
  - Any bulk export of member data requires approval from two authorized administrators (Alexandra and Julia).
- **Content Moderation & Prohibited Terms**:
  - Real-time client-side guidance and backend validation against prohibited terms (specific fundraising guarantees, promised ROI, company valuations, minimum check sizes).
  - Profile reporting and pre-publication review for initial cohort.

## 4. Technical Architecture Research & References
- **Matching & Explainability Pattern**:
  - Inspired by hybrid recommender systems (e.g., XRec / Knowledge Graphs), recommendation output pairs structured scoring with a dynamic explanation template:
    *Example*: `"Recommended because Alex offers [Cross-border Logistics] which matches your current need for [Supply Chain Optimization], and both are located in [Dubai]."`
- **Invitation Flow**:
  - Secure cryptographic token generation (`crypto.randomBytes(32)`), time-limited or single-use, mapped to invited email with designated inviter and admitter tracking.
- **Audit Logging**:
  - Dedicated `audit_logs` table tracking `actor_id`, `action`, `resource_type`, `resource_id`, `timestamp`, and `metadata`.
