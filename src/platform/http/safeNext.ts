/**
 * Post-login return URL sanitiser (open-redirect guard). Only same-origin relative paths pass:
 * one leading '/', never '//' or '/\', no scheme, no control characters. Anything else is '/'.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return '/';
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return '/';
  // /login itself would loop back; treat as home
  if (/^\/login(?:[/?#]|$)/.test(raw)) return '/';
  return raw;
}
