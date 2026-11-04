/**
 * R68 (BA §20): Firestore allows 200 composite indexes per database. The build warns from 190 and fails above 195 so
 * the last five stay reserved for fixes after the pilot. Pure so a unit test can pin the thresholds.
 */
export const INDEX_LIMIT = 200;
export const INDEX_WARN_AT = 190;
export const INDEX_FAIL_ABOVE = 195;

export type IndexBudgetState = 'ok' | 'warn' | 'fail';

export function indexBudget(declared: number): IndexBudgetState {
  if (declared > INDEX_FAIL_ABOVE) return 'fail';
  return declared >= INDEX_WARN_AT ? 'warn' : 'ok';
}
