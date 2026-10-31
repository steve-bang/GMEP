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

| Command                                        | What it does                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm emulators`                               | start Firestore, Auth and Storage emulators (ports 8080, 9099, 9199)                                           |
| `pnpm seed`                                    | load FAKE demo data into the running emulators (refuses to run without emulator hosts)                         |
| `pnpm dev`                                     | Next.js dev server on :3000 (needs `pnpm emulators` + `pnpm seed`, env from `.env.local`)                      |
| `pnpm lint` / `pnpm format:check`              | ESLint (warnings fail) / Prettier                                                                              |
| `pnpm typecheck`                               | `tsc --noEmit`                                                                                                 |
| `pnpm check:boundaries`                        | dependency-cruiser: layer and module rules (`.dependency-cruiser.cjs`)                                         |
| `pnpm check:indexes` / `pnpm indexes:generate` | verify / regenerate `firestore.indexes.json` from the query catalogue (S8)                                     |
| `pnpm test:unit`                               | Vitest unit tests (no emulator)                                                                                |
| `pnpm test:integration`                        | starts the emulators, runs integration tests on the in-memory adapters AND on Firestore/Auth/Storage emulators |
| `pnpm test:integration:memory`                 | same suites on the in-memory adapters only (no Java needed)                                                    |
| `pnpm build` then `pnpm check:bundle`          | production build, then fail if the browser output mentions Firebase                                            |
| `pnpm e2e`                                     | emulators + seed + Playwright against `next start` (run `pnpm build` first)                                    |
| `pnpm spike:s1`                                | S1 stock contention spike on the emulator (see `docs/dev/spike-report-emulator.md`)                            |
| `pnpm ci`                                      | the whole pipeline in order (also `.github/workflows/ci.yml`)                                                  |

Demo users (emulator only, password `Demo!Pass-2026`): `chu@demo.gmep.test` (owner, all branches), `ql.q7@demo.gmep.test`
(manager Quận 7), `ql.td@demo.gmep.test` (manager Thủ Đức), `tk.q7@demo.gmep.test` (storekeeper, view only),
`multi@demo.gmep.test` (manager at Q7, storekeeper at Thủ Đức), `norole@demo.gmep.test`. Employee codes (`NV0001`...) work too.

## Environment variables

See `.env.example`. All are server-side; there are no `NEXT_PUBLIC_*` variables by design. `GMEP_ENV=local` refuses to start
without the emulator hosts so a local run can never reach real Google services.

## Architecture in one page

```
src/
  app/              Next.js pages (Server Components) and thin Route Handlers under /api/v1 and /api/health
  modules/<code>/   domain/ (pure) application/ (use cases) ports/ (interfaces) api/ (zod schemas) index.ts (public surface)
                    codes: sys (built), crm, rec, ins, inv, pur, hrm, acc, ein, rpt (empty skeletons)
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

## Not built yet (see the plan)

Mask-by-role and the PII access log are only ports/stubs for now. Password policy, lockout and rate limiting, MFA (owner-supplied),
Docker image, Terraform, deploy to dev/staging, and all business modules beyond SYS skeleton are later slices.
