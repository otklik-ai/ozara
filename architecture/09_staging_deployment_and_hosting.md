# SOP 09: Always-Available Hosted Staging & Deployment Architecture

## 1. Goal & Architecture
Defines the deployment and release pipeline for ÖZARA's 24/7 hosted staging environment, running independently of developer hardware and local Wi-Fi.

## 2. Canonical Frontend Alignment
- **Single Source of Truth**: The React Native / Expo application in `mobile/` (`com.silasvyazei.app`) is the canonical frontend for iOS TestFlight and web browser previews.
- **Web Export Parity**: Built via `npx expo export --platform web` into `mobile/dist/`, served directly by the backend at `/app` or root `/`.
- **Zero Drift Guarantee**: Any enhancement made to the UI is built directly in `mobile/`, eliminating divergence between desktop browser previews and the native mobile app.

## 3. Durable Storage & Image Pipeline
- **Catalog Media Storage**: Persisted under `storage/catalog/` (`cards/`, `full/`, `thumb/`) on a persistent volume (`/app/data` or `/app/storage`).
- **Cacheable Delivery Layer**: `GET /api/media/catalog/:id/:variant/:filename` served with `Cache-Control: public, max-age=31536000, immutable`, ETag, and 304 Not Modified.
- **Private Media Isolation**: Private member media (`/storage/telegram_media/`, `/api/community/media/`) strictly gated behind `validateSession(req)`.
- **Failure Recovery**: Synchronizer retains last working images; backfills missing assets using verified high-resolution luxury architectural collections.

## 4. Staging Safety & Test Email Suppression
- Runs in `NODE_ENV=staging`.
- Staging test actions strictly suppress outbound emails to non-admin member addresses.
- All outbound messages outside approved admin inboxes (`FOUNDER_EMAILS`, `ADMIN_CONTACT_EMAILS`) are logged to `.tmp/outbox.log` and accessible via `GET /api/inbox/test-mailbox`.

## 5. Deployment Options & Cost Breakdown

| Hosting Option | Compute | Persistent Storage | SSL & CDN | Monthly Cost | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Render Starter** (Recommended) | 0.5 CPU, 512MB RAM ($7/mo) | 10 GB Persistent Disk ($2.50/mo) | Free automated HTTPS & global CDN | **$9.50 / month** | Turnkey GitHub auto-deploy, zero config |
| **Fly.io** | Shared-cpu-1x, 512MB RAM ($2/mo) | 5 GB Volume ($0.75/mo) | Free automated HTTPS | **$2.75 / month** (or free tier) | Low latency, global edge |
| **Railway** | Usage-based vCPU & RAM | Persistent Volume ($0.25/GB) | Free HTTPS | **~$5.00 / month** | Instant setup |
| **Cloudflare R2** (Optional object store) | S3-compatible API | Free first 10 GB, zero egress fees | Global Cloudflare CDN | **$0.00 / month** | Scale beyond 10,000 photos |

*Note: Paid services must not be activated until approved by user.*

## 6. Version Control & Release Process
1. Commit and push reviewed changes to GitHub:
   ```bash
   git push origin main
   ```
2. Connected platform (Render or Fly.io) detects push to `main`:
   - Builds container from `Dockerfile`.
   - Exports latest mobile web bundle via `npx expo export --platform web`.
   - Mounts persistent volume with existing SQLite database and media.
   - Deploys container with zero downtime.
3. Access preview at designated client URL (e.g. `https://ozara-staging.onrender.com/app`).
