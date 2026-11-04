import { getStorage } from 'firebase-admin/storage';
import type { Env } from '@/platform/config/env';
import type { FileStore, StoredFile } from '@/platform/files/fileStore';
import { getAdminApp } from '@/infrastructure/firestore/client';

/**
 * Cloud Storage adapter (Admin SDK, server only). With FIREBASE_STORAGE_EMULATOR_HOST set the SDK talks to the Emulator
 * Suite. The bucket is private (storage.rules deny all client access); reads go through the API after a Scope check.
 */
export class FirebaseFileStore implements FileStore {
  private readonly bucketName: string;
  constructor(private readonly env: Env) {
    this.bucketName = env.GMEP_FILES_BUCKET ?? `${env.GCLOUD_PROJECT}.appspot.com`;
  }
  private bucket() {
    return getStorage(getAdminApp(this.env)).bucket(this.bucketName);
  }
  async put(path: string, file: StoredFile): Promise<void> {
    await this.bucket()
      .file(path)
      .save(Buffer.from(file.bytes), { contentType: file.contentType, resumable: false });
  }
  async delete(path: string): Promise<void> {
    await this.bucket().file(path).delete({ ignoreNotFound: true });
  }
  async get(path: string): Promise<StoredFile | null> {
    const f = this.bucket().file(path);
    const [exists] = await f.exists();
    if (!exists) return null;
    const [bytes] = await f.download();
    const [meta] = await f.getMetadata();
    return {
      bytes: new Uint8Array(bytes),
      contentType: String(meta.contentType ?? 'application/octet-stream'),
    };
  }
}
