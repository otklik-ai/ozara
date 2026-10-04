# Project Constitution & Law (gemini.md)

## 1. Architectural Invariants
1. **3-Layer Architecture**:
   - **Layer 1: Architecture (`architecture/`)**: Technical SOPs written in Markdown. Defines goals, inputs, tool logic, and edge cases. Golden Rule: *If logic changes, update the SOP before updating the code.*
   - **Layer 2: Navigation (Decision Making)**: Reasoning layer. Routes data between SOPs and Tools. Never perform complex business logic directly in the prompt; call deterministic execution tools in the correct order.
   - **Layer 3: Tools (`tools/`)**: Deterministic, atomic, testable Python scripts. Stored in `tools/`. Environment variables in `.env`. Intermediate files in `.tmp/`.
2. **Deliverables vs. Intermediates**:
   - Local (`.tmp/`): Scraped data, logs, temporary files. Ephemeral.
   - Global (Cloud/Web): Final payload destination (Web application, Database, UI, etc.). Project is complete only when delivered to its final destination.
3. **Self-Annealing (The Repair Loop)**:
   - Analyze: Read stack trace and error message.
   - Patch: Fix script in `tools/`.
   - Test: Verify the fix works.
   - Update Architecture: Record findings and rules in `architecture/` SOP.

## 2. Behavioral Rules
- **Data-First Rule**: Define the JSON Data Schema (Input/Output shapes) here in `gemini.md` before building any tools or code.
- **Execution Halt**: Strictly forbidden from writing scripts in `tools/` until:
  1. Discovery questions are answered.
  2. Data Schema is defined in `gemini.md`.
  3. `task_plan.md` has an approved Blueprint.
- **Privacy & Security Mandates**:
  - **Question 23 Permanent Lock**: No sharing toggle exists; permanently private. Only visible to Alexandra and Julia. Never exposed to search, public profiles, API payloads, or recommendations.
  - **Question 18 Mandate**: Only Question 18 is required to mark a profile complete. All other questions are optional.
  - **Audit Logging**: Every view of private answers must generate an immutable audit log record.
  - **Two-Person Rule**: Bulk exports of member data require affirmative approval from two administrators (Alexandra & Julia).
  - **Prohibited Data Guarantee**: Never collect date of birth, government ID numbers, bank account numbers, net worth, income, financial institution account details, health info, or real-time GPS location.
  - **Travel Plan Expiration**: Travel plans past `end_date` are automatically excluded from discovery.
  - **Content Moderation**: Prohibit specific fundraising terms, valuations, guaranteed returns, or minimum investment check sizes in free text.
  - **No Automated Financial Execution**: No automated financial advice, fund transfers, or investment commissions.
  - **Access Conditions Mandate**: Acceptance of Access Conditions is required before registration and server-enforced before accessing restricted investment opportunities or submitting investment inquiries. When a new version is published, re-acceptance is required.
  - **Configurable Investment Eligibility**: Each real estate listing must define configurable `eligibility_requirements` validated on the server.
  - **Invitation Gate & 1:1 Email-Token Invariant**: Membership is strictly invite-only. Invitation tokens are bound 1:1 to a unique email address (`email TEXT UNIQUE`). Entering a valid token unlocks registration with that verified email pre-populated and locked. Prospective members without an invite may submit an Access Request routed to admins (`ermolov.elena@gmail.com`).
  - **Non-Blocking Access UX & Session Resumption**: Submitting an access request must never trap the user in an indefinite circling/waiting spinner. The app immediately redirects to the token insertion page (`check_token`) with a confirmation banner preserving their submitted email. User state (`appView`, `signup_step`, `conditions_agreed`, `pending_email`, `current_user_id`) is persisted cross-platform, allowing users to return directly to the exact spot where they left off without repeating intros or legal modals.
  - **Email-Delivered Token Entry Invariant**: Unique invitation tokens are delivered exclusively via email to approved applicants. When returning to the app, users must manually insert their token from their email into the token verification field; the app must never auto-reveal or bypass manual token entry.
- **Update Rule**: Only update `gemini.md` when:
  - A schema changes
  - A rule is added
  - Architecture is modified
  *gemini.md is law. The planning files are memory.*

