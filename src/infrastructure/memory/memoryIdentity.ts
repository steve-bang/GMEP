import { createHash, randomUUID } from 'node:crypto';
import { InvalidCredentialsError, type IdentityProvider } from '@/modules/sys';

/** Fake identity store with passwords in memory (tests only). */
export class MemoryIdentityProvider implements IdentityProvider {
  private readonly accounts = new Map<
    string,
    { uid: string; password: string; disabled: boolean }
  >();
  private readonly byUid = new Map<string, string>();
  private readonly revokedBefore = new Map<string, number>();
  private seq = 0; // monotonic counter: avoids same-millisecond ambiguity between issue and revoke
  private readonly cookies = new Map<
    string,
    { uid: string; issuedAt: number; expiresAt: number }
  >();
  /** call counters for the per-request cost measurement (H1) */
  readonly calls = { signIn: 0, createCookie: 0, verify: 0, revoke: 0 };

  addAccount(email: string, uid: string, password: string, disabled = false) {
    this.accounts.set(email.toLowerCase(), { uid, password, disabled });
    this.byUid.set(uid, email.toLowerCase());
  }
  async signInWithPassword(email: string, password: string) {
    this.calls.signIn++;
    const acc = this.accounts.get(email.toLowerCase());
    if (!acc || acc.disabled || acc.password !== password) throw new InvalidCredentialsError();
    return { uid: acc.uid, idToken: `idtoken.${acc.uid}` };
  }
  async createSessionCookie(idToken: string, ttlMs: number) {
    this.calls.createCookie++;
    const uid = idToken.replace(/^idtoken\./, '');
    const cookie = `mem.${randomUUID()}.${createHash('sha1').update(uid).digest('hex').slice(0, 6)}`;
    this.cookies.set(cookie, { uid, issuedAt: ++this.seq, expiresAt: Date.now() + ttlMs });
    return cookie;
  }
  async verifySessionCookie(cookie: string) {
    this.calls.verify++;
    const c = this.cookies.get(cookie);
    if (!c || c.expiresAt <= Date.now()) return null;
    if (c.issuedAt < (this.revokedBefore.get(c.uid) ?? 0)) return null;
    return { uid: c.uid };
  }
  async revokeUserTokens(uid: string) {
    this.calls.revoke++;
    this.revokedBefore.set(uid, ++this.seq);
  }
  async createUser(input: { uid: string; email: string; displayName: string }) {
    this.addAccount(input.email, input.uid, randomUUID() + randomUUID());
  }
  async setPassword(uid: string, password: string) {
    const email = this.byUid.get(uid);
    const acc = email ? this.accounts.get(email) : undefined;
    if (!acc) throw new Error('unknown account');
    acc.password = password;
  }
  async setDisabled(uid: string, disabled: boolean) {
    const email = this.byUid.get(uid);
    const acc = email ? this.accounts.get(email) : undefined;
    if (acc) acc.disabled = disabled;
  }
}
