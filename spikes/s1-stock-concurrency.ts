/**
 * Spike S1 (ADR 0001 §9): inventory under contention, run against the FIREBASE EMULATOR ONLY.
 *
 *  - 50 parallel workers reserve and issue stock for 20 parts in one warehouse (5 "hot" parts take
 *    most of the demand, total demand is several times the supply).
 *  - Every operation is one Firestore transaction (read balance + idempotency doc, then write
 *    balance, reservation/issue document and an append-only movement).
 *  - Afterwards the script recomputes balances from the movement ledger and replays every key.
 *
 * Pass criteria (ADR): no oversell, no drift between balance and ledger, retries handled,
 * idempotent replay, p95 under 800 ms. The latency figure from the emulator is NOT evidence for
 * real Firestore (no network, no real contention behaviour): S1 must be repeated on the real project.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set (emulator only).');
  process.exit(2);
}

const PARTS = 20;
const HOT_PARTS = 5;
const ON_HAND = 10;
const WORKERS = Number(process.env.S1_WORKERS ?? 50);
const OPS_PER_WORKER = 12;
const MAX_ATTEMPTS = 30;
const P95_BUDGET_MS = 800;

const db: Firestore = getFirestore(initializeApp({ projectId: 'demo-gmep' }, `s1-${Date.now()}`));
const RUN = `s1_${Date.now()}`;
const bal = (p: number) =>
  db.collection(`${RUN}_stockBalances`).doc(`WH1_P${String(p).padStart(2, '0')}`);
const resv = (key: string) => db.collection(`${RUN}_reservations`).doc(key);
const issue = (key: string) => db.collection(`${RUN}_issues`).doc(key);
const mov = (id: string) => db.collection(`${RUN}_movements`).doc(id);

// deterministic PRNG so runs are comparable
let seed = 20261031;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

type Outcome = 'applied' | 'replayed' | 'insufficient';
const latencies: number[] = [];
let txAttempts = 0;

async function timed<T>(fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    latencies.push(performance.now() - t0);
  }
}

/** reserve: available = onHand - reserved must cover qty (RULE-008: compare against available) */
function reserve(key: string, part: number, qty: number): Promise<Outcome> {
  return timed(() =>
    db.runTransaction(
      async (t) => {
        txAttempts++;
        const [existing, b] = await Promise.all([t.get(resv(key)), t.get(bal(part))]);
        if (existing.exists) return 'replayed' as const;
        const { onHand, reserved } = b.data() as { onHand: number; reserved: number };
        if (onHand - reserved < qty) return 'insufficient' as const;
        t.update(bal(part), { reserved: FieldValue.increment(qty) });
        t.create(resv(key), { part, qty });
        t.create(mov(`${key}#reserve`), {
          part,
          type: 'reserve',
          onHandDelta: 0,
          reservedDelta: qty,
        });
        return 'applied' as const;
      },
      { maxAttempts: MAX_ATTEMPTS },
    ),
  );
}

/** issue against an existing reservation: onHand and reserved both drop */
function issueStock(key: string, part: number, qty: number): Promise<Outcome> {
  return timed(() =>
    db.runTransaction(
      async (t) => {
        txAttempts++;
        const [existing, b] = await Promise.all([t.get(issue(key)), t.get(bal(part))]);
        if (existing.exists) return 'replayed' as const;
        const { onHand, reserved } = b.data() as { onHand: number; reserved: number };
        if (onHand < qty || reserved < qty) return 'insufficient' as const;
        t.update(bal(part), {
          onHand: FieldValue.increment(-qty),
          reserved: FieldValue.increment(-qty),
        });
        t.create(issue(key), { part, qty });
        t.create(mov(`${key}#issue`), {
          part,
          type: 'issue',
          onHandDelta: -qty,
          reservedDelta: -qty,
        });
        return 'applied' as const;
      },
      { maxAttempts: MAX_ATTEMPTS },
    ),
  );
}

const pickPart = () => (rnd() < 0.7 ? Math.floor(rnd() * HOT_PARTS) : Math.floor(rnd() * PARTS));
const percentile = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]!;

