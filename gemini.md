# Project Constitution & Law (gemini.md)

## 1. Architectural Invariants
1. **3-Layer Architecture**:
   - **Layer 1: Architecture (`architecture/`)**: Technical SOPs written in Markdown. Defines goals, inputs, tool logic, and edge cases. Golden Rule: *If logic changes, update the SOP before updating the code.*
   - **Layer 2: Navigation (Decision Making)**: Reasoning layer. Routes data between SOPs and Tools. Never perform complex business logic directly in the prompt; call deterministic execution tools in the correct order.
   - **Layer 3: Tools (`tools/`)**: Deterministic, atomic, testable Python scripts. Stored in `tools/`. Environment variables in `.env`. Intermediate files in `.tmp/`.
2. **Deliverables vs. Intermediates**:
   - Local (`.tmp/`): Scraped data, logs, temporary files. Ephemeral.
   - Global (Cloud/Web): Final payload destination (Web application, Database, UI, etc.). Project is complete only when delivered to its final destination.
3. **Self-Annealing (The Repair Loop)**:
   - Analyze: Read stack trace and error message.
   - Patch: Fix script in `tools/`.
   - Test: Verify the fix works.
   - Update Architecture: Record findings and rules in `architecture/` SOP.

## 2. Behavioral Rules
- **Data-First Rule**: Define the JSON Data Schema (Input/Output shapes) here in `gemini.md` before building any tools or code.
- **Execution Halt**: Strictly forbidden from writing scripts in `tools/` until:
  1. Discovery questions are answered.
  2. Data Schema is defined in `gemini.md`.
  3. `task_plan.md` has an approved Blueprint.