## 3. Data Schemas

### 3.1 Profile & Questionnaire Schema

#### Input Schema: Profile Intake & Update
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ProfileIntakeInput",
  "type": "object",
  "required": ["full_name", "headline", "chapter_id", "contact_preference", "answers"],
  "properties": {
    "full_name": { "type": "string", "minLength": 2 },
    "avatar_url": { "type": ["string", "null"] },
    "headline": { "type": "string", "maxLength": 160 },
    "chapter_id": { "type": "string" },
    "city": { "type": "string" },
    "state": { "type": "string" },
    "country": { "type": "string" },
    "industry": { "type": "string" },
    "contact_preference": {
      "type": "string",
      "enum": ["direct_contact", "through_team", "unavailable"]
    },
    "taxonomies": {
      "type": "object",
      "properties": {
        "roles": { "type": "array", "items": { "type": "string" } },
        "industries": { "type": "array", "items": { "type": "string" } },
        "expertise": { "type": "array", "items": { "type": "string" } },
        "offers": { "type": "array", "items": { "type": "string" } },
        "needs": { "type": "array", "items": { "type": "string" } },
        "interests": { "type": "array", "items": { "type": "string" } },
        "institutions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "taxonomy_context_notes": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "answers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["question_id", "answer_state", "visibility"],
        "properties": {
          "question_id": { "type": "integer", "minimum": 1, "maximum": 30 },
          "answer_state": {
            "type": "string",
            "enum": ["unanswered", "answered", "deliberately_skipped"]
          },
          "value": { "type": ["string", "array", "object", "null"] },
          "visibility": {
            "type": "string",
            "enum": ["shared", "private"]
          }
        }
      }
    },
    "travel_plans": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["city", "country", "start_date", "end_date", "visibility"],
        "properties": {
          "id": { "type": "string" },
          "city": { "type": "string" },
          "country": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": "string", "format": "date" },
          "notes": { "type": ["string", "null"] },
          "visibility": { "type": "string", "enum": ["shared", "private"] }
        }
      }
    }
  }
}
```

#### Output Schema: Member Profile Public / Authenticated View
*Note: Private answers (including Question 23) and expired travel records are filtered out.*
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MemberProfilePayload",
  "type": "object",
  "required": ["id", "full_name", "headline", "chapter", "is_complete", "contact_preference", "shared_answers", "shared_taxonomies"],
  "properties": {
    "id": { "type": "string" },
    "full_name": { "type": "string" },
    "avatar_url": { "type": ["string", "null"] },
    "headline": { "type": "string" },
    "chapter": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "city": { "type": "string" },
        "country": { "type": "string" }
      }
    },
    "city": { "type": "string" },
    "state": { "type": "string" },
    "country": { "type": "string" },
    "industry": { "type": "string" },
    "is_complete": { "type": "boolean", "description": "True if Question 18 has been answered" },
    "contact_preference": {
      "type": "string",
      "enum": ["direct_contact", "through_team", "unavailable"]
    },
    "shared_taxonomies": {
      "type": "object",
      "properties": {
        "roles": { "type": "array", "items": { "type": "string" } },
        "industries": { "type": "array", "items": { "type": "string" } },
        "expertise": { "type": "array", "items": { "type": "string" } },
        "offers": { "type": "array", "items": { "type": "string" } },
        "needs": { "type": "array", "items": { "type": "string" } },
        "interests": { "type": "array", "items": { "type": "string" } },
        "institutions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "shared_answers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question_id": { "type": "integer" },
          "question_prompt": { "type": "string" },
          "answer_state": { "type": "string", "enum": ["answered", "deliberately_skipped"] },
          "value": { "type": ["string", "array", "object", "null"] }
        }
      }
    },
    "active_travel_plans": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "city": { "type": "string" },
          "country": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": "string", "format": "date" }
        }
      }
    },
    "admitted_at": { "type": "string", "format": "date-time" }
  }
}
```

---

### 3.2 Networking, Recommendations & Intro Queue

