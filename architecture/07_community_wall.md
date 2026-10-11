# SOP 07: Unified Community Home, Navigation Architecture & Telegram Channel Integration

## 1. Goal & Scope
Defines the unified top-level platform navigation (`Community · Network · Events · Investments`), the elevation of **Community** as the default home page, cross-platform page and state restoration on refresh, and the automated Telegram channel ingestion pipeline with language translation, album grouping, and admin moderation.

---

## 2. Platform Navigation Architecture

### 2.1 Top-Level Navigation Order
The main navigation across web and mobile follows a strict 4-destination order:
1. **Community** (Home): Unified feed combining ÖZARA’s imported Telegram intelligence and member discussions.
2. **Network**: Dedicated member discovery directory, multi-dimensional search/filters, connection requests, and contact unlocking.
3. **Events**: Curated 6-month calendar horizon, private summits, treks, and targeted invitations.
4. **Investments**: Real estate catalog landing page with dynamic category tiles, 3-card compact grid, and "Coming Soon" private tech allocations.

### 2.2 Relocation of Team
- **Team ("Founders & Team" / "Meet the Team")** is moved out of the primary top-level bar and into the profile drawer / user menu area.
- This keeps the main navigation focused exclusively on primary member workflows.

### 2.3 Default Destination & Deep-Link Resolution
- **Fresh Login**: Opens `/` or `#community` by default when no specific route or deep link is requested.
- **Direct Links / Session Resumption**: If the user follows a direct link (e.g. `/#investments?listing=re_cat_100777` or `/#events?event=evt_miami_2026`) or their session expires while viewing a page, the app records `redirect_url` and restores the intended destination immediately post-login.

---

## 3. Page & State Restoration on Refresh

### 3.1 Persistent URL Routing
- Navigation states are represented in the URL hash and query parameters across desktop and mobile deep links:
  - `#community` (with optional `?filter=all|ozara|members`)
  - `#network` (with optional `?query=...&industry=...&member=usr_123`)
  - `#events` (with optional `?type=...&city=...&event=evt_123`)
  - `#investments` (with optional `?view=landing|results&category=...&country=...&listing=re_123`)
- Additional interface state (e.g., active filters, drawer openness, scroll position) is mirrored in client storage (`sessionStorage` on web; `AsyncStorage` / app state on mobile).

### 3.2 Refresh Invariants
- **Session Preservation**: While a valid authentication token exists, refreshing must **never** return the user to the splash screen, token check, onboarding, or the default Community tab if they were actively browsing another section.
- **Filter & Search Restoration**: Active search queries, filter pill selections, and sort orders are restored seamlessly.
- **Scroll Position Restoration**: The window or scroll view restores to the previous scroll offset where possible.
- **Inaccessible Resource Fallback**: If a bookmarked or refreshed entity has been deleted or is inaccessible to the current member's permissions, the app displays a non-blocking toast/banner (*"This item is no longer available"*) and gracefully reverts to the parent section.
- **Logout Cleanup**: All user-specific saved interface states are wiped upon explicit logout.

---

## 4. Telegram Integration within Community

