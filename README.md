# ÖZARA — High-Trust Private Executive Network

ÖZARA is an invite-only executive network platform engineered for high-trust founders, managing partners, family office principals, and enterprise leaders across global financial hubs.

---

## 🏛 Core Architecture & Features

### 1. Invitation Gate & 1:1 Email-Token Invariant
- **Invite-Only Entry**: Prospective members apply for admission via an Access Request routed to membership committee leads (`ermolov.elena@gmail.com`).
- **Cryptographic 1:1 Binding**: Invitation tokens (e.g., `OZARA-XXXX-XXXX`) are bound 1:1 to the verified applicant email address (`email TEXT UNIQUE`).
- **Email Delivery Invariant**: Tokens are delivered exclusively via verified email; applicants manually insert their token to unlock and pre-populate their locked registration form.

### 2. 30-Question Intake & Profile Integrity
- **Single Minimalistic Questionnaire**: Clean, frictionless profile completion interface with 1-tap standardized suggestions for cross-border jurisdictions, operating sectors, collaboration formats, and communication channels.
- **Question 18 Mandatory Completion**: Answering Question 18 is required to mark a profile verified (`is_complete = 1`). All other questions are optional.
- **Structured Locations & Dropdowns**: Independent, synchronized dropdown hierarchy for `country`, `state` / region, and `city`, plus standardized 12-sector industry classification and executive roles.

### 3. Privacy, Security & Governance Mandates
- **Question 23 Permanent Lock**: Confidential founder inflection notes are permanently private. Only authorized founders (Elena, Alexandra, Julia) can view them. They are automatically redacted from all member searches, recommendation algorithms, and peer views.
- **Immutable Audit Logging**: Every query or access to private fields generates an immutable audit log record.
- **Two-Person Export Rule**: Bulk member data exports require dual-custody affirmative approvals from two distinct administrators.
- **Content Moderation Guardrails**: Free-text fields are checked in real-time to prevent predatory fundraising terms, guaranteed return claims, and minimum check solicitations.

### 4. Primary Chapters
- **Dubai** (`ch_dubai`)
- **New York** (`ch_new_york`)
- **London** (`ch_london`)
- **Astana** (`ch_astana`)
- **Singapore** (`ch_singapore`)
- **Miami** (`ch_miami`)
- **Silicon Valley** (`ch_silicon_valley`)
- **Barcelona** (`ch_barcelona`)
- **Limassol** (`ch_limassol`)

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ (tested on Node 20+)
- Python 3.9+ (for deterministic verification tools)
- SQLite 3.35+

### Installation

```bash
# Clone the repository
git clone https://github.com/otklik-ai/ozara.git
cd ozara

# Install root backend dependencies
npm install

# Install mobile dependencies
cd mobile
npm install
cd ..

# Configure environment variables
cp .env.example .env
```

### Running Locally

```bash
# 1. Start Backend API & Desktop Web Platform (Port 3000)
npm start

# 2. In a separate terminal, start Mobile Web & Expo Dev Server (Port 8081)
cd mobile
npm run web
```

- **Mobile Web App**: [http://localhost:8081](http://localhost:8081)
- **Backend API & Web Dashboard**: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Automated Verification Suite

Run our comprehensive verification suites covering all security invariants:

```bash
# End-to-End API Integration Suite (all 8 platform invariants)
python3 tools/test_full_platform_api.py

# Complete Token -> Registration -> 30-Question Flow Test
python3 tools/test_questionnaire_flow.py

# TypeScript Typecheck
cd mobile && ./node_modules/.bin/tsc --noEmit
```

---

## 📁 Repository Structure

```
├── server.js              # Express 5 backend API & SQLite data access layer
├── ozara.db               # SQLite database with WAL mode & foreign key enforcement
├── package.json           # Root backend scripts and dependencies
├── public/                # Web platform client (HTML5, Vanilla CSS, JS)
├── mobile/                # React Native Expo application (TypeScript)
│   ├── app.json           # Expo app configuration
│   └── src/
│       ├── screens/       # SignUpScreen, DirectoryScreen, TeamScreen, etc.
│       ├── components/    # OzaraHeader, Navigation, SuggestionChips
│       └── services/      # ApiService (REST API client)
├── architecture/          # Technical SOPs & system architectural specifications
├── tools/                 # Deterministic test suites, seeding scripts & cron triggers
└── GEMINI.md              # Authoritative project constitution & JSON data schemas
```

---

## 📜 License
Private & Confidential — © ÖZARA. All rights reserved.
