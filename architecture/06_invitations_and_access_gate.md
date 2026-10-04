# SOP 06: Invitation Gate, 1:1 Email-Token Mapping & Access Approval

## 1. Goal & Scope
Defines the private club invitation protocol for ÖZARA. Membership is strictly invite-only. Uninvited prospective members must request access, which is routed to ÖZARA leadership (Elena Ermolov: `ermolov.elena@gmail.com`, and co-founders Alexandra Hill & Julia Shchukina) for manual review. Once approved, a unique single-use token bound 1:1 to the applicant's email is dispatched, unlocking registration with that pre-populated email.

## 2. Invariants & Rules
1. **1:1 Email to Token Invariant**:
   - Each invitation token is bound uniquely to exactly one email address (`email TEXT UNIQUE NOT NULL`).
   - Entering an invitation token unambiguously identifies the invited email address.
   - The registration form MUST pre-populate and lock the verified email so that the user cannot claim someone else's token under a different email.
2. **Access Request Protocol**:
   - Prospective members without a token submit an access request providing: Full Name, Business Email, Professional Headline, and optional Note.
   - Status is recorded as `pending_admin_approval`.
   - An email notification is dispatched to ÖZARA admins (`ermolov.elena@gmail.com`, `agniyahill@gmail.com`, `iuliiashchukinainvest@gmail.com`).
3. **Admin Approval & Token Issuance**:
   - Only administrators with the `FOUNDER` role (e.g. Elena Ermolov) can approve access requests.
   - Upon approval:
     1. Status transitions to `approved`.
     2. An algorithmic, elegant token is generated (e.g. `OZARA-XXXX-XXXX`).
     3. An invitation email containing the token is dispatched to the applicant.
     4. `approved_by` and `approved_at` timestamps are recorded.
4. **Email-Delivered Token Entry Invariant**:
   - The unique 1:1 token is dispatched strictly via email to the applicant.
   - The user returns to the app and enters the token from their email into the invitation token input field.
   - The app does not auto-reveal or bypass token insertion; the user must insert the token received in their email to verify and proceed.
5. **Non-Blocking Access Request UX**:
   - Submitting an access request must NOT lock the user into an indefinite circling/waiting screen.
   - Upon submission, the app immediately redirects to the token insertion page (`check_token`) with a persistent confirmation banner displaying the submitted email and notification recipient (`ermolov.elena@gmail.com`).
   - Background polling on `check_token` detects when the admin approves the request and updates the banner to notify the user that their code has been emailed to them, prompting them to insert it into the field below.
6. **Session & Onboarding State Resumption**:
   - The user's active stage (`appView`, `signup_step`, `conditions_agreed`, `pending_email`, `current_user_id`) is stored in persistent storage (`mobile/src/services/storage.ts`).
   - Reopening or reloading the app resumes directly at the user's last active spot, bypassing intro animations and previously acknowledged legal modals.
7. **Token Claim & Invalidation**:
   - When registration completes, the token status transitions to `claimed` with `claimed_by` and `claimed_at`.
   - Claimed tokens cannot be re-used.
