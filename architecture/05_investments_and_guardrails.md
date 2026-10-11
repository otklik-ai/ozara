# SOP 05: Curated Investments & Regulatory Content Guardrails

## 1. Goal & Scope
Defines the two top-level investment categories, real estate catalog structure, external data synchronization, project-to-unit mapping, member inquiry handling, and strict regulatory content moderation rules.

## 2. Top-Level Investment Architecture
- **Two Categories**:
  1. **Real Estate**: Active, live, populated with global luxury properties, countryside estates, commercial hubs, and private islands.
  2. **Private Tech Companies**: Displays *"Coming soon"*; zero listings or financial actions active.
- **Provider Confidentiality Invariant**:
  - The external data provider's name is strictly omitted from all user-facing interfaces, labels, and text.
  - Source IDs and sync metadata are retained internally exclusively for maintenance, unit association, and differential synchronization.

## 3. Investment Landing Page & Dynamic Real Estate Categories
- **Landing Page View**:
  - Displays category tiles first, rather than immediately displaying all listings.
  - Category tiles are dynamically computed from the synchronized catalog (`WHERE status = 'published'`), never hardcoded.
  - Categories with zero published listings are automatically removed.
  - New categories (e.g., `Parking`) are automatically detected, given clean English labels, and mapped to corresponding 3D isometric illustrated icons.
  - Consistent fallback 3D isometric architectural icon is used for unfamiliar categories without manual configuration.
  - Equivalent category names are normalized to prevent duplicate tiles.
  - Dynamic categories are computed from the full published catalog; applying search or location filters does not cause category navigation to disappear.
  - If a previously selected category is ever removed, the system switches to `All Properties` with a friendly explanatory message.
  - Failed or incomplete data sync imports must never delete or wipe existing listings or categories.
- **Illustrated Category Tiles**:
  - Dark rounded cards (`#16181d` with subtle `#262930` border) approximately square with consistent dimensions.
  - 3D isometric illustrated icons:
    - Residential: Modern apartment tower (`/investments/icons/residential.png`)
    - Countryside: Villa with lawn and trees (`/investments/icons/countryside.png`)
    - Commercial: Modern glass office complex (`/investments/icons/commercial.png`)
    - Private Islands: Floating tropical island with villa and palms (`/investments/icons/private_islands.png`)
    - Parking: Multi-level covered garage with vehicle (`/investments/icons/parking.png`)
    - Unfamiliar: Modern architectural glass pavilion fallback (`/investments/icons/fallback.png`)
  - Clear English labels and dynamic property counts.
  - On mobile: Arranged in a clean 2-column grid.
- **Private Tech Companies**:
  - Displays *"Private Tech Companies — Coming soon"* card with institutional focus points and zero active listings.

## 4. Category Results Page & Layout
- Clicking a category tile navigates to the Category Results Page with that category pre-selected.
- **Top Filter Bar**:
  - Visible dropdowns for **Country, City, Budget, Bedrooms, Property Type, and Features**, with sorting on the right (`best match`).
  - City dropdown options cascade strictly from selected Country.
  - Property Type dropdown and category tiles are two-way synchronized.
- **Compact Illustrated Category Row**:
  - Displayed immediately below filters as a compact horizontal strip.
  - Highlights active category with subtle background, border, and checkmark (`✓`).
  - Clicking any category tile updates the results and selected category instantly.
  - Includes `All Properties` option and result counts (e.g., "239 properties found").
  - On mobile: Horizontal scroll without breaking page layout.
- **Navigation & Reset**:
  - Clear "← Back to Categories" action to return to the landing page.
  - "Clear filters" action to reset all criteria.

## 5. Compact Listing Grid & Photo Carousel
- **Centered Content Area**: Max-width ~1240px with generous margins.
- **Responsive Card Columns**:
  - 3 cards per row on large desktops.
  - 2 cards per row on tablets.
  - 1 card per row on mobile phones.
- **Card Standards & 4:3 Image Ratio**:
  - Images use a fixed 4:3 landscape ratio with balanced cropping (`object-fit: cover`) and zero stretching.
  - Location tag, bold clean title, key specifications line, price with currency, circular save/bookmark button, and Details button.
- **Browse Photos Directly on Cards**:
  - Subtle left (`‹`) and right (`›`) navigation arrows over image.
  - Touch swiping on mobile.
  - Translucent photo counter pill (`📷 1 / 12`).
  - Arrows and swiping navigate photos without triggering card click or opening modal (`stopPropagation`).
  - Arrows hidden for single-photo listings.
  - Image dimensions remain strictly fixed during photo switching.
- **State Restoration & Persistence**:
  - Refreshing restores current page (landing vs results), selected category, active filters, sorting, and scroll position via `sessionStorage` and URL hash.

## 5. Currency Handling & Price Integrity
- Original prices and currencies are preserved exactly as provided by developers.
- Supported and verified currencies: `USD`, `AED`, `EUR`, `QAR`, `GBP`, `TRY`, `SAR`, `GEL`, `AUD`.
- Numeric price fields are verified against their designated currency without assumptions of USD.
- Missing values remain explicitly unspecified rather than defaulting to zero.
- Standard disclaimer displayed: *"Price and availability subject to confirmation."* and *"Updated [timestamp]"*.

## 6. Daily Synchronization & Failure Recovery
- **Scheduled Synchronization**:
  - Runs once daily at configurable timing (e.g., 04:00 UTC).
  - Configurable toggle (`INVESTMENTS_SYNC_ENABLED=true/false`) allows activation once upstream permissions are established.
  - Paginated retrieval iterates until all catalog records are retrieved (`has_more = false`).
  - Upserts existing records, inserts newly published listings.
