# SOP 01: Privacy, Security & Governance Mandates

## 1. Goal & Scope
Defines the technical rules, permissions, audit logging, and export controls to protect member privacy across ÖZARA.

## 2. Question 23 Permanent Lock
- **Definition**: Question 23 contains sensitive, private founder-level context.
- **Rule**:
  1. The sharing toggle for Question 23 is permanently disabled in the UI and backend schema.
  2. The `visibility` field in the database for Question 23 must always evaluate to `private`.
  3. Question 23 must NEVER be returned in any member-facing query, profile payload, search index, or recommendation scoring algorithm.
  4. Only authenticated users with the role `FOUNDER` (specifically Alexandra and Julia) may view the value of Question 23.

## 3. Private Field Access Audit Logging
- **Trigger**: Any API endpoint or database query that reads a questionnaire answer where `visibility == 'private'`.
- **Action**: Immediately write an immutable record to the `audit_logs` table.
- **Payload Shape**:
  ```json
  {
    "id": "audit_log_uuid",
    "actor_id": "usr_founder_01",
    "action": "view_private_answer",
    "target_member_id": "usr_target_02",
    "question_id": 23,
    "timestamp": "2026-10-02T11:00:00Z",
    "ip_address": "127.0.0.1"
  }
  ```
- **Invariant**: Audit logs are append-only. No deletion or editing is permitted.

## 4. Two-Person Export Approval Protocol
- **Rule**: Bulk export of member data (CSV/JSON) requires dual-custody authorization.
- **Step 1**: Admin 1 initiates the export request. System generates an `export_request` record with status `pending_second_approval`.
- **Step 2**: Admin 2 (different from Admin 1, must be Alexandra or Julia) approves the request in the admin console.
- **Step 3**: Only upon dual approval is an ephemeral download token generated with a 15-minute expiration window.

## 5. Prohibited Data Collection Policy
- **Rule**: The system must reject and never persist the following fields:
  - Date of Birth
  - Government ID / Passport numbers
  - Bank account numbers / IBANs
  - Personal net worth or liquid asset values
  - Personal income figures
  - Health or biometric data
  - Real-time GPS coordinates
