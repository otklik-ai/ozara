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
5. **Request Access Protocol**:
   - Prospective members without an invite submit a short form:
     - Full Name
     - Email (Business)
     - LinkedIn URL or a short professional background
     - "What brings you to ÖZARA?"
   - No SMS verification, Face ID, or identity checks required to submit. Submitting does not grant membership.
   - Stored in admin dashboard for Alexandra and Julia to review.
   - Confirmation on submission: *"Your request has been received. Our team will review it and contact you by email if approved."*
6. **Admin Invitation Management**:
   - Admins can generate unique, single-use invitations with configurable expiration dates.
   - Admins can review access requests and either **Approve** (generating and emailing an official token) or **Decline**.
   - Admins can **Revoke** unused invitations.
7. **Access Control & Investment Separation**:
   - Unapproved visitors cannot access private profiles, posts, member event details, or investment documents through direct links or API calls.
   - Community membership and investment eligibility are strictly separated: accredited investor verification and regulatory checks are enforced independently.