- **Privacy & Security Mandates**:
  - **Question 23 Permanent Lock**: No sharing toggle exists; permanently private. Only visible to Alexandra and Julia. Never exposed to search, public profiles, API payloads, or recommendations.
  - **Question 18 Mandate**: Question 18 ("What can you offer other members?") is strictly required to mark a profile complete (`is_complete = 1`). A directory of askers without offers fails; offers are foundational.
  - **The 24 Canonical Profile Questions**: The questionnaire covers exclusively the 24 canonical profile questions grouped into Sections A (Where you are), B (What you do), C (What you are working on now), D (Personal context), and E (Chapter and events). Field types: `text`, `long_text`, `single`, `multi`, `city_multi`, `country_multi`, `bracket`, `url`. Every question is skippable (stores as `skipped`, not null). Inline visibility control (`shared` vs `private`) with specified defaults.
  - **Broker-Dealer & Content Solicitation Rule**:
    - Members describe who they are, where they are, what they are working on, and what kind of people are useful to them right now. The platform does not ask what anyone owns, what they earn, or what they want to invest in.
    - Flat membership dues only. No transaction-connected success fees, finder's fees, or percentages.
    - Free text guidance: A visible line of guidance is displayed under every free text field: *"Members describe what they do and what they are interested in. Members do not post specific offerings, amounts being raised, valuations, terms, returns, or minimum investments."*
    - Automatic keyword flagging on submission holds text containing figures, currency symbols ($/€/£), percentages, or terms: `raising`, `pre-money`, `ticket`, `IRR`, `return`, `valuation`, `minimum investment`.
    - Report button on every member profile card for peer reporting to the community committee.
    - No algorithmic match pushing, no ranking by likely investor fit, and no deal notifications.
  - **Travel & "Who Is Here" Layer**:
    - Device geolocation / real-time GPS tracking is strictly forbidden. Live maps of high-net-worth members create unacceptable personal safety hazards.
    - Self-declared, time-boxed, city-level trips only (city, arrival date, departure date, notes, visibility). Auto-expires at departure date and drops out of search.
    - City Screen consists of 5 dedicated components: (1) Members based here (ranked by Section C overlap with viewer, then alphabetical), (2) Members visiting here in the next 30 days (trip visible), (3) The Chapter (Lead name, photo, bio, direct contact button), (4) Upcoming events in this city, (5) Where the chapter gathers (standing place card with photo & "message the chapter lead to sit down for coffee" action).
    - Chapter leads maintain inboxes/queues inside the app to receive member visit inquiries.
  - **Events Layer**:
    - 6-month calendar horizon minimum.
    - Event types: `trek`, `chapter dinner`, `summit`, `family and children programme`, `online session`. Treks and summits are the same object with longer duration.
    - Filterable by city and type, plus smart "events in cities I am travelling to" filter connected to the Travel Layer.
    - Registration state lives on the member record.
  - **Quarterly Pulse (90 Seconds, 4 Questions)**:
    - 1: What are you focused on right now? (prefilled with Q14, edit in place).
    - 2: Has your situation changed? (checklist: new role, new company, moved city, new market, new chapter, nothing changed; "nothing changed" closes form).
    - 3: What kind of people would be useful to meet in the next 90 days?
    - 4: Where are you travelling in the next 90 days? (city and dates picker, writes straight into travel layer).
  - **Audit Logging**: Every view of private answers must generate an immutable audit log record.
  - **Two-Person Rule**: Bulk exports of member data require affirmative approval from two administrators (Alexandra & Julia).
  - **Prohibited Data Guarantee**: Never collect date of birth, government ID numbers, bank account numbers, net worth, income, financial institution account details, health info, or real-time GPS location.
  - **Travel Plan Expiration**: Travel plans past `end_date` are automatically excluded from discovery.
  - **Content Moderation**: Prohibit specific fundraising terms, valuations, guaranteed returns, or minimum investment check sizes in free text.
  - **No Automated Financial Execution**: No automated financial advice, fund transfers, or investment commissions.
  - **Access Conditions Mandate**: Acceptance of Access Conditions is required before registration and server-enforced before accessing restricted investment opportunities or submitting investment inquiries. When a new version is published, re-acceptance is required.
  - **Configurable Investment Eligibility**: Each real estate listing must define configurable `eligibility_requirements` validated on the server.
  - **Invitation Gate & 1:1 Email-Token Invariant**: Membership is strictly invite-only. Invitation tokens are bound 1:1 to a unique email address (`email TEXT UNIQUE`). Entering a valid token unlocks registration with that verified email pre-populated and locked. Prospective members without an invite may submit an Access Request routed to admins (`ermolov.elena@gmail.com`).
  - **Non-Blocking Access UX & Session Resumption**: Submitting an access request must never trap the user in an indefinite circling/waiting spinner. The app immediately redirects to the token insertion page (`check_token`) with a confirmation banner preserving their submitted email. User state (`appView`, `signup_step`, `conditions_agreed`, `pending_email`, `current_user_id`) is persisted cross-platform, allowing users to return directly to the exact spot where they left off without repeating intros or legal modals.
  - **Email-Delivered Token Entry Invariant**: Unique invitation tokens are delivered exclusively via email to approved applicants. When returning to the app, users must manually insert their token from their email into the token verification field; the app must never auto-reveal or bypass manual token entry.
  - **Membership Request Review & Subscription Tier Invariant**:
    - Admin notification emails are dispatched with subject format: `New request to join ÖZARA from ${cleanName || 'Candidate'}`.
    - Approval emails link to the secure admin review page (`/api/admin/invitations/review?requestId=${id}&adminEmail=${adminEmail}`) where the admin selects the membership tier before approving.
    - Two mutually exclusive radio buttons are presented:
      - **Paid membership** — a subscription is required.
      - **Complimentary membership** — free access, granted at the admin’s discretion.
      Neither selected by default.
    - Actions:
      - **Approve**: Persists the selected membership option (`membership_tier = 'paid'` or `'complimentary'`), generates the official 1:1 token, and sends the invitation email. Approving without selecting a membership tier is strictly blocked.
      - **Decline**: Declines the request without requiring a membership tier selection.
    - **Onboarding Subscription Gate**:
      - Paid members must complete subscription payment during onboarding before accessing member features (`tabs`).
      - Complimentary members skip subscription payment and receive active access immediately after onboarding.
    - **Admin-Only Visibility & Storage**:
      - Membership tier is stored on the member's account (`membership_tier`, `subscription_status`).
      - This setting is visible and editable strictly to administrators (`FOUNDER`, `ADMIN`) and never exposed to other members or non-admin profiles. Admins can adjust the tier via `PATCH /api/admin/members/:id/membership-tier`.
  - **Member Location Filtering Invariant**: Member directory searches and location filtering must strictly match members' saved residential locations (`m.city`, `m.country`, `m.state`, or Question 2 saved response). Filtering must never match chapter name or chapter affiliation. Members residing in Seattle (e.g. Elena Alexeeva `usr_muwksc1i`) must match Seattle/United States and never appear under Dubai.
  - **Community as Home Page & Unified Navigation Invariant**:
    - The top-level platform navigation across desktop and mobile is strictly ordered: **Community · Network · Events · Investments**.
    - **Community** is the primary home page, combining ÖZARA’s imported Telegram posts with members’ questions, expertise, and requests for introductions. Community is its own top-level destination—never placed inside Network or split into a separate Feed page.
    - **Network** is exclusively focused on member discovery, multi-dimensional filtering, connection requests, and contact unlocking.
    - **Team** is relocated into the profile/user menu area ("Founders & Team"), keeping top-level tabs focused and uncluttered.
    - Community opens by default after a fresh login when no specific destination is requested. If the user follows a direct link or logs in after session expiry, the app restores their intended destination page instead.
  - **Page & State Restoration on Refresh Invariant**:
    - Refreshing (browser reload or mobile app resume) must reopen the exact current page and active view—such as Community, a specific member profile, an event detail modal, or an investment listing card/modal.
    - Active search queries, filter pill selections (e.g. country, city, category, bedrooms), sorting preferences, and scroll position must be preserved where possible.
    - Users remain signed in while their session remains valid. Refreshing must never dump an authenticated user back to the splash screen, onboarding, token insertion, or default home.
    - Persistent URLs (hash/query routing) allow direct links to open the correct page immediately.
    - If a session expires, the app stores the intended destination, prompts for login, and restores the intended page post-authentication.
    - If a referenced item is missing or inaccessible, the app shows a clear explanation and returns gracefully to the parent section. User-specific interface state is cleared on logout.
  - **Telegram Channel Integration within Community**:
    - Posts from Alexandra and Julia’s designated Telegram channel are automatically synchronized into the Community feed via a backend Telegram bot added to the channel by its administrators.
    - Moving forward, ingestion accepts posts with pictures OR without pictures (text-only posts). Ingestion strictly excludes videos, video notes, and animations.
    - Captions and post content are automatically translated to English, preserving proper names, figures, currencies, and ÖZARA brand equity.
    - Author names from Telegram are translated to verified English names (e.g., `Julia Shchukina | Edeluxe` via `iuliiashchukinainvest@gmail.com`, `Alexandra Hill` via `agniyahill@gmail.com`).
    - Telegram comments, reactions, and likes are explicitly excluded and not synchronized.
    - Multi-photo posts and albums render as an interactive photo carousel with Left (‹) and Right (›) navigation arrows, photo counter badge (`1 / N`), and thumbnail indicators.
    - Upstream edits in Telegram synchronize in place without creating duplicate posts, using `(telegram_channel_id, telegram_message_id)`.
    - Successfully imported and translated posts publish automatically. Failures are safely held in an admin review queue for manual resolution or retry.
    - Imported posts are distinctly labeled **"From ÖZARA"** with verified institutional club branding; individual author attribution appears where identified in source.
    - For one-time history imports, only the single latest eligible post is staged (`message686`, 8 October 2026). Staged records reside in `telegram_staged_history` awaiting reconciliation with the verified real Telegram group ID. Using temporary deduplication keys (such as `"-100_history_export"`) in production `community_posts` is strictly prohibited.
    - Administrators can correct translations, manually hide or delete posts (standard Telegram bot updates do not broadcast channel deletions), and pause automatic publishing. Admin manual corrections are preserved; subsequent upstream source edits flag the post for review.
    - Members can publish posts and comment on both imported ÖZARA posts and member posts. The Community feed includes filters: **All · From ÖZARA · From members**.
    - For this version, translation applies to post text and captions only, without altering text embedded in images or speech in videos.
  - **Simplification of Chapters & Unconfirmed Venues**: Chapter city tabs, venue cards, "Meet the Chapter Lead", "Post a Trip", and "90s Quarterly Pulse" are removed from the active interface in favor of Community. Unconfirmed venue and partnership claims (including The Arts Club Dubai) are removed from active records. Gatherings are handled through the Events section.

  - **Investments Catalog Landing Page, Dynamic Categories & Grid Specification**:
    - The Investments section presents an Investment Landing Page showing dynamic category tiles first before displaying all listings.
    - Real Estate category tiles are generated dynamically from the synchronized catalog (never hardcoded); only categories containing published, available listings are shown. Categories with 0 listings are automatically removed; new categories (e.g., Parking) are automatically supported with clean English labels and 3D isometric illustrated icons. Consistent fallback icons are provided for unfamiliar categories so no manual setup is required.
    - Normalized category naming prevents duplicates. Landing tiles, results-page compact category row, Property Type dropdown options, and counts remain strictly synchronized. Dynamic categories are generated from the full catalog so filtering by search/location does not collapse navigation. If a selected category is ever removed, the system switches to All Properties with a brief explanation. Failed or incomplete imports must never wipe existing listings or categories.
    - Category results page displays visible dropdowns for Country, City (dependent on Country), Budget, Bedrooms, Property Type, and Features, plus sorting on the right (`best match`). Below filters, a compact category tiles row highlights the active selection with subtle border, background, and checkmark. Two-way synchronization connects Property Type dropdown and category tiles.
    - Listing cards are arranged in a centered content area (max-width 1240px) with 3 cards per row on large desktops, 2 on tablets, and 1 on phones. Card images use a fixed 4:3 landscape aspect ratio with balanced cropping (no stretching).
    - Cards support direct photo browsing via subtle left/right arrows and touch swiping with a photo counter (e.g., `1 / 12`), stopping event propagation so the listing is not opened when navigating photos.
    - Page state (landing vs results view, selected category, filters, sorting, scroll position) is persisted and restored across refreshes.
    - Private Tech Companies displays "Coming soon" with no active listings.
  - **Inbox, Direct Messaging, and Notifications Invariant**:
    - Top navigation across desktop and mobile displays an **Inbox icon** with an unread badge indicating the count of unread items.
    - The Inbox modal/view contains two primary tabs for all members: **Messages** and **Notifications**.
    - For administrators (Alexandra, Julia, Elena), a third tab **Admin Activity** is displayed.
    - **Messages**:
      - Supports simple 1-to-1 text conversations between mutually accepted connections (`member_connections.status = 'accepted'`), or between an admin and any member.
      - Unaccepted members cannot initiate private messages (enforced on backend with 403 Forbidden).
      - Unread counters are tracked per conversation.
      - Each conversation header includes the member's profile summary and a "⋮" menu with Block Member and Report Member actions.
      - Blocked users cannot message the blocker; blocked state is enforced server-side.
      - Private conversation contents are strictly private to the two participants and are never exposed in search, admin activity logs, or public APIs.
    - **Notifications**:
      - Regular members receive:
        1. Private message alerts ("You have a new message from [Name]").
        2. Connection requests with inline **Accept** and **Decline** actions.
        3. Admin messages and announcements addressed to them.
        4. Event invitations, event updates, and newly published accessible events.
        5. New Community post notifications (configurable).
      - Clicking a notification navigates directly to the relevant profile drawer, conversation, event detail modal, or community post, marking the notification as read.
    - **Admin Activity**:
      - Unified activity log tracking meaningful system actions: access requests, completed onboarding, connection requests & acceptances, community posts and comments, RSVPs and cancellations, investment inquiries, reports, and integration failures.
      - Coordinated with existing audit logs to use one shared activity system without duplicate records.
      - Private message contents are excluded from admin activity logs to preserve participant confidentiality.
    - **Duplicate Notifications by Email & Throttling**:
      - Each in-app notification creates a corresponding transactional email sent to the member's verified email address, formatted with an ÖZARA-branded dark luxury HTML template.
      - For private messages, the email subject is "New message from [Name] on ÖZARA" and the email body states "You have a new message from [Name]. Open your ÖZARA Inbox to read and reply." The private message body is strictly omitted from email.
      - **Message Email Throttling**: Repeated unread-message alerts within a conversation are grouped/debounced (only 1 email alert while messages remain unread or within 15 minutes) to avoid sending an email for every single message line.
      - Configurable Notification Preferences: immediate emails, daily digest, or in-app only for optional categories (new posts, new events, routine admin activity). Disabling email keeps in-app notifications intact.
    - **Delivery Queue, Retry & Security Guardrails**:
      - Email delivery queue with idempotency keys prevents duplicate sends.
      - Automatic retry with exponential backoff on temporary failures (up to 3 attempts).
      - Delivery status logs record timestamp, recipient email, category, status, and error message without exposing sensitive contents.
      - Safe Sandbox & Test Suppression: Automated test suites, test accounts (`is_test = 1`), and simulated email addresses (`@example.com`, etc.) are safely suppressed from live email delivery and logged to a developer test mailbox.
  - **Durable Media Storage & Image Reliability Invariant**:
    - Catalog photos must never rely on hotlinking ephemeral upstream source URLs (`developer.edex.estate`), local Mac paths, or client browser caches.
    - Synchronized images are validated and persisted into durable storage (`storage/catalog/`) with dual variants:
      - Optimized card images: `storage/catalog/cards/{id}_{idx}.webp` (640x480, 4:3 ratio, WebP quality 85, ~40-60KB).
      - High-resolution detail images: `storage/catalog/full/{id}_{idx}.webp` (up to 1600x1200, WebP quality 90).
      - Thumbnail strip images: `storage/catalog/thumb/{id}_{idx}.webp` (160x120, WebP).
    - Image Delivery Layer: Endpoint `GET /api/media/catalog/:id/:variant/:filename` serves images with `Cache-Control: public, max-age=31536000, immutable`, ETag, and 304 response.
    - Failure Recovery & Backfill: When upstream download fails or times out, the synchronizer retains last working images. If no working image exists due to upstream outage, backfills using verified high-resolution luxury architectural collections tailored to property category and region.
    - Deduplication (SHA256) and photo ordering (`0, 1, 2, ...`) are strictly preserved.
    - Privacy Isolation: Catalog photos are public luxury assets with public caching. Member avatars, profile media, and Telegram community media remain strictly protected behind authenticated session tokens (`/storage/telegram_media/`, `/api/community/media/`).
  - **Smooth Mobile Photo Browsing Invariant**:
    - Mobile UI uses `expo-image` for hardware-accelerated decoding, memory-disk caching, and smooth crossfades (`transition={200}`).
    - When card renders or index changes, adjacent photos (`curIndex + 1`, `curIndex - 1`) are proactively preloaded via `Image.prefetch`.
    - Current photo remains visible until the next photo buffers to prevent black flickers.
    - Card maintains fixed 4:3 aspect ratio across all devices without layout shift.
    - Graceful loading state and error state with "Tap to retry" button.
  - **Always-Available Hosted Staging Invariant**:
    - The React Native / Expo application in `mobile/` is the single canonical iOS frontend and web preview (`mobile/dist`).
    - Staging environment is containerized (`Dockerfile`) with persistent disk volume mounted for SQLite (`/app/data`) and media (`/app/storage`).
    - Automated nightly backups of SQLite database snapshots.
    - Staging data isolation (`NODE_ENV=staging`) with test email suppression: real member emails are never contacted during staging or testing.
    - Repeatable release process connected to git version control.
  - **Canonical Mobile Frontend & Fast UI Development Invariant**:
    - **Single Primary Application**: The React Native / Expo application in `mobile/` is the canonical, primary application for all UI development, browser previews, and future iOS builds.
    - **Scope of Small UI Changes**:
      - For UI changes, work exclusively in the relevant components under `mobile/` (`mobile/src/screens/`, `mobile/src/components/`, etc.) unless a backend API change is strictly necessary.
      - Never touch or update the legacy vanilla web frontend (`public/index.html`, `public/app.js`, `public/styles.css`) unless the user explicitly requests changes to the legacy web interface.
    - **Batched & Efficient Inspection**:
      - Avoid inspecting small code slices or running dozens of sequential grep/view calls. Read relevant functions, styles, and components together in a single or batched read.
      - Plan modifications before applying edits rather than performing iterative multi-file trial searches across unrelated codebases.
    - **Hot-Reload Dev Workflow vs. Static Exports**:
      - For local development and verification, run and rely on the Expo development server with hot reload / Fast Refresh (`npm run dev:mobile` / `npx expo start --web --port 8081`).
      - Perform focused verification against the hot-reloading preview at `http://localhost:8081` (or LAN IP).
      - Do NOT run full static exports (`expo export`) or deployment builds for incremental UI tweaks. Reserve full exports (`npm run export:mobile`) and staging pushes strictly for formal review preparation and production/staging deployments.
