import type { Metadata } from 'next';

/**
 * Pages for people without an account (customer quote link, FR-REC-008): no application shell, never
 * indexed, and the referrer is never sent so the token in the address cannot leak to another site.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="pub">{children}</div>;
}
