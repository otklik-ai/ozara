# SOP 02: Member Onboarding Questionnaire & Profile Visibility

## 1. Goal & Scope
Defines the 25-question, 6-screen member onboarding questionnaire, visibility hierarchy (`Profile mode` Q7 + `Private`/`Visible` switches + `Team only` locks), AES-256-GCM encryption at rest for Screens 3 to 5, named team access controls with audit logging, and completion criteria.

## 2. How It Works
- **25 questions on 6 short screens**, under 5 minutes.
- **Only 6 are required**:
  1. **Q1**: Full name (Screen 1)
  2. **Q2**: Email (Screen 1)
  3. **Q3**: Mobile phone (Screen 1)
  4. **Q6**: How did you hear about us? / referral (Screen 1)
  5. **Q7**: How do you want to be on the platform? / profile mode (Screen 2)
  6. **Q25**: What would you like next? / next step (Screen 6)
  - Plus the required **Consent checkbox** on Screen 6 (not counted in the 25): *"I confirm my answers are accurate and agree to the privacy policy. Answers marked private are seen only by the team."*
- Everything else is optional and can be filled in later from the profile.
- Every sensitive dropdown has a `"Prefer not to say"` option.
- No account numbers, balances, passport numbers, or institution names are ever collected.
- Save after every screen, show a progress bar (`1 of 6` to `6 of 6`), and let members finish later.
- Members can edit any answer and any visibility switch at any time from their profile.

## 3. Visibility Rules
- **Visibility Labels**:
  - `Team only`: Our team only, never other members. Member can change it: **No** (locked to `'private'`).
  - `Switch`: Team always. Other members only if switched on (`'shared'` / `Visible`) and profile mode (Q7) is `Visible to members`. Member can change it: **Yes, any time**.
- **Default Switch State**: Every member-facing answer (`Switch`: Q8, Q9, Q10, Q11, Q12, Q24) has a `Private` / `Visible` switch, and **every switch starts on `Private` (`'private'`)**. The member turns on only what they want other members to see.
- **Profile Mode (Q7) Sits Above All Switches**:
  - **Visible member (`Visible to members`)**: Other verified members can see whatever the member switched on (photo Q8, role Q9, bio Q10, what they are open to Q11, residence Q12, interests Q24).
  - **Private member (`Private (browse deals and events only)`)**: Browses deals and events only. All switches are forced to `Private` and the member does not appear in the directory (`/api/members`, `/api/recommendations`). No photo needed.

## 4. The 6 Screens & 25 Questions

### Screen 1: Contact
*All Team only. This is what lets us reach the member and check who they are.*
| # | Question | Type | Options | Required | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Full name | Text | | Yes | Team only |
| 2 | Email | Email | | Yes | Team only |
| 3 | Mobile phone | Phone with country code | | Yes | Team only |
| 4 | Telegram and WhatsApp | Two text fields | `@handle or number` | No | Team only |
| 5 | Preferred language | Dropdown | `English`, `Russian`, `Other` | No | Team only |
| 6 | How did you hear about us? | Dropdown + text | `Referred by a member (name)`, `Event`, `Partner`, `Other` | Yes | Team only |

### Screen 2: Profile
*The only screen other members can ever see, and only what the member switches on.*
| # | Question | Type | Options | Required | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 7 | How do you want to be on the platform? | Single choice | `Visible to members`, `Private (browse deals and events only)` | Yes | Team only |
| 8 | Profile photo | Upload | | No | Switch |
| 9 | Your main role | Dropdown | `Business owner or founder`, `Investor`, `Fund manager or GP`, `Executive`, `Family office principal`, `Real estate developer`, `Professional advisor (lawyer, CPA, banker)`, `Other` | No | Switch |
| 10 | Company and short bio | Text, 300 characters | | No | Switch |
| 11 | What are you open to? | Multi-select | `Raising capital`, `Investing or co-investing`, `Selling a business`, `Buying a business`, `Partnerships`, `Hiring`, `Speaking`, `Networking` | No | Switch |

