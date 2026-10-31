import pino, { type Logger } from 'pino';

/**
 * Structured JSON logs (ADR §7.11). Never log secrets or full personal data:
 * the redact list is a safety net, callers must still not pass such values.
 */
export const REDACT_PATHS = [
  'password',
  '*.password',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'headers.cookie',
  'headers.authorization',
  'idToken',
  '*.idToken',
  'sessionCookie',
  '*.sessionCookie',
  'phone',
  '*.phone',
  'address',
  '*.address',
];

const root: Logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'gmep' },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  // Cloud Logging severity mapping
  formatters: { level: (label) => ({ severity: label.toUpperCase() }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function requestLogger(requestId: string, extra: Record<string, unknown> = {}): Logger {
  return root.child({ requestId, ...extra });
}

export { root as rootLogger };
export type { Logger };
