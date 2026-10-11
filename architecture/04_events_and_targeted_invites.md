# SOP 04: Events, Calendar & Targeted Invitations

## 1. Goal & Scope
Defines the event lifecycle, chronological calendar presentation, registration flow, data integrity rules, targeted invitation filtering, preview count, and personal calendar integration (.ics).

## 2. Chronological Calendar & Presentation Hierarchy
- **Chronological Ordering**: All events sorted strictly chronologically, with the nearest upcoming event first.
- **Grouping**: Grouped by Year (e.g., 2026, 2027) and Month.
- **Date Block**: Dedicated date block on the left (prominent day range, month, and duration); event content on the right. Responsively stacks on narrow viewports.
- **Highlighting**: The next immediate upcoming event is prominently highlighted with a distinguished spotlight badge.
- **Sections**:
  1. Highlighted Next Upcoming Event
  2. Confirmed Dated Events (grouped by year and month)
  3. "Dates to Be Announced" section (for events without confirmed dates)
  4. "Past Events Archive" (dedicated tab/toggle for past events)

## 3. Data Integrity & Prohibited Fabrication
- **Strict Data Integrity**: Never invent missing information. Display "To be announced" or "To be confirmed" for unknown fields.
- **No Fabricated Availability**: Do not invent remaining spots, exact venues, or prices. If capacity or price is unconfirmed, store and display as "To be confirmed".
- **Date Precision**: Events with only a month (e.g. May 2027, June 2027) must display that month without inventing exact calendar days. Events with unconfirmed dates appear in the separate "Dates to Be Announced" section.
- **No Hardcoding**: All event data is stored as structured records in the database and editable by administrators via authenticated endpoints (`PUT /api/events/:id`).

## 4. Event Entity Structure
- Fields: `id`, `title`, `headline`, `description`, `agenda`, `event_type`, `chapter_id`, `start_date`, `end_date`, `date_precision`, `display_date`, `year`, `month_name`, `city`, `region`, `country`, `location`, `venue`, `capacity`, `available_spots`, `registered_count`, `registration_status` (`open`, `coming_soon`, `full`, `closed`), `registration_link`, `price`, `whats_included`, `travel_info`, `hosts`, `hero_image`, `is_published`.
- Visibility: All published events are viewable by verified members.
- Registration states: `registered`, `waitlisted`, `cancelled`.
- Export: Personal calendar export (`.ics` format and Google Calendar integration).

## 5. Dedicated Event Detail View
- Displays: Event title, dates, hero image, full description and agenda, exact location and venue (or TBA), hosts/organizers, capacity and registration availability, pricing and what's included, registration action, route extensions / travel and accommodation information, and personal calendar sync.

## 6. Targeted Invitation Engine & Preview
- Admins can target specific segments:
  - `chapters`: Array of chapter IDs (e.g., `["ch_dubai", "ch_london"]`).
  - `industries`: Array of canonical industry slugs (e.g., `["artificial_intelligence", "fintech"]`).
  - `include_travelers_in_city`: Matches members with active travel records spanning the event date.
  - `exclude_past_attendees`: Prioritizes first-time attendees.
- Live preview deduplicates recipients and dispatches notifications atomically.