- **Update Rule**: Only update `gemini.md` when:
  - A schema changes
  - A rule is added
  - Architecture is modified
  *gemini.md is law. The planning files are memory.*

## 3. Data Schemas

### 3.1 Profile & Questionnaire Schema

#### Input Schema: Profile Intake & Update
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ProfileIntakeInput",
  "type": "object",
  "required": ["full_name", "headline", "chapter_id", "contact_preference", "answers"],
  "properties": {
    "full_name": { "type": "string", "minLength": 2 },
    "avatar_url": { "type": ["string", "null"] },
    "headline": { "type": "string", "maxLength": 160 },
    "chapter_id": { "type": "string" },
    "city": { "type": "string" },
    "state": { "type": "string" },
    "country": { "type": "string" },
    "industry": { "type": "string" },
    "contact_preference": {
      "type": "string",
      "enum": ["direct_contact", "through_team", "unavailable"]
    },
    "taxonomies": {
      "type": "object",
      "properties": {
        "roles": { "type": "array", "items": { "type": "string" } },
        "industries": { "type": "array", "items": { "type": "string" } },
        "expertise": { "type": "array", "items": { "type": "string" } },
        "offers": { "type": "array", "items": { "type": "string" } },
        "needs": { "type": "array", "items": { "type": "string" } },
        "interests": { "type": "array", "items": { "type": "string" } },
        "institutions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "taxonomy_context_notes": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "answers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["question_id", "answer_state", "visibility"],
        "properties": {
          "question_id": { "type": "integer", "minimum": 1, "maximum": 30 },
          "answer_state": {
            "type": "string",
            "enum": ["unanswered", "answered", "deliberately_skipped"]
          },
          "value": { "type": ["string", "array", "object", "null"] },
          "visibility": {
            "type": "string",
            "enum": ["shared", "private"]
          }
        }
      }
    },
    "travel_plans": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["city", "country", "start_date", "end_date", "visibility"],
        "properties": {
          "id": { "type": "string" },
          "city": { "type": "string" },
          "country": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": "string", "format": "date" },
          "notes": { "type": ["string", "null"] },
          "visibility": { "type": "string", "enum": ["shared", "private"] }
        }
      }
    }
  }
}
```

#### Output Schema: Member Profile Public / Authenticated View
*Note: Private answers (including Question 23) and expired travel records are filtered out.*
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MemberProfilePayload",
  "type": "object",
  "required": ["id", "full_name", "headline", "chapter", "is_complete", "contact_preference", "shared_answers", "shared_taxonomies"],
  "properties": {
    "id": { "type": "string" },
    "full_name": { "type": "string" },
    "avatar_url": { "type": ["string", "null"] },
    "headline": { "type": "string" },
    "chapter": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "city": { "type": "string" },
        "country": { "type": "string" }
      }
    },
    "city": { "type": "string" },
    "state": { "type": "string" },
    "country": { "type": "string" },
    "industry": { "type": "string" },
    "is_complete": { "type": "boolean", "description": "True if Question 18 has been answered" },
    "contact_preference": {
      "type": "string",
      "enum": ["direct_contact", "through_team", "unavailable"]
    },
    "shared_taxonomies": {
      "type": "object",
      "properties": {
        "roles": { "type": "array", "items": { "type": "string" } },
        "industries": { "type": "array", "items": { "type": "string" } },
        "expertise": { "type": "array", "items": { "type": "string" } },
        "offers": { "type": "array", "items": { "type": "string" } },
        "needs": { "type": "array", "items": { "type": "string" } },
        "interests": { "type": "array", "items": { "type": "string" } },
        "institutions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "shared_answers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question_id": { "type": "integer" },
          "question_prompt": { "type": "string" },
          "answer_state": { "type": "string", "enum": ["answered", "deliberately_skipped"] },
          "value": { "type": ["string", "array", "object", "null"] }
        }
      }
    },
    "active_travel_plans": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "city": { "type": "string" },
          "country": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": "string", "format": "date" }
        }
      }
    },
    "admitted_at": { "type": "string", "format": "date-time" }
  }
}
```

