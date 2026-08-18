import { Storage } from "@google-cloud/storage";
import type { ObjectStorageConfig } from "../../object-storage.service.js";
import type { SignedReadInput, SignedUpload, SignedUploadInput, StorageServicePort, StoredObjectMetadata } from "../../storage.interface.js";

export class GoogleCloudStorageService implements StorageServicePort {
  readonly provider = "gcs" as const;
  readonly bucket: string;
  private readonly storage: Storage;

  constructor(private readonly config: ObjectStorageConfig) {
    this.bucket = config.bucket;
    this.storage = new Storage(createGcsClientOptions(config));
  }

  async createSignedUpload(input: SignedUploadInput): Promise<SignedUpload> {
    const [url] = await this.storage
      .bucket(this.bucket)
      .file(input.key)
      .getSignedUrl({
        action: "write",
        contentType: input.contentType,
        expires: Date.now() + input.expiresInSeconds * 1_000,
        version: "v4",
      });

    return {
      method: "PUT",
      url,
      headers: {
        "Content-Type": input.contentType,
      },
    };
  }

  async getSignedReadUrl(input: SignedReadInput): Promise<string> {
    const [url] = await this.storage
      .bucket(this.bucket)
      .file(input.key)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + input.expiresInSeconds * 1_000,
        version: "v4",
      });

    return url;
  }

  async exists(key: string): Promise<boolean> {
    const [exists] = await this.storage.bucket(this.bucket).file(key).exists();
    return exists;
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata | null> {
    const file = this.storage.bucket(this.bucket).file(key);
    const [exists] = await file.exists();

    if (!exists) {
      return null;
    }

    const [metadata] = await file.getMetadata();
    const size = typeof metadata.size === "string" ? Number.parseInt(metadata.size, 10) : undefined;
    const result: StoredObjectMetadata = { key };

    if (metadata.contentType) {
      result.contentType = metadata.contentType;
    }

    if (size !== undefined && Number.isFinite(size)) {
      result.size = size;
    }

    return result;
  }

  async readPrefix(key: string, byteLength: number): Promise<Uint8Array> {
    const [buffer] = await this.storage
      .bucket(this.bucket)
      .file(key)
      .download({ start: 0, end: Math.max(0, byteLength - 1) });

    return new Uint8Array(buffer);
  }

  async deleteObject(key: string): Promise<void> {
    await this.storage.bucket(this.bucket).file(key).delete({ ignoreNotFound: true });
  }
}

function createGcsClientOptions(
  config: ObjectStorageConfig,
): ConstructorParameters<typeof Storage>[0] {
  const projectIdOption = config.gcsProjectId ? { projectId: config.gcsProjectId } : {};

  if (config.gcsCredentialsFile) {
    return {
      keyFilename: config.gcsCredentialsFile,
      ...projectIdOption,
    };
  }

  if (config.gcsClientEmail && config.gcsPrivateKey) {
    return {
      credentials: {
        client_email: config.gcsClientEmail,
        private_key: config.gcsPrivateKey.replace(/\\n/g, "\n"),
      },
      ...projectIdOption,
    };
  }

  return projectIdOption;
}
