# SOP 06: Invitation Gate, Pre-Verification Checking & Access Approval

## 1. Goal & Scope
Defines the private club onboarding and invitation protocol for ÖZARA. Membership is strictly invite-only. New prospective members must validate an invitation code *before* entering phone verification. Uninvited prospective members submit an access request reviewed by ÖZARA leadership (Alexandra Hill: `agniyahill@gmail.com`, Julia Shchukina: `iuliiashchukinainvest@gmail.com`, and Elena Ermolov: `ermolov.elena@gmail.com`). Existing members sign in directly without an invitation code.

## 2. Invariants & Rules
1. **Invitation-First Onboarding Flow**:
   - New members must enter and validate their invitation code on the server *before* proceeding to phone verification.
   - Sequence:
     1. Introduction screens (Events, Network, Invest)
     2. Invitation screen (`/invitation`): validates code on server
     3. Phone verification flow (`PhoneAuthScreen`): verifies phone ownership via SMS OTP
     4. Optional Face ID setup (`FaceIdSetupScreen`): genuine device authentication (Face ID / Touch ID / WebAuthn passkey); auto-skipped if unsupported; carries biometric preference
     5. Welcome / Create account (`CreateAccountScreen`): minimalist layout with underlined Full name and Email inputs, inline validation, clickable dedicated Terms & Conditions and Privacy Policy links, and primary "Create account" button
     6. Token redemption & Account creation: server atomically redeems single-use invitation token, registers member with verified phone and terms version, and activates biometric preference
     7. Member profile setup (`SignUpScreen` questionnaire page): 30 canonical questions (Q18 required for completion, Q23 permanently private)
     8. Investment Access Conditions: strictly separated from account creation; enforced when accessing restricted real estate opportunities or submitting inquiries
2. **Entry Points & Navigation**:
   - Discreet "Have an invitation?" link appears on all three introduction screens (Events, Network, Invest) and routes immediately to the Invitation screen.
   - Screen 1 (Events) & Screen 2 (Network): Primary button is "Next" to advance to the next slide.
   - Screen 3 (Invest): Primary button is "Get started" and opens the Invitation screen.
   - "Already a member? Sign in" remains a distinct, separate route opening phone verification directly for admitted members without requiring an invitation.
   - "Intro" button remains connected to the admin contact panel modal across all slides.
   - Back navigation returns to the exact introduction slide left behind without replaying the splash animation.
3. **Face ID Setup Invariants**:
   - Background: ÖZARA navy (`#0B1020`), white typography (`Plus Jakarta Sans`), violet accents (`#7C3AED`).
   - Minimal layout with generous spacing and simple outline illustration combining a lock and facial recognition brackets.
   - Headline: "A familiar face. Secure access."
   - Description: "Use Face ID to unlock ÖZARA on this device." (dynamically adapts label to Touch ID or Biometrics where appropriate).
   - Primary button: "Use Face ID"; Secondary option: "Skip".
   - Genuine device authentication: native `expo-local-authentication` and WebAuthn platform authenticators on web. If biometrics are unsupported on the current device/browser, automatically skip this screen to Welcome / Create Account.
   - If cancelled or failed, allow retrying or skipping.
   - No separate ÖZARA PIN is used. Biometric preference is activated securely once the account is created.
4. **Welcome / Create Account Invariants**:
   - Small header: "Create account". Headline: "Welcome to ÖZARA". Description: "Your next chapter starts here."
   - Only two fields: Full name and Email. Simple underlined inputs with clear labels, autofill, and appropriate keyboards.
   - Email is pre-populated from the validated invitation token and locked to the 1:1 bound address.
   - Bottom legal agreement copy: "By creating an account, you agree to our Terms & Conditions and acknowledge our Privacy Policy."
   - "Terms & Conditions" and "Privacy Policy" are separate clickable violet links opening readable modals without altering form state.
   - Dedicated ÖZARA legal content configurable from server, separate from investment Access Conditions.
   - Primary button: "Create account", disabled until both inputs are valid, duplicate submission prevention, loading spinner, and clear error banners.
   - Atomically redeems validated invitation token and records accepted Terms version (`2026-10-v1`) and timestamp upon success.
   - Proceeds directly to member profile setup, preserving state across navigation and app backgrounding.
5. **Invitation Validation & Error States**:
   - The server validates the invitation token *before* allowing phone verification.
   - Distinct error feedback:
     - **Invalid**: "Invalid invitation code. Please check and try again."
     - **Expired**: "This invitation has expired. Please request a new invitation."
     - **Revoked**: "This invitation has been revoked."
     - **Already used**: "This invitation code has already been used."
   - Primary "Continue" button is disabled while server check is in flight.
   - Deep-linked invitation codes populate automatically.
   - Valid invitation token and identity are preserved throughout registration.
4. **Token Claim & Concurrency Guard**:
   - The invitation is checked before phone verification, but redeemed (marked claimed) *only after registration succeeds*.
   - Server-side atomic lock (`UPDATE ... WHERE id = ? AND is_claimed = 0 AND status = 'approved'`) prevents simultaneous attempts or multiple accounts from using the same single-use invitation.
