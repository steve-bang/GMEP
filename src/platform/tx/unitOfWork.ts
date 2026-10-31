/**
 * Transaction boundary owned by the domain side (ADR §6.2, plan §2.5).
 * `Tx` is opaque: only the matching infrastructure adapter can look inside, so application
 * code stays free of firebase-admin. Firestore transactions require all reads before writes;
 * write methods that take a `Tx` only stage the write, which also keeps in-memory behaviour
 * honest. No external calls (e-invoice, SMS, files) are ever made inside `run`.
 */
declare const txBrand: unique symbol;
export type Tx = { readonly [txBrand]: true };

export interface UnitOfWork {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
