import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  // Docker image build sets NEXT_OUTPUT=standalone (Cloud Run); plain `next start` is used locally and in e2e.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  // ADR 0001 §2: firebase-admin is server-only; never bundled for the browser.
  serverExternalPackages: ['firebase-admin', 'pino'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          // HSTS is honoured only over HTTPS (Cloud Run terminates TLS); harmless on localhost
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Content-Security-Policy with a per-request nonce is set in src/proxy.ts
        ],
      },
    ];
  },
};

export default withNextIntl(config);
