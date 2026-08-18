export type StorageProvider = "gcs" | "local";

export interface SignedUploadInput {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
}

export interface SignedUpload {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
}

export interface SignedReadInput {
  key: string;
  expiresInSeconds: number;
}

export interface StoredObjectMetadata {
  key: string;
  contentType?: string;
  size?: number;
}

export interface StorageServicePort {
  readonly provider: StorageProvider;
  readonly bucket: string;
  createSignedUpload(input: SignedUploadInput): Promise<SignedUpload>;
  getSignedReadUrl(input: SignedReadInput): Promise<string>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<StoredObjectMetadata | null>;
  readPrefix(key: string, byteLength: number): Promise<Uint8Array>;
  putObject?(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getObject?(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  deleteObject(key: string): Promise<void>;
}

export class ObjectStorageNotConfiguredError extends Error {
  constructor(provider: StorageProvider) {
    super(`Object storage provider "${provider}" is not configured`);
  }
}
