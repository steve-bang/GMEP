import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { REDACT_PATHS } from './logger';

describe('log redaction (no secrets / full personal data in logs)', () => {
  it('redacts passwords, cookies, tokens, phone and address', () => {
    const lines: string[] = [];
    const log = pino(
      { redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } },
      { write: (s: string) => lines.push(s) },
    );
    log.info(
      {
        password: 'hunter2',
        headers: { cookie: 'session=abc' },
        customer: { phone: '0901234567', address: '1 Le Loi' },
        idToken: 'tok',
        userId: 'u1',
      },
      'x',
    );
    const out = lines.join('');
    for (const secret of ['hunter2', 'session=abc', '0901234567', '1 Le Loi', '"tok"'])
      expect(out).not.toContain(secret);
    expect(out).toContain('u1');
  });
});
