# Project Constitution & State Tracking (claude.md)

## 1. Architectural Invariants
1. **3-Layer Separation of Concerns**:
   - **Layer 1: Architecture (`architecture/`)**: Technical SOPs in Markdown defining goals, inputs, deterministic tool logic, and edge cases. SOPs must be updated *before* code updates.
   - **Layer 2: Navigation (Decision-Making)**: Agentic routing and high-level reasoning. The agent does not execute raw complex business logic directly; it invokes deterministic tools in sequence.
   - **Layer 3: Tools (`tools/`)**: Deterministic, atomic, testable Python scripts. Secrets & keys live in `.env`. Intermediate operations in `.tmp/`.
2. **Deliverables vs Intermediates**:
   - Local `.tmp/` is ephemeral: scraped data, logs, temporary files.
   - Global (Cloud/Web) is the permanent Payload (Web application, Database, UI/API).
3. **Self-Annealing Loop**:
   - On error: Analyze stack trace → Patch tool script in `tools/` → Test → Update SOP in `architecture/` with the learnings.

## 2. Behavioral Rules
- **Data-First Rule**: No code or tool construction begins until the Data Schema (Input/Output shapes) is defined in `gemini.md` and confirmed.
- **Strict Execution Halt**: Strictly forbidden from writing scripts in `tools/` until:
  1. Discovery questions are answered. (COMPLETED)
  2. Data Schema is defined in `gemini.md`. (COMPLETED)
  3. `task_plan.md` has an approved Blueprint. (AWAITING APPROVAL)
- **Privacy & Security Mandates**:
  - **Question 23 Permanent Lock**: No sharing toggle exists; permanently private. Only visible to Alexandra and Julia. Never exposed to search, public profiles, API payloads, or recommendations.
  - **Question 18 Mandate**: Only Question 18 is required to mark a profile complete. All other questions are optional.
  - **Audit Logging**: Every view of private answers must generate an immutable audit log record.
  - **Two-Person Rule**: Bulk exports of member data require affirmative approval from two administrators (Alexandra & Julia).
  - **Prohibited Data Guarantee**: Never collect date of birth, government ID numbers, bank account numbers, net worth, income, financial institution account details, health info, or real-time GPS location.
  - **Travel Plan Expiration**: Travel plans past `end_date` are automatically excluded from discovery.
  - **Content Moderation**: Prohibit specific fundraising terms, valuations, guaranteed returns, or minimum investment check sizes in free text.
  - **No Automated Financial Execution**: No automated financial advice, fund transfers, or investment commissions.

## 3. Data Schemas
*See [gemini.md](file:///Users/bikram6am/Sila/gemini.md) for full authoritative JSON schemas.*
- Input: `ProfileIntakeInput`, `SearchFilterInput`, `CallBookingInput`, `EventRegistrationInput`, `ListingInquiryInput`
- Output: `MemberProfilePayload`, `ExplainableMatchPayload`, `IntroRequestTicket`, `AdminListingPayload`, `AuditLogRecord`, `TwoPersonExportApproval`

## 4. Maintenance Log
- **2026-10-01**: Constitution initialized.
- **2026-10-02**: Protocol 0 and Discovery Phase completed. Authoritative schemas drafted in `gemini.md`. Blueprint drafted in `task_plan.md`.
- **2026-10-02**: Completed BLAST Protocol Phases 1 through 5. Deployed responsive full-stack platform at `http://localhost:3000`. Migrated SQLite database, validated Question 23 permanent lock, Question 18 mandatory completion, two-person export rule, explainable recommendations, travel expiration filter, content guardrails, and audit logging.
