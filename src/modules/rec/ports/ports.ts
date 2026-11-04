import type { Page } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { Intake, IntakeStatus, Quote, QuoteStatus, QuoteVersion } from '../domain/entities';

type Cursor = { v: string; id: string };
export interface PageQuery {
  limit: number;
  cursor?: Cursor;
}

/** Every read takes a Scope (NFR-ISO-01): intakes, quotes and versions are branch records. */
export interface IntakeRepository {
  list(
    scope: Scope,
    q: PageQuery & {
      status?: IntakeStatus;
      platePrefix?: string;
      numberPrefix?: string;
    },
  ): Promise<Page<Intake>>;
  get(scope: Scope, id: string): Promise<Intake | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Intake | null>;
  /** C17: company-wide (retention gate), no scope: only counts, never returned to a user */
  listByCustomer(
    companyId: string,
    customerId: string,
    status: IntakeStatus,
    limit: number,
  ): Promise<Intake[]>;
  create(tx: Tx, i: Intake): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface QuoteRepository {
  list(
    scope: Scope,
    q: PageQuery & {
      status?: QuoteStatus;
      platePrefix?: string;
      numberPrefix?: string;
    },
  ): Promise<Page<Quote>>;
  get(scope: Scope, id: string): Promise<Quote | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Quote | null>;
  listByCustomer(
    companyId: string,
    customerId: string,
    status: QuoteStatus,
    limit: number,
  ): Promise<Quote[]>;
  create(tx: Tx, q: Quote): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface QuoteVersionRepository {
  get(scope: Scope, id: string): Promise<QuoteVersion | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<QuoteVersion | null>;
  /** versions 1..n of one quote, oldest first, inside the scope */
  listByQuote(scope: Scope, quoteId: string, count: number): Promise<QuoteVersion[]>;
  create(tx: Tx, v: QuoteVersion): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}