#### Input: Search & Recommendation Query
```json
{
  "query": { "type": "string" },
  "industries": { "type": "array", "items": { "type": "string" } },
  "expertise": { "type": "array", "items": { "type": "string" } },
  "needs": { "type": "array", "items": { "type": "string" } },
  "offers": { "type": "array", "items": { "type": "string" } },
  "chapter_id": { "type": "string" },
  "traveling_to_city": { "type": "string" }
}
```

#### Output: Explainable Match Payload
```json
{
  "member_id": "usr_98124",
  "full_name": "Elena Ermolov",
  "headline": "Managing Director, Global FinTech & Cross-border Operations",
  "avatar_url": "/avatars/elena_ermolov.jpg",
  "chapter": "Dubai",
  "match_score": 0.94,
  "match_rationale": "Matches your need for [Cross-Border Payments] with Elena's verified expertise in [FinTech Licensing], and both are active in the [Dubai] chapter.",
  "matched_tags": [
    { "category": "expertise", "value": "FinTech Licensing" },
    { "category": "industry", "value": "Financial Services" }
  ],
  "contact_preference": "direct_contact"
}
```

#### Input / Output: Introduction Request ("Ask the Team")
```json
{
  "id": "req_intro_001",
  "requester_id": "usr_1001",
  "target_member_id": "usr_98124",
  "target_context_need": "Seeking advice on UAE regulatory sandboxes",
  "status": "pending_admin_review",
  "assigned_admin": "Alexandra",
  "created_at": "2026-10-02T10:00:00Z",
  "resolution_notes": null
}
```

#### Input / Output: Call Scheduling Payload
```json
{
  "id": "call_booking_551",
  "requester_id": "usr_1001",
  "recipient_id": "usr_98124",
  "status": "proposed",
  "proposed_times": [
    {
      "start_time": "2026-10-10T14:00:00Z",
      "end_time": "2026-10-10T14:30:00Z"
    }
  ],
  "selected_time": null,
  "timezone": "Asia/Dubai",
  "meeting_link": null,
  "message": "Hi Elena, would love to discuss cross-border logistics expansion for 20 mins."
}
```

---

### 3.3 Events & Targeted Invitations

#### Event Creation Payload (Admin)
```json
{
  "id": "evt_771",
  "title": "Private Founders Dinner: AI & Enterprise Operations",
  "description": "An intimate evening with 15 vetted community founders in Dubai Marina.",
  "chapter_id": "ch_dubai",
  "location": "Dubai Marina Yacht Club",
  "start_time": "2026-10-25T19:00:00Z",
  "end_time": "2026-10-25T22:00:00Z",
  "capacity": 15,
  "registered_count": 8,
  "is_published": true
}
```

#### Targeted Invitation Filter & Preview Payload
```json
{
  "event_id": "evt_771",
  "filters": {
    "chapters": ["ch_dubai"],
    "industries": ["Artificial Intelligence", "Enterprise SaaS"],
    "include_travelers_in_city": "Dubai",
    "exclude_past_attendees": false
  },
  "preview_recipient_count": 24,
  "deduplicated_recipient_ids": ["usr_1001", "usr_1002", "usr_1015"]
}
```

---

### 3.4 Investments (Real Estate Listings & Inquiries)

#### Admin Listing Payload
```json
{
  "id": "re_prop_101",
  "title": "Luxury Waterfront Villa Collection - Palm Jumeirah",
  "short_summary": "Off-market residential assets with high rental yield profile.",
  "location": "Dubai, UAE",
  "property_type": "Residential Villa",
  "status": "active",
  "images": ["/assets/palm_villa_1.jpg", "/assets/palm_villa_2.jpg"],
  "brochure_document_url": "/assets/palm_brochure.pdf",
  "eligibility_requirements": {
    "investor_type": "accredited_or_qualified",
    "min_jurisdiction_check": true,
    "conditions_version": "2026-10-v1"
  },
  "disclaimer": "Informational listing only. Does not constitute financial advice or investment solicitation.",
  "created_by": "Julia",
  "created_at": "2026-10-01T12:00:00Z"
}
```

