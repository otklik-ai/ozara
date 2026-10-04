# SOP 03: Explainable Matching, Networking & Introduction Queues

## 1. Goal & Scope
Defines the matchmaking algorithm, plain-language rationale generator, contact preference routing, call scheduling, and admin introduction queue.

## 2. Matchmaking Algorithm
- **Objective**: Connect members whose stated needs intersect with another member's verified offers or expertise.
- **Scoring Weights**:
  - `Needs ↔ Offers / Expertise Match`: 50%
  - `Shared Industry / Sector`: 20%
  - `Geographic Alignment` (Same chapter OR overlapping active travel): 15%
  - `Shared Interests / Affiliations`: 15%
- **Strict Invariants**:
  - Private answers (including Question 23) must NEVER be parsed or ingested by the scoring engine.
  - Expired travel plans must not provide geographic alignment boosts.
  - Members are NEVER ranked or sorted by investor suitability, net worth, or investment capacity.

## 3. Plain-Language Explainability Generator
Every recommended match card must provide a concise, deterministic explanation in plain English:
- *Template*: `"Matches your need for [{matched_need}] with {target_name}'s verified {category} in [{matched_offer}], both in [{shared_location}]."`
- *Example*: `"Matches your need for [Cross-Border Logistics] with Alex's verified expertise in [GCC Freight & Customs], and both are active in the [Dubai] chapter."`

## 4. Contact Preference Routing
- `direct_contact`: UI reveals direct "Request a Call" or "Send Message" triggers.
- `through_team`: Direct messaging is disabled; action routes to an "Ask the Team" modal.
- `unavailable`: UI displays a polite notice indicating the member is currently not taking meetings.

## 5. "Ask the Team for an Introduction" Workflow
- When a search query yields no matches or a target member's preference is `through_team`, the member can submit an introduction ticket.
- Ticket enters `intro_requests` table with status `pending_admin_review`.
- Notification dispatched to Alexandra and Julia.
- Admins can review the requester's context, accept/facilitate the introduction, or provide feedback with resolution notes.

## 6. Call Scheduling Protocol
- Members can propose up to 3 candidate time slots with explicit timezone identification.
- Recipient can Accept (selecting 1 slot), Propose New Times, or Decline with an optional note.
- Meeting link (Zoom, Google Meet, Telegram) is provided manually by the proposer or recipient upon confirmation.
