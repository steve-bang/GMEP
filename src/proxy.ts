import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request CSP nonce (NFR-SEC-02, OWASP ASVS V14). Next.js reads the nonce from the request's
 * CSP header and applies it to its own inline scripts. `style-src 'unsafe-inline'` stays because
 * React sets style attributes; scripts never need it. Other security headers are static
 * (next.config.ts). The browser may only talk to our own origin: connect-src 'self' enforces
 * "the browser never calls Firebase" (ADR 0001 §2.1) at the policy level too.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  // pages only: API routes return JSON/CSV and static assets need no policy
  matcher: [{ source: '/((?!api|_next/static|_next/image|icons.svg|favicon.ico).*)' }],
};
