import { z } from 'zod';
import { AppError } from '@/platform/errors/errors';
import { allBranchesScope } from '@/platform/scope/scope';
import { translate } from '@/platform/i18n/messages';
import {
  checkPasswordPolicy,
  hashForHistory,
  hashToken,
  newOpaqueToken,
  type PasswordViolation,
} from '../domain/passwordPolicy';
import type { AuthToken, User } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { IdentityUnavailableError } from '../ports/ports';
import { revokeAllSessions } from './auth';
import { normalizeLoginName, parseInput } from './support';

/**
 * Forgot-password, reset, invitation and activation (FR-SYS-001, ba-answers-for-dev §1.3,
 * ADR §6.3). Tokens are 256-bit, stored only as sha256, single use, expiring (reset 30 min,
 * invitation 72 h: configuration). Responses to "forgot password" are neutral so accounts cannot
 * be enumerated; email goes through EmailGateway AFTER the database transaction.
 */
export const forgotSchema = z.object({ identifier: z.string().trim().min(1).max(254) });

const link = (deps: SysDeps, path: string, raw: string) =>
  `${deps.config.appBaseUrl}${path}?token=${encodeURIComponent(raw)}`;

export async function forgotPassword(
  deps: SysDeps,
  input: unknown,
  ctx: { address: string; requestId: string },
): Promise<void> {
  const { identifier } = parseInput(forgotSchema, input);
  const name = normalizeLoginName(identifier);
  // same limiter for known and unknown names: a 429 reveals nothing about the account
  await deps.limiter.hit('forgot-ip', ctx.address);
  await deps.limiter.hit('forgot-name', name);

  const user = await deps.users.findByLogin(identifier);
  if (!user || user.status !== 'active') return; // neutral: nothing happens, nothing is said

  const { raw, id } = newOpaqueToken();
  const now = deps.clock.now();
  await deps.uow.run(async (tx) => {
    await deps.tokens.revokeOpenForUser(tx, user.id, 'reset', now);
    deps.tokens.create(tx, {
      id,
      kind: 'reset',
      userId: user.id,
      companyId: user.companyId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + deps.config.resetTokenTtlMs),
      usedAt: null,
      revokedAt: null,
    });
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      companyId: user.companyId,
      branchId: null,
      actorId: user.id,
      actorRoles: [],
      entityType: 'user',
      entityId: user.id,
      action: 'auth.password_reset_requested',
      before: null,
      after: null,
      requestId: ctx.requestId,
    });
  });
  await deps.email.send({
    id: `reset-${id.slice(0, 24)}`,
    to: user.email,
    template: 'password-reset',
    vars: {
      link: link(deps, '/reset-password', raw),
      expiresMinutes: String(Math.round(deps.config.resetTokenTtlMs / 60_000)),
    },
  });
}

export type TokenState = 'valid' | 'expired' | 'used' | 'revoked' | 'invalid';

function stateOf(t: AuthToken | null, kind: AuthToken['kind'], now: Date): TokenState {
  if (!t || t.kind !== kind) return 'invalid';
  if (t.usedAt) return 'used';
  if (t.revokedAt) return 'revoked';
  if (t.expiresAt <= now) return 'expired';
  return 'valid';
}

export interface TokenPeek {
  state: TokenState;
  /** invitation only: read-only facts shown on the activation page (G5-AUT-03) */
  invitee?: { displayName: string; email: string; branches: string[]; roles: string[] };
}

/** Read-only look for the pages; never changes state. Callers rate-limit by address. */
export async function peekToken(
  deps: SysDeps,
  kind: AuthToken['kind'],
  raw: string,
): Promise<TokenPeek> {
  const t = raw ? await deps.tokens.find(hashToken(raw)) : null;
  const state = stateOf(t, kind, deps.clock.now());
  if (state !== 'valid' || kind !== 'invite' || !t) return { state };
  const user = await deps.users.getById(t.userId);
  if (!user) return { state: 'invalid' };
  const [assignments, branches] = await Promise.all([
    deps.assignments.listForUser(user.id),
    deps.branches.list(allBranchesScope(user.companyId)),
  ]);
  const roles = await deps.roles.getMany([...new Set(assignments.map((a) => a.roleCode))]);
  const branchNames = assignments.map((a) =>
    a.branchId === '*'
      ? translate('shell.scopeAll')
      : (branches.find((b) => b.id === a.branchId)?.name ?? ''),
  );
  return {
    state,
    invitee: {
      displayName: user.displayName,
      email: user.email,
      branches: [...new Set(branchNames.filter(Boolean))],
      roles: roles.map((r) => r.name),
    },
  };
}