### Screen 3: Residence and family
*All optional. Residence can be shown; everything else is Team only.*
| # | Question | Type | Options | Required | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 12 | Where do you live? | Multi-select | Country list (allow 2+ for people who split time) | No | Switch |
| 13 | Citizenships | Multi-select | Country list. Countries only, never passport numbers | No | Team only |
| 14 | Where do you pay tax? | Multi-select | Country list, plus US state if US | No | Team only |
| 15 | Marital status | Dropdown | `Single`, `Married`, `Partnered`, `Divorced`, `Widowed`, `Prefer not to say` | No | Team only |
| 16 | Children | Dropdown | `None`, `Under 18`, `Adult`, `Both`, `Prefer not to say` | No | Team only |

### Screen 4: Wealth profile
*All optional and all Team only, locked. Top banner: "Only our team sees this. It helps us show you relevant deals and services." No free text on Screen 4.*
| # | Question | Type | Options | Required | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 17 | Approximate net worth | Dropdown | `Under $1M`, `$1M to $5M`, `$5M to $10M`, `$10M to $30M`, `$30M to $100M`, `Over $100M`, `Prefer not to say` | No | Team only |
| 18 | Liquid investable assets | Dropdown | `Under $500K`, `$500K to $2M`, `$2M to $10M`, `$10M to $25M`, `Over $25M`, `Prefer not to say` | No | Team only |
| 19 | Main source of wealth | Multi-select | `Operating business`, `Sale of a business`, `Real estate`, `Investments`, `Inheritance`, `Salary and equity compensation`, `Other` | No | Team only |
| 20 | Investor status | Multi-select | `US accredited investor`, `US qualified purchaser`, `Professional investor (UK or EU)`, `Not sure`, `None of these` | No | Team only |

### Screen 5: Your current setup
*All optional and Team only. These three answers tell us which services to offer: tax, estate, insurance, relocation, liquidity planning. Includes a "Skip, discuss on a call" button. No free text on Screen 5.*
| # | Question | Type | Options | Required | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 21 | Who advises you today? | Multi-select | `Private bank or wealth manager`, `CPA or tax advisor`, `Estate attorney`, `Insurance broker`, `Family office`, `Nobody yet`, `Prefer not to say` | No | Team only |
| 22 | What do you already have in place? | Multi-select | `Will`, `Trust(s)`, `Life insurance`, `Holding company or other structures`, `Business succession plan`, `None yet`, `Prefer not to say` | No | Team only |
| 23 | Anything coming up in the next 2 years? | Multi-select | `Selling a business or liquidity event`, `Moving country`, `Buying property`, `Inheritance`, `Marriage or divorce`, `Children's education`, `Raising capital`, `None of these` | No | Team only |

### Screen 6: Interests and next step
| # | Question | Type | Options | Required | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 24 | What interests you? | Multi-select | `Private deals`, `Real estate`, `Venture and startups`, `Private credit`, `Tax and relocation planning`, `Estate and succession`, `Insurance`, `Next-generation education`, `Concierge and lifestyle`, `Events and networking` | No | Switch |
| 25 | What would you like next? | Single choice | `Book a private call`, `Show me deals and events only`, `Just browsing for now` | Yes | Team only |

## 5. Encryption, Named Team Access, Referral Policy & Audit Logging
- **Encryption at Rest (Screens 3 to 5)**: Questions 12 through 23 are encrypted using AES-256-GCM (`enc:v1:<iv>:<tag>:<ciphertext>`) before storage in `questionnaire_answers.value_text`.
- **Restricted to Founders/Admins**: Only the profile owner (`isOwner`) and Founders/Admins (`FOUNDER`, `ADMIN`: `agniyahill@gmail.com`, `iuliiashchukinainvest@gmail.com`, `ermolov.elena@gmail.com`) can view `Team only` answers (Q1–Q7, Q13–Q23, Q25).
- **Referral / Invitation-Only Is Enough**: No automated minimum net-worth threshold blocks onboarding; referral/invitation-only approval is sufficient to join.
- **Referrer Join Status Is Private**: Whether a referred person joined is kept strictly private (Founders/Admins only). Referring members never receive a notification or visibility indicator when someone they referred joins.
- **Audit Logging**: Every view of a member's Screen 3–5 answers by a Founder/Admin generates an immutable record in `audit_logs` (`action = 'view_encrypted_screens_3_to_5'`).
- **No Free Text on Screens 4 & 5**: Server-side validation strictly restricts Q17–Q23 to canonical option values (or `'skipped'`), preventing accidental storage of account numbers or sensitive identifiers.
