# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GMEP (Garage ERP) replaces the Excel-based management of a client who owns a chain of auto garages across Vietnam with a single web platform: intake and repair orders, labor, inventory and spare parts, customers, revenue and accounting, e-invoicing. It must be viewable per branch and consolidated for the owner. Web responsive: desktop at the counter, tablet in the workshop, phone for managers.

Documents are written in Vietnamese; UI text, VND currency and Vietnamese invoicing/accounting rules apply. The user communicates in Vietnamese.

## Status

Slices 0.3, 0.4 and 1.1 to 1.9 are built and run end to end on the Firebase Emulator Suite (no GCP project yet): SYS (login/session, 10-role permission matrix, scope picker, PII masking, numbering, effective-dated config, approvals, audit), CRM core, INV stock ledger, REC (intake, quote, approval, repair order, QC, handover), ACC money (receipts, cash book, shifts, day close, reversals), EIN basic invoice (fake provider only), RPT single-branch reports. Slice 1.11 (Excel import, SYS-007) is built. Slice 1.12 (hardening) is partly done: the automated suite on the emulator exists (perf, isolation matrix, security checklist, UAT journeys, a11y, import and day-reopen e2e; see `docs/dev/uat-coverage.md`), while everything needing real devices or infrastructure (printer trials, penetration test, restore drill, k6 on staging, training, cutover) is not started. Slice 1.10 (INS) and phase 2+ are not started. **MFA is out of scope by owner decision** (`StrongAuthPort` is a no-op hook).

Per-slice scope, what is NOT built, applied BA answers and index budget (193 of 200 composite indexes, measured by `pnpm check:indexes`; see `docs/dev/index-budget.md`; `pnpm check:indexes` fails above 195): **read `docs/dev/status.md` only for the module you touch.** Open requirement questions: `docs/dev/open-questions-for-ba.md`; BA answers: `docs/dev/ba-answers-for-dev.md`; plan: `docs/dev/implementation-plan.md` §7.

## Tech stack (ADR 0001, accepted 31/10/2026; read `docs/adr/0001-tech-stack.md` §2.1 before touching auth, storage or Firebase)

Next.js App Router (TypeScript strict, pnpm, Node 22) is the only backend and frontend; Firestore, Firebase Auth and Cloud Storage are used from the server with the Admin SDK only. The browser NEVER calls Firebase: no firebase/@firebase packages in the browser bundle (CI scans the build), Security Rules deny all client access. Only exception: media reads through short-lived signed URLs issued by the API after Scope checks (not built yet); uploads go through the API. TOTP/PIN are supplied later by the owner: only the `StrongAuthPort` hook exists; login is password + `__Host-` session cookie. Region `asia-southeast1`. UI: design tokens/classes ported unchanged from `design/assets`, wrapped as React in `src/ui`; next-intl (vi only). Tests: Vitest, Playwright. Layout: `src/modules/<code>/{domain,application,ports,api,index.ts}`, `src/platform`, `src/infrastructure`, `src/composition`, `src/ui`; boundaries enforced by dependency-cruiser. Full command list and architecture: `README.md`.

Commands (all verified; integration/e2e need Java for the emulators):

- `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm emulators` · `pnpm seed`
- `pnpm check:fast [base]` (developer inner loop: typecheck, eslint/prettier and related tests on the change, boundaries; full CI runs on the PR) · `pnpm lint` · `pnpm format:check` · `pnpm typecheck` · `pnpm check:boundaries` · `pnpm check:indexes` · `pnpm check:bundle` (after build)
- `pnpm test:unit` · `pnpm test:integration` (starts emulators; also `test:integration:memory`) · `pnpm e2e` (after build; set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is preinstalled elsewhere) · `pnpm indexes:generate` · `pnpm audit:prod` · `pnpm run ci` (everything except audit)