#### Member Inquiry Payload
```json
{
  "id": "inq_302",
  "listing_id": "re_prop_101",
  "member_id": "usr_1001",
  "inquiry_type": "request_call",
  "notes": "Interested in 4-bedroom villa availability and delivery timelines.",
  "status": "new",
  "created_at": "2026-10-02T11:00:00Z"
}
```

#### Access Conditions Acceptance Schema
```json
{
  "user_id": "usr_1001",
  "conditions_version": "2026-10-v1",
  "accepted_at": "2026-10-03T12:00:00Z",
  "source": "welcome_modal"
}
```

---

### 3.5 Governance & Security Audit Schema

#### Private Field Access Audit Log
```json
{
  "id": "audit_log_9001",
  "actor_id": "admin_alexandra",
  "action": "view_private_answer",
  "target_member_id": "usr_1001",
  "question_id": 23,
  "timestamp": "2026-10-02T11:05:00Z",
  "ip_address": "127.0.0.1"
}
```

#### Two-Person Export Request Schema
```json
{
  "export_id": "exp_req_01",
  "requested_by": "admin_julia",
  "request_timestamp": "2026-10-02T11:00:00Z",
  "export_type": "members_directory_csv",
  "approved_by": "admin_alexandra",
  "approval_timestamp": "2026-10-02T11:04:00Z",
  "status": "approved",
  "download_token": "exp_sec_token_9981"
}
```

---

### 3.6 Invitation Gate & Access Request Schema

#### Input / Output: Invitation Token Verification
```json
{
  "token": "OZARA-8421-9943",
  "valid": true,
  "email": "applicant@company.com",
  "full_name": "Marcus Vance",
  "status": "approved"
}
```

#### Input / Output: Access Request Submission
```json
{
  "id": "req_acc_101",
  "email": "prospective@venture.co",
  "full_name": "Elena Rostova",
  "role_or_headline": "Managing Partner, DeepTech Capital",
  "notes": "Interested in joining Dubai chapter for AI founder community.",
  "status": "pending_admin_approval",
  "admin_notification_recipient": "ermolov.elena@gmail.com",
  "created_at": "2026-10-03T18:45:00Z"
}
```

#### Input / Output: Admin Access Approval & Token Generation
```json
{
  "request_id": "req_acc_101",
  "approved_by": "ermolov.elena@gmail.com",
  "email": "prospective@venture.co",
  "token": "OZARA-9142-3850",
  "status": "approved",
  "email_dispatched": true,
  "approved_at": "2026-10-03T18:46:00Z"
}
```

#### Output: Real-Time Access Status Polling
```json
{
  "email": "prospective@venture.co",
  "status": "approved",
  "has_token": true,
  "token": "OZARA-9142-3850"
}
```

---

### 3.7 Onboarding Contact Inquiries & Admin Routing Schema

#### Input: Contact Inquiry Payload
```json
{
  "name": "Marcus Vance",
  "email": "marcus.vance@techventures.co",
  "message": "Hello Alexandra and Julia, I would love to learn more about upcoming gatherings in Dubai and joining the community.",
  "website": null
}
```

#### Output: Contact Receipt Confirmation
```json
{
  "success": true,
  "message": "Thank you. Your message has been received."
}
```

#### Output: Contact & WhatsApp Configuration
```json
{
  "whatsapp_configured": false,
  "whatsapp_number": null
}
```

---

### 3.8 Phone Authentication & Verification Schema

#### Input / Output: Send Phone Verification Code
```json
{
  "phone": "+971501234567",
  "country_code": "AE",
  "method": "sms"
}
```
*Output:*
```json
{
  "success": true,
  "message": "Verification code dispatched.",
  "provider": "sms",
  "expires_in_seconds": 600
}
```

#### Input / Output: Verify Phone OTP Code
```json
{
  "phone": "+971501234567",
  "code": "482910"
}
```
*Output: Existing Approved Member:*
```json
{
  "success": true,
  "verified": true,
  "is_existing_member": true,
  "user": {
    "id": "usr_98124",
    "full_name": "Elena Ermolov",
    "email": "ermolov.elena@gmail.com",
    "role": "FOUNDER"
  }
}
```
*Output: New Candidate (Proceeds to Invitation Gate & Access Conditions):*
```json
{
  "success": true,
  "verified": true,
  "is_existing_member": false,
  "phone": "+971501234567"
}
```

