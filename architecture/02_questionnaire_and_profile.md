# SOP 02: Questionnaire, Profiles & Travel Lifecycle

## 1. Goal & Scope
Defines the intake workflow, answer states, completion criteria, taxonomy structures, and travel plan expiration logic.

## 2. Intake Flow & Answer States
- The intake form is a single-page, scrollable questionnaire divided into thematic clusters (Identity, Professional Background, Core Needs & Offers, Perspectives, Travel).
- **Answer States**:
  - `unanswered`: The default initial state.
  - `answered`: User has entered a valid response.
  - `deliberately_skipped`: User has explicitly chosen to bypass the question.
- **Visibility Settings**:
  - `shared`: Visible to all verified community members.
  - `private`: Visible only to Alexandra and Julia (Subject to SOP 01 audit logging).
  - *Exception*: Question 23 is permanently locked to `private`.

## 3. Profile Completion: The Question 18 Mandate
- **Rule**: A member's profile is formally flagged as `is_complete: true` if and only if **Question 18** has been answered (`answer_state == 'answered'`).
- All other 29 questions are optional and do not block complete status.
- Profiles that have not completed Question 18 can browse but show a prominent completion prompt banner.

## 4. Structured Taxonomies & Context Notes
- Taxonomies utilize canonical slugs with human-readable labels:
  - `roles`: e.g., `founder`, `investor`, `operator`, `advisor`, `executive`
  - `industries`: e.g., `fintech`, `ai_enterprise`, `real_estate`, `logistics`, `biotech`
  - `expertise`: e.g., `uae_licensing`, `b2b_sales`, `cross_border_payments`, `m_and_a`
  - `offers`: Specific capabilities a member provides to peers
  - `needs`: Specific resources or introductions a member is currently seeking
  - `interests`: Personal and intellectual pursuits
  - `institutions`: Universities, accelerators, and past organizations
- **Context Notes**: Each category supports an optional free-text annotation (e.g., "Fintech: specifically B2B treasury infrastructure").

## 5. Travel Plan Bounding & Automatic Expiration
- Members can declare upcoming travel destinations.
- Fields: `city`, `country`, `start_date`, `end_date`, `visibility`.
- **Expiration Logic**:
  - Discovery and recommendation queries filter travel plans where `end_date >= CURRENT_DATE`.
  - Trips where `end_date < CURRENT_DATE` are automatically excluded from all searches and targeted event invitations.

## 6. Professional Networking Profile Architecture (Default View & Mapping)
- **Design Philosophy**: The default profile view is a polished, scannable professional networking profile (not a list of numbered questions or database rows). It empowers members to grasp in 10–15 seconds: Who this person is, What they do, What they are working on, Who they want to meet, What they can offer, and What they have in common.
- **Visual Section Mapping from Canonical Questionnaire**:
  1. **Profile Header**:
     - Large circular avatar (`avatar_url`), full name, verified badge.
     - Current role and organization: Derived from Q25 (Job title) + Q26 (Company), or `headline`.
     - Location & Base: City and country (`city`, `country` or Q2).
     - Home Chapter: Q24 or `chapter_name` (Boston, Miami, Silicon Valley, New York, etc.).
     - Clickable LinkedIn / Website (Q13) with normalized URL.
     - Contextual actions: "Edit Profile" (for profile owner) or "Schedule Call" / "Ask Intro" / "Message" (for peers).
  2. **About Me**:
     - Natural narrative introduction combining Q10 ("What do you do, in one sentence?") and Q12 ("Your background").
     - Never fabricated; omitted for peers if empty; subtle completion prompt for owner.
  3. **Professional Background**:
     - Current role & company (Q25 & Q26), industry & sector (Q8 & `taxonomies.industries`), role function (Q7), institution/university (Q27), and core capabilities/expertise.
  4. **Current Focus**:
     - Active priorities & strategic milestones (Q14 tags & specific note).
     - Exploratory sectors & industries (Q15 tags).
  5. **Let's Connect (High Prominence)**:
     - People the member wants to meet right now (Q17 tags & specific note).
     - Target countries & regions for connections (Q16).
  6. **What I Can Offer (High Prominence)**:
     - The member's selected foundational contributions from Question 18 (advisory, strategic intros, market access, operational experience, services). Only items selected by the member are displayed.
  7. **Locations & Community**:
     - Primary city, other regular cities (Q3), active country bases (Q4), business languages (Q5), home chapter & involvement tier (Q24), active travel plans (`travel_plans`).
  8. **Beyond Work**:
     - Personal interests, sports, hobbies, and activities (Q22 tags: sports, outdoors, arts, travel, learning, community).
  9. **Contact & Connections**:
     - Preferred contact method (Q6 & `contact_preference`), openness to direct outreach (Q19).
- **Editing & Synchronization**:
  - The default view is read-only.
  - "Edit Profile" toggles into the Questionnaire Editor organized into thematic sections (A: Where you are, B: What you do, C: What you are working on now, D: Personal context, E: Chapter and events).
  - Preserves all input controls, validation, autosave, and inline visibility controls.
  - Toggling back to profile view immediately reflects the latest saved answers.
- **Strict Privacy Enforcement**:
  - For peer members: Any question marked `private`, skipped, or redacted is completely hidden and omitted from all cards.
  - Question 23 (confidential founder note) is permanently private and never displayed on public profiles.
  - Age bracket (Q20) and Family situation (Q21) default to private and are hidden unless explicitly marked shared.