Conventions to keep: repositories live in `src/infrastructure/repos` over the `DocStore` port and every query shape is registered in `repos/queries.ts` (index check derives from it); write routes are created with `api`/`authed` (`src/composition/api.ts`) so the Origin check cannot be skipped; every repository read takes a `Scope` (from `resolveScope`); writes stage audit entries in the same transaction (`AuditLog.record(tx, ...)`); risky writes need `Idempotency-Key`; errors are RFC 9457; money is integer VND; domain/application never import firebase-admin; modules import each other only via `index.ts`; commits are Conventional Commits.

The docs are drafts (BRD v0.3), not yet confirmed by the client. Items marked `[Cần xác nhận]` are open decisions; do not hard-code assumptions for them.

## Docs (`docs/`, source of truth for requirements)

- `business-requirements.md` — BRD: goals, scope, roles, BR/RULE-xxx business rules, Vietnamese legal context, risks, phased roadmap, open questions, client Discovery answers.
- `functional-requirements.md` — FRD: 182 requirements `FR-<MODULE>-nnn` (MoSCoW priority, each traced to a BR, with acceptance criteria), role/branch permission matrix, NFRs, integrations, Excel data migration, phase-1 scope, UAT scenarios.
- `user-journey-business-workflow.md` — personas, journeys, workflows, state machines, approval matrix, exceptions.

Three embedded diagrams in these docs were lost in export (placeholders only: repair process, inter-branch stock transfer, repair-order lifecycle). Module codes: REC, INS, CRM, INV, PUR, HRM, ACC, EIN, RPT, SYS. Cite FR/RULE ids when implementing.

## Agents and skills (`.claude/`)

- `agents/orchestrator.md` — coordinator: plans multi-step work, routes tasks to `ba`/`designer` (parallel when independent), verifies output against `docs/`, escalates open decisions to the user. Run as the main-thread agent (`claude --agent orchestrator`) because subagents cannot launch other agents; it does not edit files itself.
- `agents/ba.md` — Business Analyst: requirements, FR/user stories, acceptance criteria, workflows, consistency and traceability across `docs/`, turning open items into client questions. Does not write code or pick the tech stack.
- `agents/designer.md` — Web Dashboard UI/UX Designer: screens, flows, design system, handoff specs, prototypes under `design/`. Must load the `dashboard-ui-ux` skill first; on domain behavior the docs win, on UI/UX practice the skill wins. Sends requirement gaps back to `ba`.
- `agents/dev.md` — Senior Full-stack Developer (inner loop = `pnpm check:fast`; full CI and the deep review `/code-review medium` happen on the PR, not twice): builds the real web application (architecture ADRs, schema/migrations, backend, frontend from `design/`, integrations, Excel migration, automated tests, CI). Must not scaffold until the user approves the tech-stack ADR in `docs/adr/`; sends requirement gaps to `ba` and screen gaps to `designer`.
- `skills/dashboard-ui-ux/` — dashboard UI/UX process and checklists (layout, tables/filters, charts/KPI, design tokens, states, accessibility/performance, Vietnamese localization, templates), copied into the repo so it is available to everyone who clones it.

Use `ba` before `designer` when a requirement is unclear or missing.

## UI/UX design work (`design/`, `docs/ui-ux/`)

Prototype HTML/CSS for the whole dashboard lives in `design/` (shared `assets/`, `foundation/`, and six screen packs). Tokens in `docs/design-system.md` are mandatory and must not be changed. The BA decisions in `docs/ui-ux/ba-decisions.md` and `ba-answers-0N.md` are proposals pending client confirmation. The whole dashboard (184 screens in six packs) is designed as HTML/CSS prototype and has passed the BA↔designer review rounds. **Read `docs/ui-ux/ui-ux-flow.md` (overall UI/UX flow) and `docs/ui-ux/STATUS.md` (progress, open decisions, next steps) before continuing this work.** Run at most 2 agents in parallel. Playwright is preinstalled and was used to measure overflow/JS errors across all pages (see `docs/ui-ux/mobile-overflow-report.md`); prefer measuring over reading code for layout issues.

## Domain model and rules that span modules

