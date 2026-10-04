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