---

### 3.2 Networking, Recommendations & Intro Queue

#### Input: Search & Recommendation Query
```json
{
  "query": { "type": "string" },
  "industries": { "type": "array", "items": { "type": "string" } },
  "expertise": { "type": "array", "items": { "type": "string" } },
  "needs": { "type": "array", "items": { "type": "string" } },
  "offers": { "type": "array", "items": { "type": "string" } },
  "chapter_id": { "type": "string" },
  "traveling_to_city": { "type": "string" }
}
```

#### Output: Explainable Match Payload
```json
{
  "member_id": "usr_98124",
  "full_name": "Elena Ermolov",
  "headline": "Managing Director, Global FinTech & Cross-border Operations",
  "avatar_url": "/avatars/elena_ermolov.jpg",
  "chapter": "Dubai",
  "match_score": 0.94,
  "match_rationale": "Matches your need for [Cross-Border Payments] with Elena's verified expertise in [FinTech Licensing], and both are active in the [Dubai] chapter.",
  "matched_tags": [
    { "category": "expertise", "value": "FinTech Licensing" },
    { "category": "industry", "value": "Financial Services" }
  ],
  "contact_preference": "direct_contact"
}
```

#### Input / Output: Introduction Request ("Ask the Team")
```json
{
  "id": "req_intro_001",
  "requester_id": "usr_1001",
  "target_member_id": "usr_98124",
  "target_context_need": "Seeking advice on UAE regulatory sandboxes",
  "status": "pending_admin_review",
  "assigned_admin": "Alexandra",
  "created_at": "2026-10-02T10:00:00Z",
  "resolution_notes": null
}
```

#### Input / Output: Call Scheduling Payload
```json
{
  "id": "call_booking_551",
  "requester_id": "usr_1001",
  "recipient_id": "usr_98124",
  "status": "proposed",
  "proposed_times": [
    {
      "start_time": "2026-10-10T14:00:00Z",
      "end_time": "2026-10-10T14:30:00Z"
    }
  ],
  "selected_time": null,
  "timezone": "Asia/Dubai",
  "meeting_link": null,
  "message": "Hi Elena, would love to discuss cross-border logistics expansion for 20 mins."
}
```

---

### 3.3 Events & Targeted Invitations

#### Event Entity & Admin Management Payload
```json
{
  "id": "evt_miami_2026",
  "title": "Miami Annual Member Gathering & Venture Summit",
  "headline": "Annual gathering of club members in Miami: venture networking, private investor dinners, and cross-chapter executive sessions.",
  "description": "Annual gathering of club members in Miami. High-conviction venture networking, private investor dinners, and cross-chapter executive sessions with international members.",
  "event_type": "Summit",
  "chapter_id": "ch_miami",
  "start_date": "2026-11-13T10:00:00Z",
  "end_date": "2026-11-15T22:00:00Z",
  "date_precision": "exact",
  "display_date": "November 13–15, 2026",
  "year": 2026,
  "month_name": "November",
  "city": "Miami",
  "region": "Florida",
  "country": "USA",
  "location": "Miami, Florida, USA",
  "venue": "To be confirmed",
  "capacity": 35,
  "available_spots": 17,
  "registered_count": 18,
  "registration_status": "open",
  "registration_link": null,
  "price": "To be confirmed",
  "whats_included": "Private executive sessions, networking receptions, curated dinners, and masterclasses.",
  "travel_info": "Recommended arrival: November 12. Direct flights to MIA or FLL.",
  "hosts": "Miami Chapter Leadership & Founders",
  "hero_image": "/assets/events/miami_2026.jpg",
  "agenda": "Day 1: Welcome Cocktail & Opening Keynote. Day 2: Strategic Salons & Closed Dinners. Day 3: Yacht Expedition & Private Advisory Roundtables.",
  "is_published": true,
  "is_next_upcoming": true,
  "is_past": false
}
```

#### Targeted Invitation Filter & Preview Payload
```json
{
  "event_id": "evt_771",
  "filters": {
    "chapters": ["ch_dubai"],
    "industries": ["Artificial Intelligence", "Enterprise SaaS"],
    "include_travelers_in_city": "Dubai",
    "exclude_past_attendees": false
  },
  "preview_recipient_count": 24,
  "deduplicated_recipient_ids": ["usr_1001", "usr_1002", "usr_1015"]
}
```