- **Multi-branch**: Company → Branch → Warehouse (must extend to multiple legal entities later). Every business record carries creator, timestamp and branch; every change is audit-logged (FR-SYS-003). Branch data isolation must hold in lists, search, reports, exports and API (NFR-ISO-01). Adding a branch is configuration only.
- **Multi-tenant (future, not built, not in current scope)**: the owner plans to serve multiple independent client companies (tenants) on one platform later. Today there is a single tenant. Do not build tenant features now, but do not block them: avoid hard-coding a single company, keep `Company` as the top-level scope object, keep Scope/isolation logic centralized in `resolveScope` and the repositories (so a tenant id can be added as the outermost scope), and keep numbering, effective-dated config, storage paths and audit per company rather than global. Tenant isolation model (shared collections with tenantId vs separate projects), provisioning and billing are undecided; record an ADR before starting.
- **Repair order (lệnh sửa chữa)** is the source document for a vehicle visit: labor, parts, hours, payment, invoice. No stock issue, payment or invoice may exist outside a source document (RULE-007).
- **Five separate objects with separate state sets** — quote, repair order, repair item, payment, invoice. Do not use one shared status. Quotes are versioned and can be approved partially; only approved lines flow into the order, which starts at customer approval. Work outside the quote needs supplementary approval (RULE-005/006). Invoice status comes from the e-invoice provider.
- **Inventory has four numbers**: on-hand, reserved, in-transit, available. Reorder alerts and issuing compare against available, not on-hand (RULE-008). Every stock movement keeps history (RULE-009). Cost method leaning to weighted average (final choice pending the client's accountant).
- **Pricing** separates cost, list price and actual price; branches may discount only within configured limits; quotes keep the price version.
- **Posted financial transactions are never deleted**; correct via reversal/adjustment entries (RULE-010). Spend over limit needs approval (RULE-011).
- **Rules that change by law or policy are effective-dated configuration, not code**: tax rates, inspection cycles, document templates, labor formulas, price/discount limits. Formulas for tax, price, labor and cost need automated tests with examples signed off by the accountant (NFR-MNT-01).
- **Labor pay** combines standard hours, flat rate, actual hours and per-job-type ratios; configurable per branch under a company default. The system supplies hours and commission data only; payroll, social insurance and tax filing are out of scope.
- **Accounting** is operational/management accounting. The client keeps its existing accounting software; the system exports period-end data (no double entry of transactions). Statutory financial statements and tax returns are out of scope.
- **E-invoicing** goes through a provider-agnostic integration layer (client has a provider but does not want hard dependence). Issuing must be idempotent: no duplicate invoices on repeated clicks or timeouts. Store XML/PDF locally. Applicable law: Nghị định 254/2026/NĐ-CP (invoices), Thông tư 99/2025 or 152/2025/TT-BTC (accounting), Personal Data Protection Law 2025 (mask phone/address by role, access logs).
- **Service types** (general repair, maintenance, tires/wheels, body & paint) have configurable workflows; body & paint needs its own flow (not yet surveyed).
- **Offline**: only warn on connection loss and save drafts; full offline is separate scope.

## Phasing

Discovery → Phase 1 pilot at one branch (REC, core CRM, basic INV, basic EIN, SYS, single-branch RPT; INS if client confirms) → Phase 2 (HRM, PUR, ACC approvals, rest of INV) → Phase 3 (full ACC and EIN, accounting export) → Phase 4 (QR/bank reconciliation, advanced reports). Scope per phase is gated by acceptance criteria; see `functional-requirements.md` §13 for the exact FR list per phase.

## Design targets (client estimates, unconfirmed)

8 branches now, 20 in two years; 120–200 vehicles/day growing to 500–800; 80–100 users growing to 250–300. Proposed NFRs: common actions under 2 s on 4G, consolidated dashboard under 5 s, 99.5% uptime in working hours, tablet job start/finish in at most 2 taps.

## Open decisions (do not assume)

Single vs multiple legal entities, e-invoice provider, Zalo/SMS provider, cost method, labor/commission rules, body-paint workflow, cross-branch warranty policy, approval limits, retention periods, device and printer models, number of years of repair history to migrate.
