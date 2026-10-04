# SOP 05: Curated Investments & Regulatory Content Guardrails

## 1. Goal & Scope
Defines the real estate listing presentation, inquiry handling, and strict regulatory content moderation rules.

## 2. Real Estate Listings
- Admin-created and verified only.
- Fields: `id`, `title`, `short_summary`, `location`, `property_type`, `status`, `images`, `brochure_document_url`, `disclaimer`, `created_by`.
- Purpose: Showcase off-market or high-yield real estate opportunities to members.
- Member Actions:
  - `Request Details / Brochure`: Sends brochure download link and registers lead.
  - `Request a Call`: Initiates an inquiry ticket to discuss property specifics with the team or listing representative.

## 3. Strict Regulatory Boundaries & Invariants
- **No Automated Execution**: The platform strictly DOES NOT process funds transfers, escrow deposits, tokenized securities, or transaction-based commission calculations.
- **No Financial Advice**: Clear disclaimer displayed on all listing pages:
  *"This listing is provided for informational purposes among vetted community members and does not constitute investment advice, a financial promotion, or an offer of securities."*

## 4. Content Moderation & Prohibited Terms Validator
- Client-side guidance rendered beneath all free-text input areas:
  *"Please refrain from posting specific fundraising terms, guaranteed return promises, company valuations, or minimum investment check sizes."*
- Backend validation filter checks free-text submissions against prohibited regex patterns:
  - Promised returns (e.g., `guaranteed \d+% return`, `risk-free profit`)
  - Explicit valuation claims (e.g., `valued at \$\d+M`, `pre-money valuation`)
  - Check size mandates (e.g., `minimum check \$?[\d,]+`)
- If flagged:
  - System flags profile or inquiry for admin review before publication.
  - Member receives an educational prompt to adjust their wording.

## 5. Access Conditions Acceptance & Server-Side Enforcement
- **Platform Invariant**: Accepting community membership does NOT grant automatic access to investments.
- **Acceptance Tracking**:
  - The platform tracks `accepted_access_conditions_version` and `accepted_access_conditions_at` on every user record.
  - Active version: `2026-10-v1`.
- **Server-Side Enforcement**:
  - `POST /api/listings/:id/inquire` checks if the requesting member has accepted the active version.
  - If null or outdated: Server responds with HTTP 403 Forbidden (`{ error: "Access Conditions acceptance required", code: "CONDITIONS_NOT_ACCEPTED", required_version: "2026-10-v1" }`).
  - Client prompts user to review and accept the latest Access Conditions before continuing.
- **Configurable Opportunity Eligibility**:
  - Each opportunity defines `eligibility_requirements` (e.g. investor status verification, jurisdiction restrictions, and required conditions version) stored on the listing record and validated on access.