### 4.1 Ingestion Architecture
- **Source**: Alexandra and Julia’s designated ÖZARA Telegram channel.
- **Bot Setup**: A dedicated backend Telegram bot added to the channel as an administrator. Credentials (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`) reside strictly in server `.env`.
- **Sync Mechanism**: Supports both incoming webhook updates (`POST /api/telegram/webhook`) and scheduled periodic sync (`tools/sync_telegram_channel.py`).

### 4.2 Content Parsing & Media Albums Grouping
- **Message Types Supported**: Text messages, single photos, single videos, and photo/video albums.
- **Media Album Grouping Invariant**:
  - In Telegram, albums are sent as separate message objects sharing an identical `media_group_id`.
  - The ingestion engine buffers and aggregates messages sharing the same `media_group_id` into a **single unified Community post**.
  - All media items (photos and videos) are stored as ordered attachments in `community_post_media`.
  - The caption from the primary message serves as the post's text.

### 4.3 Language Detection & Entity-Preserving Translation
- **Detection**: The engine inspects the source text/caption to determine if it is non-English (e.g. Russian, French, Spanish, German).
- **Translation Pipeline**:
  - Automatically translates non-English text into English with high fidelity.
  - **Preserved Invariants**: Proper nouns, member names, URLs, calendar dates, check sizes, numerical figures, and currency symbols ($/€/£/AED) must be preserved without loss or distortion.
  - The original untranslated text and detected language are preserved internally (`original_content`, `original_language`) for transparency and admin verification.
- **Scope Limit**: Text and captions are translated; text embedded within images (OCR) and speech in videos are out of scope for this version.

### 4.4 Source Edit Synchronization & Admin Precedence
- **Deduplication**: Posts are indexed by `(telegram_channel_id, telegram_message_id)`.
- **In-Place Updates**: Edits made in the Telegram channel update the corresponding Community post without creating duplicates.
- **Admin Correction Protection**:
  - Administrators can review and manually refine the English translation directly in the app.
  - When an admin corrects a post, `admin_corrected = 1` is set.
  - Subsequent upstream edits in Telegram do **not** overwrite the admin's translation; instead, the system sets `source_modified_after_admin_edit = 1` and flags the post in the admin review queue.

### 4.5 Publishing Pipeline & Failure Resilience
- **Auto-Publishing**: Successfully ingested and translated posts are automatically published (`status = 'published'`).
- **Failure Resilience**: If translation fails or media download is interrupted, the post is saved with `status = 'pending_review'` and held in the admin queue with safe retry.
- **Admin Pause**: Administrators can toggle `auto_publish_enabled = 0` to hold all incoming Telegram posts for manual approval before they appear to members.
- **Manual Deletion / Hide**: Standard Telegram bot updates do not broadcast channel message deletions. Admins are provided with manual "Hide" and "Delete" actions in the ÖZARA interface.

### 4.6 Author Labeling & Attribution
- All imported Telegram posts are labeled **"From ÖZARA"** with an official institutional club badge.
- Author display names from Telegram are translated into verified English names (e.g., `Julia Shchukina | Edeluxe` verified via `iuliiashchukinainvest@gmail.com`, `Alexandra Hill` via `agniyahill@gmail.com`).

### 4.7 Historical Import Staging & Safe Reconciliation Invariant
- **Single Latest Post Selection**: For one-time history imports from Telegram Desktop exports, only the single latest eligible post is staged (`message686`, 8 October 2026).
- **Isolated Staging Table**: Imported records reside exclusively in `telegram_staged_history` and `.tmp/staged_history_posts.json` until reconciled.
- **Zero Dummy IDs**: The system strictly forbids inserting temporary IDs (such as `"-100_history_export"`) into `community_posts`.
- **Reconciliation Gate**: Publishing occurs only after the verified real Telegram group ID is confirmed and reconciled via `tools/import_telegram_html_history.py --reconcile <GROUP_ID>`.

### 4.8 Moving-Forward Ingestion Rules
- **Text & Photo Posts**: Ingestion supports posts with photos OR without photos (text-only posts are fully supported).
- **Strict Video Exclusion**: Posts containing videos, video notes, or animations are strictly skipped and ignored.
- **No Comments or Likes**: The system does not grab, harvest, or synchronize Telegram comments, reactions, or likes.
- **Entity & Author Translation**: Post content and author names are faithfully translated to English while preserving ÖZARA brand equity, numbers, and currencies.

### 4.9 Photo Carousel Invariant
- Multi-photo posts render an interactive photo carousel with Left (‹) and Right (›) navigation arrows, a photo counter badge (`1 / N`), and dot/thumbnail navigation.

---

## 5. Unified Community Feed & Member Participation


### 5.1 Feed View Modes
The top of the Community page includes a segmented filter control:
- **All** (Default): Combined stream of official ÖZARA intelligence and member discussions.
- **From ÖZARA**: Official broadcasts and insights imported from the Telegram channel.
- **From members**: Member questions, expertise, introduction requests, and strategic opportunities.

### 5.2 Member Posting & Content Guardrails
- Admitted members can create posts using the compact composer with optional topic categorization (`Question`, `Introduction`, `Expertise`, `Opportunity`).
- Submissions enforce standard broker-dealer content guardrails: regex keyword flagging against fundraising terms, valuations, returns, and minimum investment figures.

### 5.3 Discussion & Comments
- Members can comment and reply on both imported ÖZARA posts and member posts.
- Comment counts update reactively.
- Clicking an author's name or avatar opens their `ProfileDrawerModal`, preserving the mutual connection approval gate before contact channels are revealed.
