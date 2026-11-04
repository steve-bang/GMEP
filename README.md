# GMEP - Garage Management ERP

Web platform for a chain of auto garages in Vietnam (intake and repair orders, inventory, customers, accounting, e-invoicing).
Requirements live in `docs/`; the accepted stack decision is `docs/adr/0001-tech-stack.md`; the delivery plan is `docs/dev/implementation-plan.md`.

## Stack (ADR 0001, accepted)

Next.js (App Router, TypeScript strict, pnpm) as the only backend and frontend. Firestore, Firebase Auth and Cloud Storage
are used **only from the server (Admin SDK)**. The browser never calls Firebase: no Firebase package is in the browser
bundle, Security Rules deny all client access, and CI scans the build output. The single exception is media reads through
short-lived signed URLs issued by the API (not built yet). Region `asia-southeast1`. TOTP/PIN are supplied later by the
owner (`StrongAuthPort` is only a hook).

A real GCP/Firebase project does not exist yet. Everything runs on the **Firebase Emulator Suite**; no real credentials
are used or stored.

## Prerequisites

- Node.js 22+, pnpm 10 (`corepack enable`)
- Java 21 (the Firebase emulators need a JRE; the first run downloads the emulator jars)
- For e2e: Playwright Chromium (`pnpm exec playwright install chromium`), or set `PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium

## Setup

```bash
pnpm install
cp .env.example .env.local     # emulator hosts are pre-filled
```

## Commands

| Command                                        | What it does                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm emulators`                               | start Firestore, Auth and Storage emulators (ports 8080, 9099, 9199)                                             |
| `pnpm seed`                                    | load FAKE demo data into the running emulators (refuses to run without emulator hosts)                           |
| `pnpm dev`                                     | Next.js dev server on :3000 (needs `pnpm emulators` + `pnpm seed`, env from `.env.local`)                        |
| `pnpm lint` / `pnpm format:check`              | ESLint (warnings fail) / Prettier                                                                                |
| `pnpm typecheck`                               | `tsc --noEmit`                                                                                                   |
| `pnpm check:boundaries`                        | dependency-cruiser: layer and module rules (`.dependency-cruiser.cjs`)                                           |
| `pnpm check:indexes` / `pnpm indexes:generate` | verify / regenerate `firestore.indexes.json` from the query catalogue (S8)                                       |
| `pnpm test:unit`                               | Vitest unit tests (no emulator)                                                                                  |
| `pnpm test:integration`                        | starts the emulators, runs integration tests on the in-memory adapters AND on Firestore/Auth/Storage emulators   |
| `pnpm test:integration:memory`                 | same suites on the in-memory adapters only (no Java needed)                                                      |
| `pnpm build` then `pnpm check:bundle`          | production build, then fail if the browser output mentions Firebase                                              |
| `pnpm e2e`                                     | emulators + seed + Playwright against `next start` (run `pnpm build` first)                                      |
| `pnpm spike:s1`                                | S1 stock contention spike on the emulator (see `docs/dev/spike-report-emulator.md`)                              |
| `pnpm audit:prod`                              | dependency audit of production dependencies (high and above); CI runs it, `pnpm run ci` does not (needs network) |
| `pnpm run ci`                                  | the whole pipeline in order (also `.github/workflows/ci.yml`)                                                    |

Demo users (emulator only, password `Demo!Pass-2026`, all FAKE): `chu@` (CH), `qv@`, `ql.q7@`, `ql.td@`, `cv.q7@`, `qd.q7@`, `th.q7@`, `tk.q7@`, `tn.q7@`, `kt@`, `ad@`
(all `@demo.gmep.test`), `multi@` (QL at Q7 + TK at Thủ Đức: must pick a branch), `norole@`. Employee codes (`NV0001`...) work too.

## Environment variables

See `.env.example`. All are server-side; there are no `NEXT_PUBLIC_*` variables by design. `GMEP_ENV=local` refuses to start
without the emulator hosts so a local run can never reach real Google services.

## Architecture in one page