#### Output: Phone Auth Configuration
```json
{
  "whatsapp_verification_enabled": false,
  "provider": "local_sms"
}
```

## 4. Maintenance Log
- **2026-10-01**: Constitution initialized.
- **2026-10-02**: Defined complete JSON Data Schemas and privacy invariants for Sila Svyazei based on Discovery answers.
- **2026-10-02**: Completed BLAST Protocol Phases 1 through 5. Deployed responsive full-stack platform at `http://localhost:3000`. Migrated SQLite database, validated Question 23 permanent lock, Question 18 mandatory completion, two-person export rule, explainable recommendations, travel expiration filter, content guardrails, and audit logging.
- **2026-10-03**: Defined Invitation Gate and 1:1 Email-Token Invariant: token verification unlocks pre-populated and locked email registration; uninvited users submit access requests to Elena Ermolov (`ermolov.elena@gmail.com`).
- **2026-10-03**: Streamlined Access Request UX to eliminate indefinite circling/waiting spinner: redirects immediately to the token insertion page with a submission confirmation banner. Implemented persistent session resumption across reload/login so users return directly to the exact spot where they left off without repeating intro animations or legal modals.
- **2026-10-03**: Enforced Email-Delivered Token Entry Invariant: upon admin approval, invitation tokens are delivered exclusively via email to applicants. Removed automatic on-screen token reveal/bypass (`got_token`); users manually insert their token from their email into the token verification field on `check_token`, which then locks and prepopulates their 1:1 verified email on the registration form.
- **2026-10-03**: Implemented Onboarding Questionnaire Flow: After token verification and registration coordinates, members transition to a single minimalistic page with all 30 profile questions. Question 18 is required for profile verification (`is_complete = 1`), and Question 23 is locked confidential to founders. Added profile picture insertion with device upload, curated executive portrait presets, and manual link support.
- **2026-10-03**: Standardized Data Quality & Dropdown Integration: Decomposed location into three separate structured fields (`country`, `state` / region, and `city`) with hierarchical synchronization. Introduced search-filterable modal dropdowns for countries, states, cities, standardized industries (12 sectors), and roles. Integrated structured suggestion chips for high-friction questionnaire items to keep profile taxonomy inputs clean and consistent.
- **2026-10-03**: Expanded Primary Chapters: Added New York (`ch_new_york`) and Astana (`ch_astana`) to canonical primary chapters across `sila.db`, seed configurations, mobile onboarding chapter selectors, country hierarchy defaults, and targeted gathering audience filters.
- **2026-10-04**: Brand Unification & Deployment Sync: Transitioned all platform naming from Sila / Sila Svyazei to ÖZARA (`ozara`). Migrated primary database configuration to `ozara.db` with backward-compatible fallback. Prepared repository for overwrite push to `https://github.com/otklik-ai/ozara`.
- **2026-10-04**: Onboarding Contact Panel & Admin Routing: Implemented luxury dark navy contact modal accessible via Intro button across all 3 onboarding screens (Events, Network, Invest). Form fields (Name, Email, Message) submit to server-side configured inboxes for Alexandra (`agniyahill@gmail.com`) and Julia (`iuliiashchukinainvest@gmail.com`). Included honeypot spam protection, rate limiting, and content guardrails. Confirmed exact receipt message: "Thank you. Your message has been received.", optional WhatsApp linking, and seamless return to active onboarding slide without replay of launch animation.
- **2026-10-04**: Phone Authentication & Gate Routing: Added phone verification flow from Invest onboarding screen ("Get started") matching Axevil navy/violet luxury aesthetic. Deployed `/api/auth/phone/send-code`, `/api/auth/phone/verify-code`, and `/api/auth/phone/config`. Enforced phone verification invariant: verifies ownership of the phone number without bypassing community membership gates. Approved members route directly to club tabs; unlinked candidates continue to Access Conditions and Invitation Gate, with contact panel and support routing.

