# SOP 10: Frontend Development Workflow & Fast Iteration Policy

## 1. Canonical Application
- The React Native / Expo application located in `mobile/` is the single canonical frontend for:
  1. Local browser previews (`http://localhost:8081` via Metro Web).
  2. Native iOS development builds, Simulator, and TestFlight release pipelines.
  3. Hosted staging web builds (`mobile/dist/`).
- The legacy vanilla web client in `public/` (`index.html`, `app.js`, `styles.css`) is deprecated for new feature development. **Do NOT modify files in `public/` unless the user explicitly requests changes to the legacy web frontend.**

## 2. Fast Development & Inspection Guardrails
To prevent slow iteration cycles and multi-turn delays on UI edits:
- **Direct Component Scoping**:
  - For UI tasks, identify and modify only the relevant React Native screens (`mobile/src/screens/`) or components (`mobile/src/components/`).
  - Do not search or modify backend files unless a schema or API contract addition is strictly required.
- **Batched Information Gathering**:
  - Read relevant functions, JSX blocks, and stylesheet definitions together in comprehensive views.
  - Do not perform dozens of sequential 30-to-50 line inspect/grep cycles across disjoint files.
  - Formulate the full edit plan before initiating file modifications.

## 3. Hot-Reload Dev Server vs. Production Builds
- **Local Development**:
  - Run the Metro dev server: `npm run dev:mobile` (or `npx expo start --web --port 8081` in `mobile/`).
  - Access preview at `http://localhost:8081` (or LAN IP e.g. `http://192.168.1.x:8081`).
  - Leverage Fast Refresh / Hot Reload for immediate UI updates on file save.
  - Dynamic API routing in `mobile/src/services/api.ts` connects `localhost:8081` to the backend at `localhost:3000`.
- **Static Exports & Deployments**:
  - Do **NOT** run `npx expo export` or rebuild static bundles during incremental UI development.
  - Reserve `npm run export:mobile` (`expo export -p web`) and Docker staging updates strictly for formal milestone reviews, staging deployments, or release preparations.
