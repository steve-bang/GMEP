import { randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import type { Env } from '@/platform/config/env';
import {
  IdentityUnavailableError,
  InvalidCredentialsError,
  type IdentityProvider,
} from '@/modules/sys';
import { getAdminApp } from '../firestore/client';

/**
 * Firebase Auth as identity store + token issuer, driven entirely from the server (ADR §6.3):
 *  - password check: Identity Toolkit REST `accounts:signInWithPassword` with a server-only key,
 *  - session cookie: Admin SDK createSessionCookie / verifySessionCookie(checkRevoked),
 *  - revocation: revokeRefreshTokens.
 * Works against the Auth Emulator (FIREBASE_AUTH_EMULATOR_HOST) and the real service unchanged.
 * The browser never talks to Firebase.
 */
export class FirebaseIdentityProvider implements IdentityProvider {
  /** call counters for the per-request cost measurement (H1) */
  readonly calls = { signIn: 0, createCookie: 0, verify: 0, revoke: 0 };
  constructor(private readonly env: Env) {}

  private signInUrl(): string {
    const host = this.env.FIREBASE_AUTH_EMULATOR_HOST;
    const path = 'identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
    const base = host ? `http://${host}/${path}` : `https://${path}`;
    return `${base}?key=${encodeURIComponent(this.env.FIREBASE_API_KEY)}`;
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ uid: string; idToken: string }> {
    this.calls.signIn++;
    let res: Response;
    try {
      res = await fetch(this.signInUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      throw new IdentityUnavailableError(e);
    }
    if (res.status === 400) throw new InvalidCredentialsError(); // EMAIL_NOT_FOUND / INVALID_PASSWORD / USER_DISABLED ...
    if (!res.ok) throw new IdentityUnavailableError(new Error(`identity status ${res.status}`));
    const data = (await res.json()) as { localId?: string; idToken?: string };
    if (!data.localId || !data.idToken)
      throw new IdentityUnavailableError(new Error('malformed identity response'));
    return { uid: data.localId, idToken: data.idToken };
  }

  async createSessionCookie(idToken: string, ttlMs: number): Promise<string> {
    this.calls.createCookie++;
    // Firebase accepts 5 minutes .. 14 days
    return getAuth(getAdminApp(this.env)).createSessionCookie(idToken, { expiresIn: ttlMs });
  }

  async verifySessionCookie(cookie: string): Promise<{ uid: string } | null> {
    this.calls.verify++;
    try {
      const decoded = await getAuth(getAdminApp(this.env)).verifySessionCookie(cookie, true);
      return { uid: decoded.uid };
    } catch {
      return null;
    }
  }

  async revokeUserTokens(uid: string): Promise<void> {
    this.calls.revoke++;
    await getAuth(getAdminApp(this.env)).revokeRefreshTokens(uid);
  }

  async createUser(input: { uid: string; email: string; displayName: string }): Promise<void> {
    // unknown random password: the invitee sets the real one on activation
    await getAuth(getAdminApp(this.env)).createUser({
      uid: input.uid,
      email: input.email,
      displayName: input.displayName,
      password: randomBytes(32).toString('base64url'),
    });
  }

  async setPassword(uid: string, password: string): Promise<void> {
    await getAuth(getAdminApp(this.env)).updateUser(uid, { password });
  }

  async setDisabled(uid: string, disabled: boolean): Promise<void> {
    await getAuth(getAdminApp(this.env)).updateUser(uid, { disabled });
  }
}
