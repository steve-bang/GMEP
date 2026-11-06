/**
 * Minimal binary file port (ADR 0001 §7.3: files go through the server with the Admin SDK only; the browser never
 * talks to storage). Used for e-invoice XML and PDF (FR-EIN-006). Paths are server-chosen, never user input.
 * The adapter is Cloud Storage (Emulator in tests); an in-memory one serves the memory backend.
 */
export interface StoredFile {
  bytes: Uint8Array;
  contentType: string;
}

export interface FileStore {
  /** writes (overwrites) the file; resolves when it is durable */
  put(path: string, file: StoredFile): Promise<void>;
  /** null when missing */
  get(path: string): Promise<StoredFile | null>;
  /** removes the file; no error when it is missing (cleanup of a write whose transaction failed) */
  delete(path: string): Promise<void>;
}

/** Server-chosen, scope-prefixed object path: `<area>/<tenantId>/<branchId>/<name>` with no traversal possible. */
export function filePath(area: string, tenantId: string, branchId: string, name: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${safe(area)}/${safe(tenantId)}/${safe(branchId)}/${safe(name)}`;
}