- **Archival Protection**:
  - Listings are archived or marked withdrawn only after a confirmed, fully successful sync run or an explicit source status flag.
  - If a network or upstream request fails mid-sync, the system retains the last successful catalog data without destructive deletions and logs an admin alert.
- **Sync Audit Logging**:
  - Records execution start/finish timestamps, total items imported, units fetched, status, and error logs in `investment_sync_logs`.
  - Admin-only *"Sync now"* action enables manual triggers with live status reporting.

## 7. Inquiry Handling & Team Routing
- Primary member action: **"Request details"**.
- Does NOT provide checkout or automated payment processing.
- Automatically routes inquiries to designated ÖZARA asset leads (`iuliiashchukinainvest@gmail.com` and `ermolov.elena@gmail.com`).
- Server validates that the member has accepted the current Access Conditions (`2026-10-v1`) before logging the inquiry.

## 8. Durable Media Storage & Image Reliability Pipeline
- **Zero Ephemeral Dependency Invariant**:
  - Catalog photos must never rely on hotlinking temporary source URLs, browser caches, or local developer Mac files.
  - Authorized catalog photos are downloaded during synchronization, validated, and persisted into durable object/volume storage under `storage/catalog/`.
- **Dual-Variant Image Pipeline**:
  - `storage/catalog/cards/{id}_{idx}.webp`: Optimized 4:3 card view (640x480, WebP, quality 85, ~40-60KB).
  - `storage/catalog/full/{id}_{idx}.webp`: High-resolution gallery detail view (up to 1600x1200, WebP, quality 90).
  - `storage/catalog/thumb/{id}_{idx}.webp`: Gallery thumbnail strip view (160x120, WebP).
  - `manifest.json`: Tracks source URLs, SHA256 checksums, dimensions, file sizes, and sync statuses.
- **Validation & Failure Recovery**:
  - Every downloaded file is validated (non-zero bytes, valid image header, dimensions > 100px) before being marked ready.
  - If upstream server is unreachable or download fails, the engine retains the last working images without deletion.
  - When upstream host is down and no prior image exists, the backfill engine attaches a coherent set of verified high-resolution luxury architectural photos specifically matched to the listing's category, geography, and style.
  - Photo ordering is strictly preserved (`0, 1, 2, ...`); deduplication prevents redundant files.
- **Cacheable Delivery Layer**:
  - Endpoint: `GET /api/media/catalog/:id/:variant/:filename`
  - Response headers: `Cache-Control: public, max-age=31536000, immutable`, ETag, 304 Not Modified support.
- **Access Control Isolation**:
  - Catalog real estate photos are public luxury assets served with high-performance public cache headers.
  - Member profiles, private attachments, and Telegram community media remain strictly protected behind authenticated member session validation (`/storage/telegram_media/`, `/api/community/media/`).

## 9. Smooth Mobile Photo Browsing Invariants
- **High-Performance Image Component**:
  - Implemented using `expo-image` (`Image` from `'expo-image'`) for hardware-accelerated decoding and memory-disk caching.
- **Seamless Crossfade & Zero Black Flashes**:
  - Uses `transition={200}` to keep the current image rendered until the next photo has fully buffered.
- **Adjacent Photo Preloading**:
  - When a listing card enters viewport or photo index changes, the engine proactively preloads adjacent photos (`curIndex + 1`, `curIndex - 1`) via `Image.prefetch(resolveImageUrl(nextPhoto))`.
- **Layout Stability & States**:
  - Fixed 4:3 aspect ratio (`aspectRatio: 4 / 3`) prevents layout shift across all viewports.
  - Elegant loading indicator while initial image buffers.
  - Graceful error fallback state with "Tap to retry" button allowing instant reload upon transient network failures.

## 10. Always-Available Hosted Staging Environment
- **Single Unified Mobile Frontend**:
  - The React Native / Expo application in `mobile/` is the canonical iOS application and web preview.
  - Built via `npx expo export --platform web` to produce static assets in `mobile/dist/`, served directly by the backend.
- **Persistent Cloud Hosting Architecture**:
  - Independent 24/7 cloud deployment (Docker / Fly.io / Render / Railway) with persistent disk volume mounted for SQLite (`/app/data`) and media (`/app/storage`).
  - Automated nightly backups of SQLite database snapshots.
  - Server-side environment secrets (`APP_SECRET`, credentials).
- **Staging Data Isolation & Test Email Suppression**:
  - Runs in `NODE_ENV=staging`.
  - Staging and test accounts (`is_test = 1` or test runs) are suppressed from sending live emails to real members; outbox logs to console/developer test mailbox.
- **Version Control & Release Pipeline**:
  - Deployments connect to `origin main` on GitHub. Reviewed commits trigger automated rebuild and deployment without manual intervention.

## 11. Strict Regulatory Boundaries & Invariants
- **No Automated Execution**: The platform strictly DOES NOT process funds transfers, escrow deposits, tokenized securities, or transaction-based commission calculations.
- **No Financial Advice**: Clear disclaimer displayed on all listing pages:
  *"This listing is provided for informational purposes among vetted community members and does not constitute investment advice, a financial promotion, or an offer of securities."*
- **Content Moderation & Prohibited Terms Validator**:
  - Prohibits promises of guaranteed returns, explicit company valuations, or fixed check sizes in inquiry free-text.