async function main() {
  // part index PARTS is reserved for the same-key race in phase 3 (guaranteed stock)
  await Promise.all(
    Array.from({ length: PARTS + 1 }, (_, p) => bal(p).set({ onHand: ON_HAND, reserved: 0 })),
  );

  // ---- phase 1: 50 workers, each 12 sequential operations (reserve, then issue about half) ----
  const applied: { key: string; part: number; qty: number; issued: boolean }[] = [];
  let rejected = 0;
  let errors = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: WORKERS }, async (_, w) => {
      for (let i = 0; i < OPS_PER_WORKER; i++) {
        const part = pickPart();
        const qty = 1 + Math.floor(rnd() * 3);
        const key = `w${w}-op${i}`;
        try {
          const r = await reserve(key, part, qty);
          if (r === 'insufficient') {
            rejected++;
            continue;
          }
          const rec = { key, part, qty, issued: false };
          applied.push(rec);
          if (rnd() < 0.5) {
            if ((await issueStock(key, part, qty)) === 'applied') rec.issued = true;
          }
        } catch (e) {
          errors++;
          console.error(`worker ${w} op ${i}: ${(e as Error).message}`);
        }
      }
    }),
  );
  const phase1Ms = performance.now() - started;
  const attemptsTotal = WORKERS * OPS_PER_WORKER;

  // ---- invariants against the ledger ----
  const invariantFailures: string[] = [];
  const movements = (await db.collection(`${RUN}_movements`).get()).docs.map(
    (d) => d.data() as { part: number; onHandDelta: number; reservedDelta: number },
  );
  for (let p = 0; p < PARTS; p++) {
    const b = (await bal(p).get()).data() as { onHand: number; reserved: number };
    const led = movements.filter((m) => m.part === p);
    const ledOnHand = ON_HAND + led.reduce((s, m) => s + m.onHandDelta, 0);
    const ledReserved = led.reduce((s, m) => s + m.reservedDelta, 0);
    if (b.onHand !== ledOnHand)
      invariantFailures.push(`part ${p}: onHand ${b.onHand} != ledger ${ledOnHand}`);
    if (b.reserved !== ledReserved)
      invariantFailures.push(`part ${p}: reserved ${b.reserved} != ledger ${ledReserved}`);
    if (b.onHand < 0) invariantFailures.push(`part ${p}: negative onHand ${b.onHand}`);
    if (b.reserved < 0) invariantFailures.push(`part ${p}: negative reserved ${b.reserved}`);
    if (b.reserved > b.onHand)
      invariantFailures.push(`part ${p}: OVERSELL reserved ${b.reserved} > onHand ${b.onHand}`);
    const sumApplied = applied.filter((a) => a.part === p).reduce((s, a) => s + a.qty, 0);
    const sumIssued = applied
      .filter((a) => a.part === p && a.issued)
      .reduce((s, a) => s + a.qty, 0);
    if (b.reserved !== sumApplied - sumIssued)
      invariantFailures.push(
        `part ${p}: reserved ${b.reserved} != applied ${sumApplied} - issued ${sumIssued}`,
      );
  }

  // ---- phase 2: replay every key, balances must not move ----
  const before = (await db.collection(`${RUN}_stockBalances`).get()).docs
    .map((d) => JSON.stringify([d.id, d.data()]))
    .sort()
    .join('|');
  let replayNotIdempotent = 0;
  await Promise.all(
    applied.map(async (a) => {
      if ((await reserve(a.key, a.part, a.qty)) !== 'replayed') replayNotIdempotent++;
      if (a.issued && (await issueStock(a.key, a.part, a.qty)) !== 'replayed')
        replayNotIdempotent++;
    }),
  );
  const after = (await db.collection(`${RUN}_stockBalances`).get()).docs
    .map((d) => JSON.stringify([d.id, d.data()]))
    .sort()
    .join('|');
  if (before !== after) invariantFailures.push('balances changed after replay');
  if (replayNotIdempotent)
    invariantFailures.push(`${replayNotIdempotent} replayed keys were applied again`);

  // ---- phase 3: 50 parallel requests with the SAME key and the same part -> exactly one effect ----
  const sameKey = await Promise.all(Array.from({ length: 50 }, () => reserve('dup-key', PARTS, 1)));
  const appliedSame = sameKey.filter((r) => r === 'applied').length;
  if (appliedSame !== 1)
    invariantFailures.push(`same-key race: ${appliedSame} applications (expected 1)`);

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const report = {
    environment: 'FIREBASE EMULATOR (not real Firestore)',
    workers: WORKERS,
    attemptedReservations: attemptsTotal,
    applied: applied.length,
    rejectedInsufficientStock: rejected,
    issued: applied.filter((a) => a.issued).length,
    errors,
    transactionBodyRuns: txAttempts,
    retriesObserved: txAttempts - latencies.length,
    phase1Ms: Math.round(phase1Ms),
    latencyMs: {
      p50: Math.round(p50),
      p95: Math.round(p95),
      max: Math.round(Math.max(...latencies)),
    },
    p95Budget: P95_BUDGET_MS,
    p95WithinBudget: p95 < P95_BUDGET_MS,
    invariantFailures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (invariantFailures.length || errors || p95 >= P95_BUDGET_MS) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