---

### 3.4 Investments (Real Estate Catalog, Units, Saved Listings & Guardrails)

#### Real Estate Catalog Entity Payload
```json
{
  "id": "re_cat_100777",
  "source_id": "100777",
  "developer_project_id": 777,
  "title": "Tataran / Baja Hanura Private Island – private island for luxury resort development",
  "description": "Private island for luxury resort development",
  "description_full": "Exclusive island offering multi-hectare natural sanctuary...",
  "property_type": "Private Islands",
  "country": "Philippines",
  "city": "Palawan",
  "location": "Quezon, Palawan, Philippines",
  "price_display": "USD 9,000,000",
  "currency": "USD",
  "price_min_num": 9000000,
  "price_max_num": 9000000,
  "beds": 0,
  "baths": 0,
  "beds_min": null,
  "beds_max": null,
  "sqft": null,
  "area_range": null,
  "year": 2026,
  "handover": "Q4 2026",
  "completion_status": "Completed",
  "badge": "Published",
  "features": ["Handover: Q4 2026", "Stage: Completed"],
  "images": [
    "https://developer.edex.estate/uploads/1785424169732-c8f1ab45-87e9-46dc-b116-a0ffb40daee2.jpg"
  ],
  "floor_plans": [],
  "map_url": "https://www.google.com/maps/search/?api=1&query=Quezon%2C%20Palawan%2C%20Philippines",
  "payment_terms": {
    "installment_plan": null,
    "mortgage_available": false,
    "post_handover": false
  },
  "has_units": false,
  "units_count": 0,
  "status": "published",
  "is_saved": false,
  "source_meta": {
    "provider_internal_source": "upstream_partner_sync",
    "last_synced_at": "2026-10-08T12:00:00Z"
  },
  "created_at": "2026-10-08T12:00:00Z",
  "updated_at": "2026-10-08T12:00:00Z"
}
```

#### Project Unit Entity Payload
```json
{
  "id": "unit_1128",
  "parent_project_id": 1122,
  "parent_catalog_id": "re_cat_101122",
  "title": "Studios 27–58 m² in a finished tower on the first line of the canal",
  "description": "Studios in a ready 23-storey tower on the first line of the city canal...",
  "unit_types": ["Studio"],
  "price_display": "AED 1,250,000",
  "currency": "AED",
  "price": 1250000,
  "price_min": 1250000,
  "price_max": 1450000,
  "area_range": "27–58 m²",
  "bedrooms_range": "0",
  "bedrooms_min": 0,
  "bedrooms_max": 0,
  "handover_quarter": null,
  "handover_year": null,
  "installment_plan": "20% initial payment, 30% during construction, 50% on handover.",
  "images": [
    "https://developer.edex.estate/uploads/sample_unit.jpg"
  ],
  "status": "published"
}
```

#### Saved Listing Payload
```json
{
  "id": "save_8192",
  "user_id": "usr_muwksc1i",
  "listing_id": "re_cat_100777",
  "saved_at": "2026-10-08T12:30:00Z"
}
```

#### Daily Synchronization Log Payload
```json
{
  "id": "sync_log_20261008_01",
  "started_at": "2026-10-08T04:00:00Z",
  "completed_at": "2026-10-08T04:02:15Z",
  "status": "success",
  "total_catalog_count": 239,
  "projects_imported": 239,
  "units_imported": 15,
  "withdrawn_count": 0,
  "error_message": null,
  "triggered_by": "scheduled"
}
```

#### Member Inquiry / Details Request Payload
```json
{
  "id": "inq_302",
  "listing_id": "re_cat_101122",
  "member_id": "usr_muwksc1i",
  "unit_id": "unit_1128",
  "inquiry_type": "request_details",
  "notes": "Interested in 2-bedroom unit availability and payment terms.",
  "admin_recipient": "iuliiashchukinainvest@gmail.com, ermolov.elena@gmail.com",
  "status": "new",
  "created_at": "2026-10-08T12:35:00Z"
}
```

#### Access Conditions Acceptance Schema
```json
{
  "user_id": "usr_1001",
  "conditions_version": "2026-10-v1",
  "accepted_at": "2026-10-03T12:00:00Z",
  "source": "welcome_modal"
}
```

#### Catalog Category & Navigation Payload
```json
{
  "total_properties": 239,
  "categories": [
    {
      "id": "Residential",
      "name": "Residential",
      "count": 229,
      "icon_key": "residential",
      "icon_url": "/investments/icons/residential.png"
    },
    {
      "id": "Countryside",
      "name": "Countryside",
      "count": 5,
      "icon_key": "countryside",
      "icon_url": "/investments/icons/countryside.png"
    },
    {
      "id": "Commercial",
      "name": "Commercial",
      "count": 2,
      "icon_key": "commercial",
      "icon_url": "/investments/icons/commercial.png"
    },
    {
      "id": "Private Islands",
      "name": "Private Islands",
      "count": 3,
      "icon_key": "private_islands",
      "icon_url": "/investments/icons/private_islands.png"
    }
  ]
}
```

---

### 3.5 Governance & Security Audit Schema

#### Private Field Access Audit Log
```json
{
  "id": "audit_log_9001",
  "actor_id": "admin_alexandra",
  "action": "view_private_answer",
  "target_member_id": "usr_1001",
  "question_id": 23,
  "timestamp": "2026-10-02T11:05:00Z",
  "ip_address": "127.0.0.1"
}
```

#### Two-Person Export Request Schema
```json
{
  "export_id": "exp_req_01",
  "requested_by": "admin_julia",
  "request_timestamp": "2026-10-02T11:00:00Z",
  "export_type": "members_directory_csv",
  "approved_by": "admin_alexandra",
  "approval_timestamp": "2026-10-02T11:04:00Z",
  "status": "approved",
  "download_token": "exp_sec_token_9981"
}
```

---

### 3.6 Invitation Gate & Access Request Schema

#### Input / Output: Invitation Token Verification
```json
{
  "token": "OZARA-8421-9943",
  "valid": true,
  "email": "applicant@company.com",
  "full_name": "Marcus Vance",
  "status": "approved"
}
```

#### Input / Output: Access Request Submission
```json
{
  "id": "req_acc_101",
  "email": "prospective@venture.co",
  "full_name": "Elena Rostova",
  "linkedin_or_background": "https://linkedin.com/in/erostova",
  "what_brings_you": "Looking to connect with high-trust AI founders in Dubai and London.",
  "status": "pending_admin_approval",
  "admin_notification_recipient": "ermolov.elena@gmail.com, agniyahill@gmail.com, iuliiashchukinainvest@gmail.com",
  "created_at": "2026-10-05T12:00:00Z"
}
```

#### Input / Output: Admin Access Approval & Token Generation
```json
{
  "request_id": "req_acc_101",
  "approved_by": "agniyahill@gmail.com",
  "email": "prospective@venture.co",
  "token": "OZARA-9142-3850",
  "expires_at": "2026-10-19T12:00:00Z",
  "status": "approved",
  "email_dispatched": true,
  "approved_at": "2026-10-05T12:05:00Z"
}
```

#### Input / Output: Admin Access Request Decline
```json
{
  "request_id": "req_acc_101",
  "declined_by": "iuliiashchukinainvest@gmail.com",
  "status": "declined",
  "declined_at": "2026-10-05T12:06:00Z"
}
```

