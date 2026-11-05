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

## Deploying to a real environment

Step-by-step guide (Cloud Run, Firestore, Auth, Storage, secrets, SMTP email, Scheduler, domain): `docs/dev/deploy-guide.md`.
Email uses `EMAIL_SMTP_URL` + `EMAIL_FROM` (required when `GMEP_ENV=prod`; unset elsewhere = dev outbox).

## Architecture in one page

```
src/
  app/              Next.js pages (Server Components) and thin Route Handlers under /api/v1 and /api/health
  modules/<code>/   domain/ (pure) application/ (use cases) ports/ (interfaces) api/ (zod schemas) index.ts (public surface)
                    codes: sys, crm, inv, rec, acc, ein, rpt (built), ins, pur, hrm (empty skeletons)
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

## Slice 1.7 (ACC money and SYS approvals)

- **Payments** (`src/modules/acc`): `payments` holds receipts (several methods in one document: cash, transfer, card/POS, QR recorded by hand), deposits,
  expense vouchers and their reversals. A posted payment has **no update method** (RULE-010): a mistake is a new `reversal` entry that points at it; the
  one-per-payment slot `paymentReversals/<id>` is the uniqueness guard and how a list knows a payment was reversed. Money is integer VND.
  `orderAccounts/<orderId>` is the derived aggregate (received, deposits held/applied, approved debt) written in the same transaction as the payment, so
  concurrent receipts serialise on it; `recomputeAccount` rebuilds it from the payments for reconciliation.
- **RULE-007 and R44**: every receipt and deposit hangs on a repair order. REC owns the receivable (`totalVnd`, supplements included); ACC supplies
  `getOrderBalance` (`src/modules/acc/index.ts`). The two modules know each other only through ports wired in `src/composition/accWiring.ts`
  (`OrderSource` for ACC, `PaymentGate` for REC). The handover calls the gate INSIDE its own transaction, requires nothing outstanding or an approved
  debt that covers it, keeps the figures on the handover record, and blocks when ACC cannot answer (a branch manager may hand over on an exception with
  a reason). `order-policy.handoverRequiresPayment` now defaults to true.
- **Cash book, shifts, day close** (FR-ACC-003/004): `cashDrawers/<branch>` (book balance, sequence, open shift: the contention point), append-only
  `cashEntries` with the running balance, `cashShifts`, `dayCloses`. One open shift per branch; counted minus book is the variance, posted as its own entry;
  a difference needs a cause and an explanation and, above `acc-policy.varianceToleranceVnd`, a manager's approval; the day cannot close while a shift is open
  or a difference is pending/rejected, and a closed day takes no more documents (corrections are reversals dated in the open day).
- **Approvals** (`src/modules/sys/application/approvals.ts`, FR-SYS-004): kinds `payment_reversal`, `expense`, `debt_handover`, `cash_variance`; limits are the
  effective-dated `approval-limit` config (conservative code fallback); the requester never decides their own request (by person); a decision runs the
  kind's registered handler in the same transaction (debt, cash variance), otherwise the requester later EXECUTES the approved request exactly once
  (reversal, expense payment: `loadApprovalForUse` reads, `consumeApprovalInTx` stages the writes).
- **Firestore rule to remember**: a transaction must finish ALL reads before its first write. Helpers that read and then write are split in two phases
  (`prepareCloseSupplements`, `loadApprovalForUse`/`consumeApprovalInTx`); the memory adapter does not catch violations, run `pnpm test:integration`.
- **Config** (effective-dated): `acc-policy` (methods, reference rule, QC before the final receipt, variance tolerance, debt term), `approval-limit`, `expense-category`.
  Tax rates stay as before (`tax-rate`, `tax-mapping`: FR-ACC-009).
- **Routes**: `/api/v1/acc/{orders/[id],orders/[id]/payments,orders/[id]/debt-requests,payments,payments/[id],payments/[id]/reversal-request,payments/[id]/reverse,cashbook,shifts,shifts/[id]/close,shifts/[id]/explain,expenses,expenses/pay,expense-categories,day-close,debts}`
  and `/api/v1/sys/approvals{,/[id],/[id]/decide,/[id]/withdraw}`; UI `/acc/orders/[id]`, `/acc/payments`, `/acc/cashbook`, `/acc/cashbook/close`, `/acc/day-close`,
  `/acc/debts`, `/approvals` (menu "Thu chi"). Every money write needs an `Idempotency-Key`.
- **Indexes**: 191 composite indexes (limit 200). Money screens work in one working branch, so branch is an equality field, not a scoped `in`.
- Tests: `tests/unit/acc-domain.test.ts`, `tests/integration/acc.test.ts` (both backends: replay, concurrency, isolation, approvals, handover), `e2e/slice-1-7.spec.ts`.
  Open questions R54..R68 in `docs/dev/open-questions-for-ba.md`.

## Slice 1.8 (EIN basic e-invoice)

- **Port and fake** (`src/modules/ein/ports/provider.ts`, `src/infrastructure/einvoice/fakeProvider.ts`): `EInvoiceProvider` is idempotent by a stable `clientRequestId`, has typed
  errors (timeout, data, rejected, unavailable) and a provider-neutral status set (issued / processing / cancelled); each adapter maps its own. `FakeProvider` is the ONLY
  adapter (no real provider is chosen): deterministic numbers and tax-authority codes, XML and PDF, and a script for trouble (`timeout_before`, `timeout_after` = created but the
  answer is lost, `data_error`, `rejected`, `unavailable`, `processing`). It serves the **test** environment only: an issuer set to `live` on `fake` is "not activated".
  Scripting it at runtime is `POST /api/v1/ein/dev/fake` (404 outside `GMEP_ENV=local`).
- **Objects** (`domain/`): the INVOICE (`not_issued | issued | cancelled | abandoned`, with adjustment / replacement as document TYPES and a separate `sync` indicator) and the issue
  REQUEST (`pending | sending | awaiting_provider | unknown | failed_data | failed_provider | succeeded | cancelled`) are two pure state machines, tested over every state x event. The
  order never carries an invoice status. The invoice number is the provider's; the internal number is the request's `YH-`.
- **No duplicate (FR-EIN-013)**: the request id is deterministic (`<orderId>__issue__<round>`) and created in the same transaction as the order index (`einOrders/<orderId>`), so a second
  click, a second user or a replay after the 24 h HTTP key window finds the same request. The call to the provider is NEVER inside a transaction: claim (lease) -> call -> record. After
  a timeout, an earlier attempt or an async answer the provider is ASKED by the key first and the request is sent again only when it holds nothing.
- **Eligibility (FR-EIN-011)**: a pure checklist returns every blocking issue with the form field to fix; lines, tax key / version / rate come from the approved lines of the repair items
  (R2), tax is computed once per rate per approval and summed, and the invoice total must equal the order total (RULE-005). A tax-rate change since the quote is a warning by default.
- **Queue and retry (FR-EIN-010)**: ONE bounded document per branch (`invoiceQueues/<branchId>`), read by key. "Thử lại" is `POST /ein/queue/{id}/retry`; data errors need `fix-buyer`;
  `cancel` asks the provider one last time. There is no scheduler yet: `POST /api/v1/ein/jobs/run-due` handles what is due (backoff and attempts are the `einvoice-policy` config);
  call it from Cloud Scheduler with a service account per branch (not set up).
- **Files**: `FileStore` port (`src/platform/files`), Cloud Storage adapter (Admin SDK, Emulator in tests) and a memory one; XML and PDF are stored under `invoices/<company>/<branch>/`
  and served by `GET /api/v1/ein/invoices/{id}/files/{xml|pdf}` after a Scope check. `GMEP_FILES_BUCKET` selects the bucket; the e2e script now starts the storage emulator too.
- **Corrections (FR-EIN-007 minimal)**: adjust (signed amounts per rate), replace (corrected buyer) and cancel go through the SYS approval workflow with kinds `invoice_adjust|replace|cancel`
  decided by `invoice:approve` (the "chief accountant" right; by default only the owner holds it); the proposer runs the approved request once; a cancel asks for the password again.
- **PII**: address and e-mail of the buyer live in `invoicePii/<id>`, are presented by the PII policy per role and access is logged; buyer name and tax code are on the invoice.
- **Config** (effective-dated): `einvoice-issuer` (provider code, environment, seller, symbol, invoice type; no config = "not activated"), `einvoice-policy` (line mode, when issuing is allowed,
  retries, timeout), approval limits for the three new kinds. Permissions top-up `2026-11-ein-1.8-invoice`.
- **Routes**: `/api/v1/ein/{invoices,invoices/[id],invoices/[id]/files/[kind],invoices/[id]/sync,invoices/[id]/corrections,invoices/[id]/report-error,corrections/execute,orders/[id]/invoice-check,orders/[id]/invoices,queue,queue/[id]/{retry,fix-buyer,cancel},warnings,jobs/run-due,connection,dev/fake}`;
  UI `/ein`, `/ein/orders/[id]/issue`, `/ein/invoices/[id]`, `/ein/invoices/[id]/correct`, `/ein/warnings`, `/ein/queue`, `/ein/connection` (menu "Hóa đơn").
- **Indexes (R68)**: ONE new composite index for the whole slice (`invoices.byBranch`), 191 declared of 200; `pnpm check:indexes` warns from 190 and fails above 195. Everything else is read by key
  (orders index, queue document, requests, artifacts), the warning list reuses `repairOrders.list[status]`, and status / text filters run in memory over a bounded window (`truncated` says when
  the window ended before the data did). Slice 1.9 keeps at least four.
- Tests: `tests/unit/ein-domain.test.ts` (state machines, eligibility, amount table marked as NOT signed by the accountant), `tests/unit/ein-fake-provider.test.ts`,
  `tests/integration/ein.test.ts` (both backends: issue, files, duplicate and parallel clicks, timeouts before and after creation, queue, async answer, corrections, PII, isolation), `e2e/slice-1-8.spec.ts`.
  Open questions R69..R80 in `docs/dev/open-questions-for-ba.md`.

## Slice 1.9 (RPT single-branch reports, core)

- **Rollup projection** (`src/modules/rpt`): one read-model document per branch and business day, `rollups/<branchId>_<yyyyMMdd>`, read BY KEY (no query, no composite index: still 191/200, R68 rule 3).
  `computeDaily` is a pure function over facts (orders, approved lines, payments, debts, shifts, invoices, goods issues); the composition adapter `rptWiring.ts` reads REC, ACC, EIN and INV through their public
  repositories inside one branch Scope. Content hash `sourceHash` makes the job idempotent: an unchanged day writes nothing; a changed day writes the document and its audit entry in one transaction.
- **Job**: `POST /api/v1/rpt/jobs/run-due` (today, yesterday, missing days of the last 7; an official = closed day is not touched) and `POST /api/v1/rpt/jobs/rebuild {date}` (any day up to 93 days back, audited).
  No scheduler yet: Cloud Scheduler or the button on the report screen calls it. A rebuild from nothing equals the incremental refresh (integration test compares the hashes).
- **Reads**: `GET /api/v1/rpt/{dashboard,daily,drill,alerts}`; export `POST /api/v1/rpt/daily/export` (CSV, one branch, `report-daily:export`, audited as `rollup.export`).
  UI `/rpt` (role dashboard; several branches = the owner's consolidated table summed from each branch's own document), `/rpt/daily` (formula printed, reconciliation, 7-day trend), `/rpt/daily/drill` (source documents), `/rpt/alerts`.
- **Visibility**: the page permission is `report-dashboard:view`; every block and every alert is removed on the SERVER unless the user also holds the view permission of its source module (`repair-order`, `payment`, `debt`, `invoice`,
  `stock`, `cashbook`); revenue and the labor/parts split need `report-daily:view`. Top-up `2026-11-rpt-1.9-reports`. Thresholds are the effective-dated config `report-policy` (alerts), technical caps are `RptConfig`.
- **Limits** (said on screen as "mức tối thiểu"): the order scan reads at most 1,500 orders created in the 7 days before the rebuilt day; each list is capped and flagged `truncated`. Not an incremental in-transaction projection (R87).
- Tests: `tests/unit/rpt-domain.test.ts` (rollup math, alerts, hash stability, consolidation), `tests/integration/rpt.test.ts` (both backends: job idempotency, rebuild equals incremental, drill, role cuts, branch isolation matrix, export audit,
  no new index), `e2e/slice-1-9.spec.ts`. Open questions R81..R92 in `docs/dev/open-questions-for-ba.md`.
- Not built: monthly report and same-period comparison, four-way reconciliation list (FR-RPT-004 full), branch comparison (RPT-002), advanced charts, gross profit, filters by service type / employee, scheduler, PDF/Excel export.

## Scheduler (cron endpoint)

No scheduler infrastructure is deployed yet. `POST /api/v1/internal/cron/run-due` runs, per branch of `CRON_COMPANY_ID`, the RPT due job
(`runDueRollups`, FR-RPT-003) and the EIN retry job (`runDueRequests`, FR-EIN-010). Both are idempotent, so overlapping or repeated
calls are safe; one failing branch does not stop the others (response lists each branch). Auth is the shared secret in header
`x-cron-secret` (env `CRON_SECRET`, at least 32 characters, compared in constant time); there is no session and no Origin check on this
route only. Alternatively Cloud Scheduler can send its OIDC token (`Authorization: Bearer ...`): set `CRON_OIDC_AUDIENCE` (the
expected `aud`, normally the service URL) and `CRON_OIDC_SERVICE_ACCOUNT` (the scheduler service-account email) together; the token is
checked (RS256 signature against Google's public keys, issuer, audience, email, expiry) behind the `CronAuthVerifier` port. Either
credential is enough, so the secret keeps working during the switch. With neither configured the route answers 404; a missing or
wrong credential answers 401. Cloud Scheduler: HTTP POST every 10 to 15 minutes, with the OIDC token (or header
`x-cron-secret` from Secret Manager); the jobs run as the service actor `system:cron`, which holds only
`report-job:manage` and `invoice-queue:update`. The per-branch endpoints (`/rpt/jobs/run-due`, `/ein/jobs/run-due`) stay for the screens.

## Not built yet (see the plan)

TOTP/PIN (owner), device registration, change-email and temporary passwords, login history (FR-SYS-014), access-log viewer,
real e-mail/SMS/Zalo providers, Terraform and deploys, and every business module beyond SYS, CRM core, the INV ledger, REC and the minimal ACC money slice (RPT has the single-branch daily core only (monthly, four-way reconciliation, comparison, PDF/Excel not built); EIN has the basic invoice (no real provider, no sending to the customer, no FR-EIN-012 timing/deposit rule); ACC is missing refunds to customers, advance credit, reopening a day, period lock, payables, the accounting export and bank reconciliation; REC photos, Zalo/SMS/email sending, OTP, warranty orders (REC-018), the reminder screen of declined items (REC-024), the technician's "Công của tôi" and body-paint step tracking screens are not built; INV transfers, stocktake, purchasing and lots are not built; CRM-003/005..009/012/015/016/018 not built).
Open requirement questions: `docs/dev/open-questions-for-ba.md`.
