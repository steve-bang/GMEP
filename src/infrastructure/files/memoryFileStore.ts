import type { FileStore, StoredFile } from '@/platform/files/fileStore';

/** In-memory file store: TEST / LOCAL USE ONLY (memory backend). */
export class MemoryFileStore implements FileStore {
  readonly files = new Map<string, StoredFile>();
  async put(path: string, file: StoredFile): Promise<void> {
    this.files.set(path, { bytes: new Uint8Array(file.bytes), contentType: file.contentType });
  }
  async get(path: string): Promise<StoredFile | null> {
    const f = this.files.get(path);
    return f ? { bytes: new Uint8Array(f.bytes), contentType: f.contentType } : null;
  }
}