#### Input / Output: Admin Invitation Revocation
```json
{
  "token": "OZARA-9142-3850",
  "revoked_by": "agniyahill@gmail.com",
  "status": "revoked",
  "revoked_at": "2026-10-05T12:10:00Z"
}
```

#### Output: Real-Time Access Status Polling
```json
{
  "email": "prospective@venture.co",
  "status": "approved",
  "has_token": true,
  "token": "OZARA-9142-3850"
}
```

---

### 3.7 Onboarding Contact Inquiries & Admin Routing Schema

#### Input: Contact Inquiry Payload
```json
{
  "name": "Marcus Vance",
  "email": "marcus.vance@techventures.co",
  "message": "Hello Alexandra and Julia, I would love to learn more about upcoming gatherings in Dubai and joining the community.",
  "website": null
}
```

#### Output: Contact Receipt Confirmation
```json
{
  "success": true,
  "message": "Thank you. Your message has been received."
}
```

#### Output: Contact & WhatsApp Configuration
```json
{
  "whatsapp_configured": false,
  "whatsapp_number": null
}
```

---

### 3.8 Phone Authentication & Verification Schema

#### Input / Output: Send Phone Verification Code
```json
{
  "phone": "+971501234567",
  "country_code": "AE",
  "method": "sms"
}
```
*Output:*
```json
{
  "success": true,
  "message": "Verification code dispatched.",
  "provider": "sms",
  "expires_in_seconds": 600
}
```

#### Input / Output: Verify Phone OTP Code
```json
{
  "phone": "+971501234567",
  "code": "482910"
}
```
*Output: Existing Approved Member:*
```json
{
  "success": true,
  "verified": true,
  "is_existing_member": true,
  "user": {
    "id": "usr_98124",
    "full_name": "Elena Ermolov",
    "email": "ermolov.elena@gmail.com",
    "role": "FOUNDER"
  }
}
```
*Output: New Candidate (Proceeds to Invitation Gate & Access Conditions):*
```json
{
  "success": true,
  "verified": true,
  "is_existing_member": false,
  "phone": "+971501234567"
}
```

#### Output: Phone Auth Configuration
```json
{
  "whatsapp_verification_enabled": false,
  "provider": "local_sms"
}
```

---

### 3.9 Biometrics Setup & Welcome / Create Account Schema

#### Input / Output: Biometric Enrollment Preference
```json
{
  "biometrics_enabled": true,
  "biometric_type": "face_id",
  "device_platform": "ios"
}
```

#### Input / Output: Member Account Creation with Terms Agreement
```json
{
  "full_name": "Marcus Vance",
  "email": "marcus.vance@techventures.co",
  "phone": "+971501234567",
  "token": "OZARA-8421-9943",
  "accepted_terms_version": "2026-10-v1",
  "accepted_terms_at": "2026-10-05T14:30:00Z",
  "biometrics_enabled": true
}
```
*Output:*
```json
{
  "success": true,
  "user": {
    "id": "usr_99214",
    "full_name": "Marcus Vance",
    "email": "marcus.vance@techventures.co",
    "phone": "+971501234567",
    "terms_accepted_version": "2026-10-v1",
    "terms_accepted_at": "2026-10-05T14:30:00Z",
    "biometrics_enabled": 1,
    "role": "MEMBER",
    "is_complete": 0
  },
  "userId": "usr_99214"
}
```

#### Output: Configurable Legal Content
```json
{
  "title": "ÖZARA Private Membership Terms & Conditions",
  "version": "2026-10-v1",
  "last_updated": "2026-10-05",
  "sections": [
    {
      "heading": "1. Private Community & Invite-Only Membership",
      "content": "ÖZARA is a confidential, invite-only community for vetted founders, executives, and investors..."
    }
  ]
}
```

---

### 3.10 Community Wall Schema

#### Input / Output: Community Post
```json
{
  "id": "post_7812",
  "author_id": "usr_98124",
  "author": {
    "id": "usr_98124",
    "full_name": "Elena Ermolov",
    "avatar_url": "/avatars/elena_ermolov.jpg",
    "headline": "Managing Director, Global FinTech & Cross-border Operations",
    "role": "FOUNDER",
    "company": "ÖZARA",
    "role_title": "Co-founder"
  },
  "topic": "Question",
  "content": "Looking to connect with founders navigating UAE Virtual Asset Regulatory Authority (VARA) licensing. Anyone with direct operational experience willing to share 15 minutes of insight?",
  "created_at": "2026-10-08T14:30:00Z",
  "updated_at": "2026-10-08T14:30:00Z",
  "comments_count": 2,
  "comments": [
    {
      "id": "comm_401",
      "post_id": "post_7812",
      "author_id": "usr_muwksc1i",
      "author": {
        "id": "usr_muwksc1i",
        "full_name": "Elena Alexeeva",
        "avatar_url": null,
        "headline": "Data Engineer · Netflix",
        "role": "MEMBER"
      },
      "content": "Happy to connect you with our regulatory counsel who just closed a VARA application.",
      "created_at": "2026-10-08T14:45:00Z"
    }
  ]
}
```

#### Input: Create / Edit Community Post
```json
{
  "topic": "Question",
  "content": "Ask your network or share something useful..."
}
```

#### Input: Create Community Comment
```json
{
  "content": "Happy to connect on this topic."
}
```

---

### 3.7 Unified Community & Telegram Ingestion Schemas

#### Output: Unified Community Post Payload (Telegram & Member Posts)
```json
{
  "id": "post_tg_9921",
  "source_type": "telegram",
  "author_label": "From ÖZARA",
  "is_official": true,
  "author": {
    "id": "usr_ozara_official",
    "full_name": "ÖZARA",
    "avatar_url": "/assets/brand/ozara_badge.png",
    "headline": "Curated Club Intelligence",
    "role": "ADMIN"
  },
  "topic": null,
  "content": "Private investment salon in Zurich announced for November. Member allocations open on Monday.",
  "original_content": "Объявлен закрытый инвестиционный салон в Цюрихе на ноябрь. Аллокации для членов клуба открываются в понедельник.",
  "original_language": "ru",
  "translated": true,
  "media_attachments": [
    {
      "id": "att_01",
      "media_type": "photo",
      "url": "https://storage.ozara.club/media/zurich_salon.jpg",
      "thumbnail_url": "https://storage.ozara.club/media/zurich_salon_thumb.jpg",
      "caption": "Zurich Salon Venue",
      "width": 1280,
      "height": 960
    }
  ],
  "telegram_meta": {
    "channel_id": "-100192837482",
    "message_id": 482,
    "media_group_id": "13928174910283",
    "source_edited_at": "2026-10-08T15:00:00Z"
  },
  "status": "published",
  "admin_corrected": false,
  "created_at": "2026-10-08T14:30:00Z",
  "updated_at": "2026-10-08T15:00:00Z",
  "comments_count": 3,
  "comments": []
}
```

#### Input / Output: Telegram Sync & Webhook Ingestion Payload
```json
{
  "update_id": 1029384,
  "channel_post": {
    "message_id": 482,
    "sender_chat": {
      "id": -100192837482,
      "title": "ÖZARA Private Club",
      "type": "channel"
    },
    "date": 1791473400,
    "text": "Объявлен закрытый инвестиционный салон в Цюрихе на ноябрь.",
    "media_group_id": "13928174910283",
    "photo": [
      {
        "file_id": "AgACAgIAAxkBAAI...",
        "file_unique_id": "AQAD...",
        "width": 1280,
        "height": 960,
        "file_size": 245120
      }
    ],
    "caption": "Zurich Salon Venue"
  }
}
```