const TOKEN_ERRORS: Record<Exclude<TokenState, 'valid'>, string> = {
  expired: 'token_expired',
  used: 'token_used',
  revoked: 'token_revoked',
  invalid: 'token_invalid',
};

const passwordFields = (v: PasswordViolation[], minLength: number) =>
  v.map((code) => ({ field: 'password', message: translate(code, { min: minLength }) }));

export const resetSchema = z.object({
  token: z.string().min(16).max(200),
  password: z.string().min(1).max(256),
});

/**
 * Consumes a reset token and sets the new password. Order: validate -> claim the token in a
 * transaction (single use even under concurrency) -> change the password at the identity
 * provider -> revoke every session -> unlock the account. If the provider fails the claim is
 * released again so the link keeps working.
 */
export async function resetPassword(
  deps: SysDeps,
  input: unknown,
  ctx: { address: string; requestId: string },
): Promise<void> {
  await deps.limiter.hit('token', ctx.address);
  const data = parseInput(resetSchema, input);
  const tokenId = hashToken(data.token);
  const user = await claimToken(
    deps,
    'reset',
    tokenId,
    data.password,
    ctx.requestId,
    'auth.password_reset',
  );
  await applyNewPassword(deps, user, data.password, tokenId);
  await revokeAllSessions(deps, user.id);
  for (const name of [user.email.toLowerCase(), user.employeeCode.toLowerCase()])
    await deps.throttle.unlockName(name);
}

export const activateSchema = z.object({
  token: z.string().min(16).max(200),
  password: z.string().min(1).max(256),
  consent: z.literal(true),
});

/** Invitation: sets the first password, accepts the usage policy and activates the account. */
export async function activateAccount(
  deps: SysDeps,
  input: unknown,
  ctx: { address: string; requestId: string },
): Promise<void> {
  await deps.limiter.hit('token', ctx.address);
  const data = parseInput(activateSchema, input);
  const tokenId = hashToken(data.token);
  const user = await claimToken(
    deps,
    'invite',
    tokenId,
    data.password,
    ctx.requestId,
    'user.activate',
    true,
  );
  await applyNewPassword(deps, user, data.password, tokenId);
}

async function claimToken(
  deps: SysDeps,
  kind: AuthToken['kind'],
  tokenId: string,
  password: string,
  requestId: string,
  action: string,
  activate = false,
): Promise<User> {
  const entry = hashForHistory(password);
  return deps.uow.run(async (tx) => {
    const t = await deps.tokens.findInTx(tx, tokenId);
    const now = deps.clock.now();
    const state = stateOf(t, kind, now);
    if (state !== 'valid' || !t)
      throw new AppError(TOKEN_ERRORS[state === 'valid' ? 'invalid' : state], 410);
    const user = await deps.users.getByIdInTx(tx, t.userId);
    if (!user || (kind === 'reset' ? user.status !== 'active' : user.status !== 'invited'))
      throw new AppError('token_invalid', 410);
    const history = await deps.users.passwordHistory(user.id);
    const violations = checkPasswordPolicy(password, history, deps.config.passwordPolicy);
    if (violations.length)
      throw new AppError(
        'validation_failed',
        422,
        passwordFields(violations, deps.config.passwordPolicy.minLength),
      );

    await deps.users.appendPasswordHistory(
      tx,
      user.id,
      entry,
      deps.config.passwordPolicy.historyDepth,
      activate
        ? { consent: { acceptedAt: now, policyVersion: deps.config.consentPolicyVersion } }
        : undefined,
    );
    // Firestore: every read of the transaction (history) happens before the first write
    deps.tokens.markUsed(tx, tokenId, now);
    if (activate)
      deps.users.update(tx, user.id, {
        status: 'active',
        updatedAt: now,
        updatedBy: user.id,
        version: user.version + 1,
      });
    deps.audit.record(tx, {
      id: deps.newId(),
      at: now,
      companyId: user.companyId,
      branchId: null,
      actorId: user.id,
      actorRoles: [],
      entityType: 'user',
      entityId: user.id,
      action,
      before: activate ? { status: 'invited' } : null,
      after: activate ? { status: 'active' } : null,
      requestId,
    });
    return user;
  });
}

async function applyNewPassword(
  deps: SysDeps,
  user: User,
  password: string,
  tokenId: string,
): Promise<void> {
  try {
    await deps.identity.setPassword(user.id, password);
  } catch (e) {
    // release the claim so the (still valid) link can be used again
    await deps.uow.run(async (tx) => {
      const t = await deps.tokens.findInTx(tx, tokenId);
      if (t) deps.tokens.unmarkUsed(tx, tokenId);
    });
    if (e instanceof IdentityUnavailableError)
      throw new AppError('unavailable', 503, [], { cause: e });
    throw e;
  }
}