5. **Request Access Protocol & Existing-Email States**:
   - Prospective members without an invite submit a short form:
     - Full Name
     - Email (Business)
     - LinkedIn URL or a short professional background
   - No SMS verification, Face ID, or identity checks required to submit. Submitting does not grant membership.
   - **Pre-Submission Status Check & Existing-Email States**:
     Before creating a new access request, the system checks existing account and request status (emails trimmed and matched case-insensitively). Active account status takes strict priority over older request statuses:
     1. **Pending Request**:
        - Condition: Email already has a request awaiting approval (`status = 'pending_admin_approval'`).
        - Title: “Your request is received”
        - Message: “Our hosts will be in touch by email.”
        - Action: Primary button “Got it” dismisses the message. Does not create duplicate requests or resend notifications.
     2. **Existing Account**:
        - Condition: Email belongs to an active member (`users.is_admitted = 1`).
        - Title: “You’re already in the circle”
        - Message: “Sign in to your ÖZARA account.”
        - Action: Primary button “Sign in” opens the existing sign-in screen with the email prefilled. Does not create a new account or request.
     3. **Declined Request**:
        - Condition: Email has a request reviewed and declined (`status = 'declined'`).
        - Title: “Not this time”
        - Message: “We’re unable to offer an invitation at this time.”
        - Action: Primary button “Close” dismisses the message. Does not create a request or alter status.
   - **Duplicate Prevention & Resilience**:
     - Both UI and backend strictly enforce duplicate prevention (`POST /api/invitations/check-email-status` and `POST /api/invitations/request-access`).
     - Submissions are disabled during checking to prevent repeated taps.
     - If the status check fails (network/server error), a retry message is shown; the email is never treated as new.
     - New emails continue the standard flow and show confirmation: *"Your request has been received. Our team will review it and contact you by email if approved."*
   - Stored in admin dashboard for Alexandra and Julia to review.
6. **Admin Invitation Management & Membership Tier Selection**:
   - Admins can generate unique, single-use invitations with configurable expiration dates.
   - **Membership Request Review Flow**:
     - Admin notification emails are sent with subject format: `New request to join ÖZARA from ${cleanName || 'Candidate'}`.
       - Heading: `Membership request`
       - Intro: `${cleanName} would like to join ÖZARA.`
       - Applicant details prominent, with email and submitted details beneath.
       - Button: `Review request` linking to the secure admin review page (`/api/admin/invitations/review?requestId=${id}&adminEmail=${adminEmail}`).
     - **Applicant Confirmation Email**:
       - Sender name: `ÖZARA`
       - Subject: `Your request to join ÖZARA`
       - Brand header: `ÖZARA` compact wordmark
       - Heading: `Your request is received`
       - Body: `Hi {First name},\n\nThank you for your interest in ÖZARA. Our hosts will review your request and be in touch by email.`
       - Sign-off: `The ÖZARA team` (no button needed)
     - **Admin Review Page**:
       - Uses the same clean, light aesthetic (`#f8fafc` / `#ffffff`) with generous whitespace and compact ÖZARA wordmark.
       - Applicant details are presented prominently first (name, email, background, notes).
       - Before approving, the admin must choose between two mutually exclusive options:
         - **Paid membership** — a subscription is required.
         - **Complimentary membership** — free access, granted at the admin’s discretion.
       - Neither option is selected by default.
       - Actions:
         - **Approve**: Persists the selected `membership_tier` ('paid' or 'complimentary'), generates the official 1:1 token (`OZARA-xxxx-xxxx`), and emails the applicant. Approving is disabled/prevented until one of the two options is explicitly selected.
         - **Decline**: Declines the request (`status = 'declined'`) without requiring a membership option selection.
     - **Shared Design Guidelines**:
       - Clean, light background (`#f8fafc`) with generous whitespace.
       - Compact ÖZARA wordmark instead of oversized banners.
       - Dark body text and restrained accents.
       - Clear typography, subtle dividers, single-column mobile-friendly layout.
       - Removed heavy dark containers, bright blue headings, and outdated slogans.
   - **Member Account Storage & Admin-Only Visibility/Editing**:
     - The membership tier is persisted on the member's account (`users.membership_tier` and `users.subscription_status`).
     - This setting is strictly visible and editable to administrators only (`FOUNDER` or `ADMIN` roles). Non-admin members cannot view or modify membership tier metadata.
     - Admins can update a member's tier via `PATCH /api/admin/members/:id/membership-tier`.
   - **Onboarding Subscription Enforcement**:
     - **Paid members**: Must complete subscription payment during onboarding before accessing member features (`tabs`). Their `subscription_status` starts as `'pending_payment'` and changes to `'active'` upon completing subscription payment.
     - **Complimentary members**: Skip subscription payment completely and receive active access (`subscription_status = 'active'`) immediately upon completing onboarding.
   - Admins can **Revoke** unused invitations.

7. **Access Control & Investment Separation**:
   - Unapproved visitors cannot access private profiles, posts, member event details, or investment documents through direct links or API calls.
   - Community membership and investment eligibility are strictly separated: accredited investor verification and regulatory checks are enforced independently.