```
src/
  app/              Next.js pages (Server Components) and thin Route Handlers under /api/v1 and /api/health
  modules/<code>/   domain/ (pure) application/ (use cases) ports/ (interfaces) api/ (zod schemas) index.ts (public surface)
                    codes: sys, crm, inv (built), rec, ins, pur, hrm, acc, ein, rpt (empty skeletons)
  platform/         vendor-neutral kit: scope + rbac, audit, idempotency, errors (RFC 9457), http, logging, i18n, format
  infrastructure/   adapters: firestore, identity (Firebase Auth), memory (tests only), seed (fake data)
  composition/      the only place that wires ports to adapters (container, session helper)
  ui/               shared React components using design/ class names (tokens are untouched)
```

Rules enforced by `dependency-cruiser` and tested with deliberate violations (`tests/unit/boundaries.test.ts`):
domain and application never import `firebase-admin`; modules import each other only through `index.ts`; `app/` never
imports `infrastructure/`; `ui/` never imports server code. This keeps the PostgreSQL escape hatch of ADR §6.2 viable.

Key mechanics already in place:

- **Scope (NFR-ISO-01):** `resolveScope(actor, permission)` returns a branded `Scope`; every repository read requires it; out-of-scope records answer 404 like missing ones.
- **Audit (FR-SYS-003):** `AuditLog.record(tx, entry)` stages the entry in the same transaction as the business write; no update/delete API.
- **Idempotency:** `Idempotency-Key` records are created in the same transaction and store the response; replay returns it.
- **Errors:** `application/problem+json` (RFC 9457) with stable `code`, Vietnamese `title`/`detail`, `traceId`.
- **Session:** `__Host-gmep_session` cookie (HttpOnly, Secure, SameSite=Lax) = `<sid>.<Firebase session cookie>` plus a server-side `sessions/{sid}` record (logout, revoke, idle timeout). Origin check on all writes.
- **Money:** integer VND only (`platform/format/vnd.ts` rejects non-integers). No floats.

## Slice 1.1 and 1.2 (foundation and master data)

- **Auth**: password + `__Host-` session cookie only. **MFA/TOTP/PIN is out of scope by owner decision ("làm sau")**;
  `StrongAuthPort` (`src/modules/sys/ports/ports.ts`, `noStrongAuth`) is a no-op hook so the owner's code can be wired later.
  Password policy (min 10, not the last 5) is configuration; lockout has three counters (device+name, name, address);
  forgot password, invitation and activation use single-use hashed tokens (30 min / 72 h) and an `EmailGateway` whose only
  adapter writes to the `emailOutbox` collection (nothing is sent; read the link there in dev).
- **RBAC**: the 10 FRD roles and their permission matrix are seed data (`src/modules/sys/domain/permissions.ts`, from
  `docs/dev/ba-answers-for-dev.md` §2); roles live in the `roles` collection and are editable through the API.
  `resolveScope(actor, permission)` is the data scope; `resolveWorkingScope` adds the scope picker choice (server-side session state).
- **Persistence**: repositories are written once over the `DocStore` port (`src/platform/store`), run on Firestore and in memory.
  Every query shape is registered in `src/infrastructure/repos/queries.ts`; `pnpm check:indexes` derives the composite indexes
  from that registry and `pnpm indexes:generate` rewrites `firestore.indexes.json`. Scopes wider than 30 branches are chunked.
- **Effective-dated configuration** (tax, labour rate, standard hours, discount limit, price items, templates, numbering series):
  propose -> approve (`/sys/config/<type>`), `resolveConfigAt(...)`, snapshots for documents.
- **Docker**: `docker build -t gmep:local .` (multi-stage, standalone output, non-root, `/api/health` health check). TTL policies: `infra/firestore-ttl.md`.
- **Env (new)**: `AUTH_CACHE_TTL_SECONDS` (30; max staleness of a revocation on other instances), `CONFIG_CACHE_TTL_SECONDS`,
  `TRUSTED_PROXY_HOPS` (1 on Cloud Run), `APP_BASE_URL` (links in emails).

## Slice 1.3 (CRM core)

- **Data model** (`src/modules/crm`): `customers` + `customerPii` (contact data apart, so it can be anonymised), `vehicles` + `vehiclePlates`
  (unique plate registry, created in the same transaction), `vehicleOwnerships` (effective-dated `from`/`to`, open record = current owner),
  `consents`, `dataSubjectRequests`, `vehicleHistory` (projection read model, white-listed fields). Customers and vehicles are company-level;
  a branch scope reaches them through `branchIds` and the `customerLinks`/`vehicleLinks` relation rows (BA §10.1.5).