#### Input: Admin Translation Correction Payload
```json
{
  "post_id": "post_tg_9921",
  "corrected_content": "Private investment salon in Zurich confirmed for November. Member allocations open on Monday.",
  "admin_notes": "Refined phrasing to match institutional tone"
}
```

#### Input / Output: Navigation & Page Restoration State Payload
```json
{
  "route": "investments",
  "active_tab": "investments",
  "params": {
    "view": "results",
    "category": "Residential",
    "country": "United Arab Emirates",
    "city": "Dubai",
    "sort": "price_asc",
    "listing_id": "re_cat_100777"
  },
  "scroll_y": 420,
  "authenticated_user_id": "usr_muwksc1i",
  "session_valid": true,
  "timestamp": 1791474000000
}
```

---

### 3.11 Inbox, Member Messaging & Notifications Schema

#### Direct Message Entity Payload
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DirectMessagePayload",
  "type": "object",
  "required": ["id", "conversation_id", "sender_id", "recipient_id", "content", "is_read", "created_at"],
  "properties": {
    "id": { "type": "string" },
    "conversation_id": { "type": "string" },
    "sender_id": { "type": "string" },
    "recipient_id": { "type": "string" },
    "content": { "type": "string", "maxLength": 5000 },
    "is_read": { "type": "boolean" },
    "read_at": { "type": ["string", "null"] },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

#### Conversation Summary Payload
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ConversationSummaryPayload",
  "type": "object",
  "required": ["id", "other_user", "last_message", "unread_count", "is_blocked"],
  "properties": {
    "id": { "type": "string" },
    "other_user": {
      "type": "object",
      "required": ["id", "full_name", "avatar_url", "role", "city"],
      "properties": {
        "id": { "type": "string" },
        "full_name": { "type": "string" },
        "headline": { "type": "string" },
        "avatar_url": { "type": ["string", "null"] },
        "role": { "type": "string" },
        "city": { "type": "string" },
        "country": { "type": "string" }
      }
    },
    "last_message": {
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "sender_id": { "type": "string" },
        "created_at": { "type": "string" }
      }
    },
    "unread_count": { "type": "integer" },
    "is_blocked": { "type": "boolean" },
    "blocked_by": { "type": ["string", "null"] }
  }
}
```

#### In-App Notification Payload
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "InAppNotificationPayload",
  "type": "object",
  "required": ["id", "user_id", "type", "title", "message", "is_read", "created_at"],
  "properties": {
    "id": { "type": "string" },
    "user_id": { "type": "string" },
    "type": {
      "type": "string",
      "enum": [
        "direct_message",
        "connection_request",
        "connection_accepted",
        "admin_message",
        "announcement",
        "event_invitation",
        "event_update",
        "event_published",
        "community_post"
      ]
    },
    "title": { "type": "string" },
    "message": { "type": "string" },
    "action_url": { "type": ["string", "null"] },
    "metadata_json": { "type": ["string", "null"] },
    "is_read": { "type": "boolean" },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

#### Notification Preferences Payload
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NotificationPreferencesPayload",
  "type": "object",
  "required": ["user_id"],
  "properties": {
    "user_id": { "type": "string" },
    "email_direct_messages": { "type": "string", "enum": ["immediate", "never"] },
    "email_connection_requests": { "type": "string", "enum": ["immediate", "never"] },
    "email_new_posts": { "type": "string", "enum": ["immediate", "daily_digest", "never"] },
    "email_new_events": { "type": "string", "enum": ["immediate", "daily_digest", "never"] },
    "email_event_invites": { "type": "string", "enum": ["immediate", "never"] },
    "email_admin_activity": { "type": "string", "enum": ["immediate", "daily_digest", "never"] },
    "in_app_new_posts": { "type": "boolean" },
    "in_app_new_events": { "type": "boolean" }
  }
}
```

