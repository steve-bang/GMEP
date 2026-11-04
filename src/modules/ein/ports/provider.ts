import type { ErrorKind } from '../domain/invoice';

/**
 * Provider-agnostic e-invoice port (FR-EIN-004, ADR 0001 §7.8). The client has a provider but does not want hard
 * dependence on it: no provider type leaks past this file; each adapter maps its own statuses and errors onto these.
 * Calls are IDEMPOTENT by `clientRequestId`: sending the same id twice never creates a second invoice at the provider
 * (an adapter whose provider has no such key must emulate it by looking the invoice up first). The application also asks
 * `query` BEFORE any resend after a timeout (FR-EIN-013).
 */
export interface ProviderParty {
  kind: 'retail' | 'business';
  name: string;
  taxCode?: string;
  address?: string;
  email?: string;
}

export interface ProviderLine {
  no: number;
  description: string;
  quantityText?: string;
  netVnd: number;
  rateBp: number;
}

export interface ProviderDraft {
  clientRequestId: string;
  docType: 'original' | 'adjustment' | 'replacement';
  issuer: {
    sellerName: string;
    sellerTaxCode: string;
    sellerAddress?: string;
    symbol: string;
    invoiceType: 'vat' | 'sales';
    templateCode: string;
  };
  buyer: ProviderParty;
  lines: ProviderLine[];
  taxSummary: { rateBp: number; netVnd: number; taxVnd: number }[];
  netVnd: number;
  taxVnd: number;
  totalVnd: number;
  orderNumber: string;
  /** adjustment / replacement: the invoice being corrected, as the provider knows it */
  reference?: {
    providerInvoiceId: string;
    number: string;
    symbol: string;
    reason: string;
  };
}

/** The provider-neutral status set; every adapter maps its own onto it (the mapping is the adapter's configuration). */
export type ProviderState = 'issued' | 'processing' | 'cancelled';

export interface ProviderResult {
  state: ProviderState;
  providerInvoiceId: string;
  number?: string;
  symbol?: string;
  taxAuthorityCode?: string;
  issuedAt?: Date;
  /** the provider's own status text, kept for diagnosis only */
  rawStatus: string;
}

export type ProviderQueryResult = { found: false } | { found: true; result: ProviderResult };

export interface ProviderArtifacts {
  xml: string;
  pdf: Uint8Array;
}

export class ProviderError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly code: string,
    message: string,
    /** data errors: the fields the provider objected to (never values) */
    readonly fields: string[] = [],
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface EInvoiceProvider {
  readonly code: string;
  issue(draft: ProviderDraft): Promise<ProviderResult>;
  cancel(input: {
    clientRequestId: string;
    providerInvoiceId: string;
    reason: string;
  }): Promise<ProviderResult>;
  /** looks the request up by the key it was sent with; `found:false` = the provider holds nothing for it */
  query(input: { clientRequestId: string }): Promise<ProviderQueryResult>;
  /** the current provider-side status of an invoice that already exists (FR-EIN-005) */
  getStatus(providerInvoiceId: string): Promise<ProviderResult>;
  fetchArtifacts(providerInvoiceId: string): Promise<ProviderArtifacts>;
}

/** Resolves the adapter configured for an issuer (provider code + environment). The test and live environments never mix. */
export interface ProviderRegistry {
  get(code: string, environment: 'test' | 'live'): EInvoiceProvider | null;
  /** codes this build can talk to, for the connection page */
  codes(): string[];
}
