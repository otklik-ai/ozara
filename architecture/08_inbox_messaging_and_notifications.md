# SOP 08: Inbox, Member Messaging, Email Notifications & Admin Activity

## 1. Goal & Scope
Defines the complete architecture for the ÖZARA member Inbox, one-to-one direct messaging, in-app notifications, transactional email delivery engine with luxury HTML templates and message debouncing/throttling, granular notification preferences, and the unified Admin Activity system.

---

## 2. In-App Inbox Architecture

### 2.1 Navigation & Placement
- An **Inbox icon** with an unread badge is located in the top navigation bar across both desktop web (`public/index.html`) and mobile (`OzaraHeader.tsx`).
- The unread badge displays the sum of unread direct messages and unread in-app notifications. When count is 0, the badge is gracefully hidden.
- Clicking/tapping the Inbox icon opens a dedicated modal/drawer.

### 2.2 Tab Organization
- **Regular Members**:
  - **Messages**: Direct 1-to-1 conversations with mutually accepted connections and club leadership.
  - **Notifications**: Structured notifications for connection requests, accepted connections, admin announcements, event invitations/updates, and community posts.
  - **Preferences**: Modal accessible via header gear icon to customize email and in-app frequency.
- **Administrators & Founders** (Alexandra, Julia, Elena):
  - In addition to Messages and Notifications, admins receive the **Admin Activity** tab displaying club-wide operational events.

---

## 3. Direct Member Messaging & Permissions

### 3.1 Mutual Connection Gate
- Direct messaging is strictly restricted to **mutually accepted connections** (`member_connections.status = 'accepted'`) OR direct outreach initiated by club administrators/founders (`role IN ('FOUNDER', 'ADMIN')`).
- Unaccepted users, pending requesters, or unadmitted applicants attempting to send a message receive HTTP 403 Forbidden (`MUTUAL_CONNECTION_REQUIRED`).

### 3.2 Block & Report Controls
- Members can block another member at any time via the conversation header menu.
- A blocked user cannot send messages to the blocker (HTTP 403 `USER_BLOCKED`).
- Members can report inappropriate behavior or solicitation directly from the conversation header ("Report to Club Committee"). Reports are recorded in `profile_reports` and routed to the Admin Activity feed.

### 3.3 Strict Content Confidentiality
- Message contents are visible **strictly to conversation participants**.
- Admin activity logs, audit logs, and search endpoints never store or expose message body text.
- Operational logs record only that communication occurred between participants (e.g., `Direct message sent between Member A and Member B`).

---

## 4. Notifications Engine & Action Resolution

### 4.1 Notification Types & Actions
1. **Connection Requests (`connection_request`)**:
   - Displays requester avatar, name, headline, and optional note.
   - Includes inline **Accept** and **Decline** action buttons directly on the notification card.
2. **Connection Accepted (`connection_accepted`)**:
   - Notifies requester that their connection was approved.
   - Action opens conversation or member profile.
3. **Private Message Alert (`direct_message`)**:
   - "You have a new message from [Name]".
   - Action opens the specific conversation in the Messages tab.
4. **Admin Announcements (`announcement` / `admin_message`)**:
   - Institutional badge "From ÖZARA Leadership".
   - Displays announcement title and message.
5. **Event Invitations & Updates (`event_invitation`, `event_update`, `event_published`)**:
   - Displays event destination, dates, and title.
   - Action opens the dedicated Event Detail Modal.
6. **Community Post Alerts (`community_post`)**:
   - Displays post author and snippet.
   - Action navigates to the Community feed.

### 4.2 Auto-Read & Resolution
- Tapping/clicking an actionable item marks the notification `is_read = 1`.
- "Mark all as read" button marks all active notifications as read.

---

## 5. Transactional Email Delivery Engine & Throttling

### 5.1 Luxury ÖZARA-Branded HTML Email Template
- Dark luxury aesthetic: Midnight Navy canvas (`#0B1020`), graphite container (`#141926`), fine silver borders (`#222a3d`), crisp white typography (`Plus Jakarta Sans` / `Inter`), violet call-to-action button (`#7C3AED`), and official ÖZARA wordmark header.
- Discreet footer with confidentiality notice and notification preference links.

### 5.2 Private Message Email Invariant
- **Strict Privacy Rule**: The body of private messages is **NEVER** included in transactional email notifications.
- Email Subject: `New message from [Sender Name] on ÖZARA`
- Email Body: `"You have a new message from [Sender Name]. Log in to your ÖZARA Inbox to read and reply."`
- CTA Button: `"Open Conversation"`

### 5.3 Message Email Throttling & Grouping
- To prevent spamming member inboxes during active chat conversations, repeated unread-message alerts within the same conversation are debounced.
- If an unread message email was already dispatched for that conversation within the last 15 minutes, subsequent line-by-line messages do not trigger duplicate emails.
- Once the recipient opens the conversation or after the 15-minute window expires, subsequent messages can trigger a new alert.

### 5.4 Granular User Preferences
- `email_direct_messages`: `immediate`, `never`
- `email_connection_requests`: `immediate`, `never`
- `email_new_posts`: `immediate`, `daily_digest`, `never`
- `email_new_events`: `immediate`, `daily_digest`, `never`
- `email_event_invites`: `immediate`, `never`
- `email_admin_activity`: `immediate`, `daily_digest`, `never`
- Disabling email **never** disables the corresponding in-app notification.

### 5.5 Queueing, Idempotency & Retries
- Every outgoing email is staged in `email_delivery_queue` with a unique `idempotency_key` (e.g. `msg_${messageId}`, `notif_${notificationId}`) to guarantee zero duplicate sends.
- Temporary delivery failures are retried up to 3 times with exponential backoff.
- Delivery status (`sent`, `suppressed`, `failed`) is recorded along with timestamps and error codes, with zero sensitive message body logged.

### 5.6 Sandbox & Test Environment Safety
- Automated test suites, test accounts (`is_test = 1`), and non-production domains (`@example.com`, etc.) are intercepted by `isSuppressedEmail()`.
- Suppressed emails are recorded in the database queue as `status = 'suppressed'` and surfaced to developers/admins via `GET /api/inbox/test-mailbox` for end-to-end verification without hitting real SMTP endpoints.

---

## 6. Shared Admin Activity System

### 6.1 Event Coverage
The unified `admin_activity_log` tracks high-value operational actions:
1. `access_request`: Prospective member requested invitation.
2. `completed_onboarding`: Member registered or completed Question 18 profile requirement.
3. `connection_requested` & `connection_accepted`: Members connecting.
4. `community_post` & `community_comment`: New community activity.
5. `rsvp_confirmed` & `rsvp_cancelled`: Member RSVP modifications.
6. `investment_inquiry`: Real estate catalog information or call requests.
7. `report_filed`: Member profile or conduct reports.
8. `integration_failure`: Telegram sync errors, SMTP failures, or catalog sync issues.

### 6.2 Deduplication & Coordination
- Single shared database table `admin_activity_log` prevents duplicate records across admin tooling.
- Helper function `recordAdminActivity(...)` is invoked deterministically at the exact execution points where business logic completes.