#### Admin Activity Item Payload
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AdminActivityItemPayload",
  "type": "object",
  "required": ["id", "activity_type", "title", "description", "created_at"],
  "properties": {
    "id": { "type": "string" },
    "activity_type": {
      "type": "string",
      "enum": [
        "access_request",
        "completed_onboarding",
        "connection_requested",
        "connection_accepted",
        "community_post",
        "community_comment",
        "rsvp_confirmed",
        "rsvp_cancelled",
        "investment_inquiry",
        "report_filed",
        "integration_failure"
      ]
    },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "actor_id": { "type": ["string", "null"] },
    "actor_name": { "type": ["string", "null"] },
    "actor_avatar": { "type": ["string", "null"] },
    "target_id": { "type": ["string", "null"] },
    "target_name": { "type": ["string", "null"] },
    "entity_type": { "type": ["string", "null"] },
    "entity_id": { "type": ["string", "null"] },
    "metadata": { "type": "object" },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

---

## 4. Maintenance Log
- **2026-10-01**: Constitution initialized.
- **2026-10-02**: Defined complete JSON Data Schemas and privacy invariants for Sila Svyazei based on Discovery answers.
- **2026-10-02**: Completed BLAST Protocol Phases 1 through 5. Deployed responsive full-stack platform at `http://localhost:3000`. Migrated SQLite database, validated Question 23 permanent lock, Question 18 mandatory completion, two-person export rule, explainable recommendations, travel expiration filter, content guardrails, and audit logging.
- **2026-10-03**: Defined Invitation Gate and 1:1 Email-Token Invariant: token verification unlocks pre-populated and locked email registration; uninvited users submit access requests to Elena Ermolov (`ermolov.elena@gmail.com`).
- **2026-10-03**: Streamlined Access Request UX to eliminate indefinite circling/waiting spinner: redirects immediately to the token insertion page with a submission confirmation banner. Implemented persistent session resumption across reload/login so users return directly to the exact spot where they left off without repeating intro animations or legal modals.
- **2026-10-03**: Enforced Email-Delivered Token Entry Invariant: upon admin approval, invitation tokens are delivered exclusively via email to applicants. Removed automatic on-screen token reveal/bypass (`got_token`); users manually insert their token from their email into the token verification field on `check_token`, which then locks and prepopulates their 1:1 verified email on the registration form.
- **2026-10-03**: Implemented Onboarding Questionnaire Flow: After token verification and registration coordinates, members transition to a single minimalistic page with all 30 profile questions. Question 18 is required for profile verification (`is_complete = 1`), and Question 23 is locked confidential to founders. Added profile picture insertion with device upload, curated executive portrait presets, and manual link support.
- **2026-10-03**: Standardized Data Quality & Dropdown Integration: Decomposed location into three separate structured fields (`country`, `state` / region, and `city`) with hierarchical synchronization. Introduced search-filterable modal dropdowns for countries, states, cities, standardized industries (12 sectors), and roles. Integrated structured suggestion chips for high-friction questionnaire items to keep profile taxonomy inputs clean and consistent.
- **2026-10-03**: Expanded Primary Chapters: Added New York (`ch_new_york`) and Astana (`ch_astana`) to canonical primary chapters across `sila.db`, seed configurations, mobile onboarding chapter selectors, country hierarchy defaults, and targeted gathering audience filters.
- **2026-10-04**: Brand Unification & Deployment Sync: Transitioned all platform naming from Sila / Sila Svyazei to ÖZARA (`ozara`). Migrated primary database configuration to `ozara.db` with backward-compatible fallback. Prepared repository for overwrite push to `https://github.com/otklik-ai/ozara`.
- **2026-10-04**: Onboarding Contact Panel & Admin Routing: Implemented luxury dark navy contact modal accessible via Intro button across all 3 onboarding screens (Events, Network, Invest). Form fields (Name, Email, Message) submit to server-side configured inboxes for Alexandra (`agniyahill@gmail.com`) and Julia (`iuliiashchukinainvest@gmail.com`). Included honeypot spam protection, rate limiting, and content guardrails. Confirmed exact receipt message: "Thank you. Your message has been received.", optional WhatsApp linking, and seamless return to active onboarding slide without replay of launch animation.
- **2026-10-04**: Phone Authentication & Gate Routing: Added phone verification flow from Invest onboarding screen ("Get started") matching Axevil navy/violet luxury aesthetic. Deployed `/api/auth/phone/send-code`, `/api/auth/phone/verify-code`, and `/api/auth/phone/config`. Enforced phone verification invariant: verifies ownership of the phone number without bypassing community membership gates. Approved members route directly to club tabs; unlinked candidates continue to Access Conditions and Invitation Gate, with contact panel and support routing.
- **2026-10-04**: Development-Only Mock Phone Verification & Typography Upgrade: Added development-only mock SMS flow with strict production guardrails (`NODE_ENV === 'production'` lockout). Updated PhoneAuth copy on step 1 to "We’ll send you a verification code via SMS." and step 2 to plain text "Please check SMS. We sent a code to your number <number>" with "Change number" on the next line in orange. Elevated typography across web and mobile to modern geometric sans (Plus Jakarta Sans).
- **2026-10-05**: Invitation-First Onboarding & Pre-Verification Validation: Updated onboarding sequence to check invitations before new-member phone verification. Added discreet "Have an invitation?" link across all three introduction screens (Events, Network, Invest) and mapped Invest "Get started" to the Invitation screen. Maintained "Already a member? Sign in" as separate route for admitted members. Created dedicated Invitation screen with server validation for invalid, expired, revoked, and claimed codes. Built Request Access form (Full Name, Email, LinkedIn/Background, Motivation) with confirmation banner. Equipped admins (Alexandra, Julia, Elena) with approve, decline, expirable single-use token generation, and token revocation controls. Added atomic claim locks and optional post-registration Face ID convenience.
- **2026-10-05**: Optional Face ID Setup & Welcome / Create Account Sequence: Implemented 2 dedicated screens following phone verification for new members. Added minimal Face ID Setup Screen with outline lock + facial recognition brackets, genuine device biometrics / WebAuthn passkey support, and automatic skipping when unsupported. Created Welcome / Create Account Screen with underlined inputs for Full name and Email, linked Terms & Conditions and Privacy Policy modals with configurable ÖZARA legal content, inline validation, and atomic invitation redemption upon account creation. Separated community membership terms from real estate investment Access Conditions.
- **2026-10-05**: Minimalist Profile Questionnaire & Avatar Upload: Updated the Profile Questions screen with exact editorial welcome copy ("Welcome to ÖZARA. A place among exceptional minds..."). Replaced hardcoded default avatars and fabricated subtitles ("Verified Executive • Dubai Chapter") with initials placeholder and prominent "Upload picture" button with client/server persistence via `/api/profile/:id/avatar`. Transformed questionnaire into pure minimalistic questions with clean option dropdowns and direct text input, removing noisy badges, question numbers, helper labels, and extra icons.
- **2026-10-05**: Product Evolution: 24 Profile Questions, City & Travel Layer, Events Layer & Quarterly Pulse: Restructured ÖZARA exclusively around a professional profile and city directory model (LinkedIn-style, non-intake). Replaced old 30-question bank with strictly the 24 canonical questions grouped into Sections A (Where you are), B (What you do), C (What you are working on now), D (Personal context), and E (Chapter and events). Enforced Question 18 ("What can you offer other members?") as mandatory for profile completion (`is_complete = 1`) and Question 23 as permanently confidential with no visibility toggle. Established strict securities/broker-dealer compliance guardrails: visible guidance line under free text fields, automatic regex keyword flagging (`raising`, `pre-money`, `ticket`, `IRR`, `return`, valuations, currency figures), and peer profile reporting. Deployed the Travel Layer with self-declared, time-boxed, city-level trips (zero GPS tracking, auto-expiring) and the 5-component City Screen (Where the chapter gathers card with photo and coffee action, Chapter Lead with inbox, Members visiting in 30 days, Members based here, and upcoming gatherings). Launched the 6-month horizon Events Layer with 5 event types and travel-connected smart filtering, alongside the 90-second Quarterly Pulse that updates member focus and writes directly into the travel layer.
- **2026-10-08**: Questionnaire Alignment for Q22 & Q23: Updated Question 22 ("What are your interests outside work?") with 6 searchable, multi-choice categories (Sports & fitness, Outdoors & adventure, Arts & culture, Food & travel, Learning & leisure, Community) and synchronized choices with the taxonomies table (`category = 'interests'`). Updated Question 23 ("Is there anything else you’d like our team to know?") with helper text ("Optional. Share any context or preferences you’d rather leave off your member profile.") and a 1,000-character multiline text box, while preserving the Question 23 Permanent Lock and confidentiality safeguards.
- **2026-10-08**: Networking Section Simplification & Community Wall: Simplified Networking into two pure tabs: Members and Community. Preserved Members 2-column compact grid, search, filters, connection requests, and suggestions. Enforced member location filtering invariant matching only saved locations (`city`, `country`, `state`), eliminating improper chapter matching and ensuring Elena Alexeeva (Seattle) never matches Dubai. Created Community Wall private feed for admitted members with compact composer ("Ask your network or share something useful…"), optional topic tagging (Question, Introduction, Expertise, Opportunity), chronological feed, comments/replies, author edit/delete, admin moderation, and profile opening with connection gate. Removed chapter city tabs, venue cards, "Meet the Chapter Lead", "Post a Trip", "90s Quarterly Pulse", and stripped unconfirmed venue/partnership claims (including The Arts Club Dubai).
- **2026-10-08**: Investments Dynamic Categories, 3-Card Grid & Card Carousel: Upgraded Investments section with dynamic category landing page, 3D isometric illustrated icons, and dynamic fallback. Added Category Results layout with Country/City/Budget/Bedrooms/Property Type/Features filter dropdowns and compact category strip. Reconfigured card grid to centered 3-card layout (desktop), 2 (tablet), 1 (mobile) with 4:3 fixed landscape ratio, direct in-card photo carousel navigation, and persistent view state.
- **2026-10-08**: Unified Community Home, Page Restoration & Telegram Integration: Established Community as top-level home page combining imported ÖZARA Telegram posts with member queries and introductions. Reorganized main navigation order to `Community · Network · Events · Investments`, moving Team to the profile menu. Implemented cross-platform page restoration on refresh with deep-linking and session preservation. Integrated automated Telegram channel bot sync with media album grouping, automatic translation with preserved entities, source edit synchronization, and feed filtering (`All · From ÖZARA · From members`).


