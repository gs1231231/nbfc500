/**
 * Prompt 40 - Document Storage Adapter
 * S3/MinIO object storage for KYC documents, loan agreements, and reports.
 * Mock uses local filesystem under /tmp/bankos-docs/; real uses AWS S3 / MinIO.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UploadRequest {
  /** Object key (path in bucket), e.g. "customers/cust-123/aadhaar-front.pdf" */
  key: string;
  /** File content as Buffer or base64 string */
  content: Buffer | string;
  /** MIME type */
  contentType: string;
  /** Optional metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Server-side encryption (default: AES256) */
  encryption?: 'AES256' | 'aws:kms';
}

export interface UploadResponse {
  key: string;
  bucket: string;
  /** ETag hash (MD5 of content for non-multipart) */
  etag: string;
  sizeBytes: number;
  uploadedAt: string;
  url?: string; // for non-signed public objects
}

export interface SignedUrlResponse {
  url: string;
  key: string;
  expiresAt: string;
}

export interface DeleteResponse {
  key: string;
  deleted: boolean;
  message: string;
}

export interface ListObjectsRequest {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface StorageObject {
  key: string;
  sizeBytes: number;
  lastModified: string;
  etag?: string;
}

export interface ListObjectsResponse {
  objects: StorageObject[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IDocumentStorageAdapter {
  /**
   * Upload a file to object storage.
   */
  upload(request: UploadRequest): Promise<UploadResponse>;

  /**
   * Generate a pre-signed URL for temporary access to a private object.
   */
  getSignedUrl(key: string, expirySeconds?: number): Promise<SignedUrlResponse>;

  /**
   * Delete an object from storage.
   */
  delete(key: string): Promise<DeleteResponse>;

  /**
   * List objects under a prefix.
   */
  listObjects(request?: ListObjectsRequest): Promise<ListObjectsResponse>;

  /**
   * Check if an object exists.
   */
  exists(key: string): Promise<boolean>;
}

// ─── Mock Adapter (local filesystem) ──────────────────────────────────────────

export class MockDocumentStorageAdapter implements IDocumentStorageAdapter {
  private readonly basePath: string;
  private readonly bucket = 'mock-bankos-docs';

  constructor(basePath = '/tmp/bankos-docs') {
    this.basePath = basePath;
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private filePath(key: string): string {
    return path.join(this.basePath, key.replace(/\//g, path.sep));
  }

  async upload(request: UploadRequest): Promise<UploadResponse> {
    const filePath = this.filePath(request.key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = typeof request.content === 'string'
      ? Buffer.from(request.content, 'base64')
      : request.content;

    fs.writeFileSync(filePath, content);

    const sizeBytes = content.length;
    const etag = `"${Buffer.from(request.key + sizeBytes).toString('hex').slice(0, 32)}"`;

    console.log(`[MockDocStorage] Uploaded | key: ${request.key} | size: ${sizeBytes} bytes | path: ${filePath}`);

    return {
      key: request.key,
      bucket: this.bucket,
      etag,
      sizeBytes,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getSignedUrl(key: string, expirySeconds = 3600): Promise<SignedUrlResponse> {
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
    const token = Buffer.from(`${key}:${expiresAt}`).toString('base64url');
    const url = `http://localhost:9000/${this.bucket}/${key}?token=${token}`;

    console.log(`[MockDocStorage] Signed URL | key: ${key} | expires: ${expiresAt}`);

    return { url, key, expiresAt };
  }

  async delete(key: string): Promise<DeleteResponse> {
    const filePath = this.filePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[MockDocStorage] Deleted | key: ${key}`);
      return { key, deleted: true, message: 'Object deleted successfully' };
    }
    return { key, deleted: false, message: 'Object not found' };
  }

  async listObjects(request: ListObjectsRequest = {}): Promise<ListObjectsResponse> {
    const prefix = request.prefix ?? '';
    const maxKeys = request.maxKeys ?? 1000;
    const searchDir = path.join(this.basePath, prefix);

    if (!fs.existsSync(searchDir)) {
      return { objects: [], isTruncated: false };
    }

    const collectFiles = (dir: string, base: string): StorageObject[] => {
      const results: StorageObject[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(base, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          results.push(...collectFiles(fullPath, relPath));
        } else {
          const stat = fs.statSync(fullPath);
          results.push({ key: relPath, sizeBytes: stat.size, lastModified: stat.mtime.toISOString() });
        }
      }
      return results;
    };

    const all = collectFiles(this.basePath, '').filter((o) => o.key.startsWith(prefix));
    const sliced = all.slice(0, maxKeys);

    return {
      objects: sliced,
      isTruncated: all.length > maxKeys,
    };
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.filePath(key));
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealDocumentStorageAdapter implements IDocumentStorageAdapter {
  async upload(_request: UploadRequest): Promise<UploadResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealDocumentStorageAdapter requires AWS S3 / MinIO credentials. ' +
        'Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and STORAGE_ADAPTER=real.',
    );
  }
  async getSignedUrl(_key: string, _expirySeconds?: number): Promise<SignedUrlResponse> {
    throw new Error('NOT_IMPLEMENTED: RealDocumentStorageAdapter.getSignedUrl()');
  }
  async delete(_key: string): Promise<DeleteResponse> {
    throw new Error('NOT_IMPLEMENTED: RealDocumentStorageAdapter.delete()');
  }
  async listObjects(_request?: ListObjectsRequest): Promise<ListObjectsResponse> {
    throw new Error('NOT_IMPLEMENTED: RealDocumentStorageAdapter.listObjects()');
  }
  async exists(_key: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: RealDocumentStorageAdapter.exists()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createDocumentStorageAdapter(): IDocumentStorageAdapter {
  if (process.env.STORAGE_ADAPTER === 'real') {
    return new RealDocumentStorageAdapter();
  }
  return new MockDocumentStorageAdapter(process.env.MOCK_STORAGE_PATH ?? '/tmp/bankos-docs');
}
