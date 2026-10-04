# SOP 04: Events, Calendar & Targeted Invitations

## 1. Goal & Scope
Defines the event lifecycle, registration flow, targeted invitation filtering, preview count, and deduplication engine.

## 2. Event Entity Structure
- Fields: `id`, `title`, `description`, `chapter_id`, `location`, `start_time`, `end_time`, `capacity`, `registered_count`, `is_published`.
- Visibility: All published events are viewable by verified members.
- Registration states: `registered`, `waitlisted`, `cancelled`.

## 3. Targeted Invitation Engine
- Admins can target specific segments of the membership rather than spamming the whole community.
- **Filter Parameters**:
  - `chapters`: Array of chapter IDs (e.g., `["ch_dubai", "ch_london"]`).
  - `industries`: Array of canonical industry slugs (e.g., `["artificial_intelligence", "fintech"]`).
  - `include_travelers_in_city`: String (e.g., `"Dubai"`), matches members with active travel records spanning the event date.
  - `exclude_past_attendees`: Boolean flag to prioritize first-time attendees.

## 4. Live Preview & Deduplication
- Before dispatching invitations, the system runs a deduplicated query:
  ```sql
  SELECT DISTINCT u.id, u.email, u.full_name
  FROM users u
  LEFT JOIN travel_plans tp ON u.id = tp.user_id
  WHERE ...
  ```
- Returns the exact recipient list and total count.
- Prevents sending duplicate invitations if a user matches multiple filter criteria (e.g. resident in Dubai AND traveling to Dubai).
- Dispatches in-app notification records and outbox log entries.