- **Cross-branch**: only `lookupExact` (full plate or full phone, BA §10 P1/P2) and the history projection cross branches; source records of
  another branch answer 404. `relateToWorkingBranch` is what REC calls when an appointment/quote is created.
- **Config** (`DEFAULT_CRM_CONFIG`): export caps (5,000 / 1,000 with full personal columns), request deadline (72 h), history price on/off, lookup size.
- **Routes**: `/api/v1/crm/{customers,vehicles,consents,data-requests,lookup,marketing/audience}`; UI under `/crm/*` (menu "Khách và xe").
- Tests: `tests/unit/crm-domain.test.ts`, `tests/integration/crm.test.ts` (both backends), `e2e/slice-1-3.spec.ts`.

## Slice 1.4 (INV stock ledger)

- **Data model** (`src/modules/inv`): `parts` (company level; uniqueness slots `partCodes`/`partBarcodes` created in the same transaction,
  `partCompat` links for the vehicle-line search), `stockBalances` (warehouse x part: on-hand, reserved, in-transit, value; **available is
  derived**), `stockMovements` (append-only ledger, one row per change, ordered by the balance's own `seq`), `stockDocuments`
  (GRN/GIN/RTN/ADJ, draft -> posted | cancelled), `stockReservations` (id derived from source + line + warehouse), `issueReturns`
  (how much of an issued line came back).
- **One transaction per operation** (`application/engine.ts`): reads first, then number, then balances + ledger + reservation + document + audit.
  Concurrent postings serialise on the balance document; the loser re-checks availability (S1 design, `tests/integration/inv.test.ts`).
  The memory adapter serialises transactions; the contention tests are meaningful on the emulator (`pnpm test:integration`).
- **Rules**: negative stock and issuing beyond available are blocked (an order may take its own hold plus available, never more than on-hand);
  every issue needs a source document and a receiver; abnormal documents (adjustment, receipt without PO, price/quantity variance) need
  `stock-doc:approve` from someone other than the creator; posted documents are reversed, never edited (`POST .../reverse`).
- **Cost** (`domain/cost.ts`): `CostMethod` strategy chosen by the effective-dated `cost-method` config (`/sys/config/cost-method`);
  weighted average, integer VND, BigInt arithmetic, round half up. FIFO is not implemented (accountant to decide).
  `inventory-policy` config holds the GRN variance thresholds. Standard list prices come from the `price-item` config of each price list.
- **For REC** (`src/modules/inv/index.ts`): `holdStock` / `holdStockInTx` (target quantity, idempotent), `releaseStock`, `issueForOrder`,
  `getAvailability` (available only, for advisors), `createDocument` (RTN against an issued document), `reverseDocument`.
- **Routes**: `/api/v1/inv/{parts,stock,availability,documents,reservations,issues}`; UI under `/inv/*` (menu "Kho và phụ tùng").
- **Indexes**: 136 composite indexes after this slice (Firestore allows 200 per database): keep new query shapes few (`pnpm check:indexes`).
- Tests: `tests/unit/inv-domain.test.ts`, `tests/integration/inv.test.ts` (both backends), `e2e/slice-1-4.spec.ts`.

## Slice 1.5 first part (REC intake and quote)

- **Data model** (`src/modules/rec`): `intakes` (draft -> completed | cancelled; no phone or address is copied, only name/plate snapshots),
  `quotes` (header: number, status of the current version, total) and `quoteVersions` (`<quote>__v<n>`: items with labor/part lines, totals,
  tax snapshot, `pricedOn`, sent/replaced/rejected marks). Quote, repair order, item, payment and invoice have separate state sets; the quote
  table lives in `domain/quoteState.ts` and is tested for every state x event pair.
- **Pricing is data** (`application/quoteBuild.ts`, `domain/pricing.ts`): labor = minutes x hourly rate / 60 (`standard-hours` per service,
  `labor-rate` company or branch); part price = `price-item` of the price list in `RecConfig.priceListCode`; tax = `tax-rate` key
  `RecConfig.taxRateKey`; discount limit = `discount-limit` per role (no entry = no discount). A missing config version is an error
  (`tax_rate_missing`, 422 with the line), never a default. Config version ids are kept on every line (price snapshot). Rounding: line amounts
  half up; tax once per rate on the sum of net amounts [Cần xác nhận: Kế toán khách]; all integer VND.
- **Versions**: draft = edited in place; sent/rejected/expired = the edit becomes the next version (the previous one is marked replaced when
  the new one is sent); approved = locked. A draft priced on an earlier day must be saved again before sending (`prices_outdated`).
- **No stock hold at quote time** (BA §16.2.1 row 1); the picker and the lines show the AVAILABLE quantity only.
- **Routes**: `/api/v1/rec/{intakes,quotes,pickers/services,pickers/parts}`; UI `/rec/intakes`, `/rec/intakes/new`, `/rec/intakes/[id]`
  (wizard), `/rec/quotes`, `/rec/quotes/[id]` (menu "Tiếp nhận và báo giá").
- Tests: `tests/unit/rec-domain.test.ts`, `tests/integration/rec.test.ts` (both backends), `e2e/slice-1-5.spec.ts`.

## Slice 1.5 second part (REC quote approval)

- **Approval** (`application/approval.ts`, `domain/approval.ts`): the unit is the ITEM. Three ways in, one core: the customer through a link,
  staff recording a signature at the counter, staff recording a verbal approval (an exception for the manager). The core moves the quote
  through its state machine (`approved_full` / `approved_partial`), writes the evidence once on the version (method, who, when, approved and
  declined items with reasons, totals recomputed on the approved set, SHA-256 hash - business evidence, not a digital signature), locks the
  content, audits and notifies the advisor and the branch manager (`notifyUsers`, no personal data). An expired quote cannot be approved
  (R10); a refused REQUIRED item needs a reason from the `decline-reason` catalogue and carries the safety flag (policy `quote-approval`,
  company or branch, default: allowed). Item prices on the customer page and the print add up to the exact total (largest remainder,
  `platform/money/splitTax.ts`, also run in the browser).
- **Customer link** (FR-REC-008): `POST /api/v1/rec/quotes/[id]/link` returns a random token (32 bytes) ONCE; only its SHA-256 is stored
  (`quoteLinks`). Issuing again revokes the old link. Page `/b/[token]` (no shell, noindex, no-referrer) calls the application directly; the
  decision routes `/api/v1/rec/public/quote/{approve,reject}` take the token in the BODY (a URL would be logged), need `Idempotency-Key`, the
  Origin check, and are rate limited per address and per token (`customer-link`, `customer-link-decide`). Unknown, malformed, replaced and
  superseded tokens look the same (404 page). A repeated tap with the same choice returns the stored result; another choice is 409.
- **Counter**: `POST /api/v1/rec/quotes/[id]/approve` (`quote:approve`: CV, QL); screen "Ghi nhận khách duyệt tại quầy" (3 steps). OTP is locked
  until an SMS provider is active.
- **Print A4**: `/rec/quotes/[id]/print` (print-first HTML/CSS ported from `design/g2-quote-delivery`), no phone or address printed.
- **For slice 1.6**: `getApprovedQuote(rec, actor, quoteId)` / `GET /api/v1/rec/quotes/[id]/approved` (approved lines only, each with the immutable
  `lineKey` = `<quote>__v<n>_<item>_<line>` (INV id-token safe), price version id and tax key/version), `allocateRepairOrderNumber` (FR-REC-030, series `repair-order`),
  `getServiceWorkflow` / `GET /api/v1/rec/service-workflows` (FR-REC-032, config `service-workflow`). No order and no stock hold exist yet.
- Tests: `tests/unit/rec-approval.test.ts`, `tests/integration/rec-approval.test.ts` (both backends), `e2e/slice-1-5-approval.spec.ts`.

## Slice 1.6 (REC repair order and execution)

- **Approval opens the order (R37, FR-REC-010)**: after the approval evidence is committed (counter, verbal or customer link) `afterQuoteApproved`
  runs the idempotent `openOrderForQuote`: in ONE transaction it allocates `RO-<BRANCH>-<YYMM>-<seq5>` (keyed by the approval hash, R35), creates
  the order with ONLY the approved lines (one repair item per approved quote item, each line keeps its immutable `lineKey`), and holds stock for the
  approved part lines through INV `prepareHoldForApproval` (partial: a shortage is stored as `unmetQty` and the item starts "paused, waiting for
  parts", the approval is never blocked). A technical failure leaves the quote "approved, no order yet" with a **Tạo lệnh** button (same path, safe to
  repeat) and a notice to the branch manager. A customer-link approval has no staff member, so the order is opened by the system actor
  (`system:order`, audit `actorType` system). Supplementary quotes (FR-REC-014) are normal quotes with `supplementOfOrderId`; their approval appends
  items and a hold to the SAME order (`appendSupplement`) and never opens a new order.
- **Five objects, separate machines**: `domain/orderState.ts` holds the repair order machine (approved, in_progress, paused, awaiting_qc,
  ready_for_delivery, completed, cancelled) and the repair item machine (not_started, in_progress, paused, done, returned) as pure tables tested for
  every state x event pair (`tests/unit/rec-order-state.test.ts`). An item never moves the order except through explicit events (first start,
  QC, supplement `reopen`). Hours come from append-only time events (`workedMsOf`), never typed; undo is a compensating event inside a configurable
  window (`RecConfig.undoWindowMs`, `order-policy`).
- **Data**: `repairOrders` (qcRuns, proposals, handover, history embedded and bounded), `repairItems` (events, assignments embedded), `partRequests`.
  Every query is registered in `repos/queries.ts` (184 composite indexes now). Item/order actions read the order document in the same transaction, so
  concurrent taps serialise on it (Firestore transactions).
- **Execution**: assign technician (`repair-item:manage`, change needs a reason), technician tablet `/rec/work` (own items only; start/finish one tap,
  pause = reason tap), part requests only against approved part lines (RULE-005); the storekeeper's **issue** runs INV `issueForOrderInTx` in the SAME
  transaction as the request (RULE-007, carries the `lineKey`), dispatch board `/rec/board` (auto refresh), QC with an effective-dated
  `qc-checklist` (a failure returns items to their technician), handover (receiver name, odometer through CRM `recordOdometer`, completes the order and
  writes the CRM `vehicleHistory` projection row), A5 and 80 mm handover print `/rec/orders/[id]/handover/print` (logged; reprint needs a reason).
- **Cancel (FR-REC-021)**: nothing issued -> CV/QL, hold released; parts issued -> only a manager, only after every issued part is returned by a posted RTN
  (INV `orderIssueBalance`; issues made outside REC count as unaccounted and block).
- **BA section 18 items**: R38 expired link is read-only (decisions look like an unknown link), R36 workflow seeds `general_repair` and `body_paint`
  (sample, `expectedDays`, `countsTowardLabor`), R29 `recordedByRole` + optional `verbalApprovalMaxVnd`, R34 `public-rate-limit` config, R30/R21
  `POST /api/v1/sys/roles/top-up` (`PERMISSION_TOPUPS`, idempotent, audited, owner only) and audit `actorType`.
- **Routes**: `/api/v1/rec/{orders,board,work,technicians,part-requests,items/[id]/{assign,start,pause,finish,undo},quotes/[id]/create-order}`; UI
  `/rec/orders`, `/rec/orders/[id]`, `/rec/orders/[id]/{qc,handover,handover/print}`, `/rec/board`, `/rec/work`, `/rec/part-requests`.
- Tests: `tests/unit/rec-order-state.test.ts`, `tests/integration/rec-orders.test.ts` (both backends, includes concurrency), `e2e/slice-1-6.spec.ts`.
  Open questions R39..R53 in `docs/dev/open-questions-for-ba.md`.

## Not built yet (see the plan)

TOTP/PIN (owner), device registration, change-email and temporary passwords, login history (FR-SYS-014), access-log viewer,
real e-mail/SMS/Zalo providers, Terraform and deploys, and every business module beyond SYS, CRM core, the INV ledger and REC intake/quote (ACC, EIN, RPT are skeletons; REC photos, Zalo/SMS/email sending, OTP, warranty orders (REC-018), the reminder screen of declined items (REC-024), the technician's "Công của tôi" and body-paint step tracking screens are not built; INV transfers, stocktake, purchasing and lots are not built; CRM-003/005..009/012/015/016/018 not built).
Open requirement questions: `docs/dev/open-questions-for-ba.md`.
