import { ObjectStorageNotConfiguredError, type SignedReadInput, type SignedUpload, type SignedUploadInput, type StorageServicePort, type StoredObjectMetadata } from "../storage.interface.js";

export class LocalMemoryStorageService implements StorageServicePort {
  readonly provider = "local" as const;
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  constructor(
    readonly bucket: string,
    private readonly baseUrl: string,
  ) {}

  async createSignedUpload(input: SignedUploadInput): Promise<SignedUpload> {
    return {
      method: "PUT",
      url: this.createDevUrl(input.key, input.expiresInSeconds, "write"),
      headers: {
        "Content-Type": input.contentType,
      },
    };
  }

  async getSignedReadUrl(input: SignedReadInput): Promise<string> {
    return this.createDevUrl(input.key, input.expiresInSeconds, "read");
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata | null> {
    const object = this.objects.get(key);
    if (!object) {
      return null;
    }

    return {
      key,
      contentType: object.contentType,
      size: object.body.byteLength,
    };
  }

  async readPrefix(key: string, byteLength: number): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (!object) {
      throw new ObjectStorageNotConfiguredError(this.provider);
    }

    return object.body.slice(0, byteLength);
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async getObject(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    return this.objects.get(key) ?? null;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  private createDevUrl(key: string, expiresInSeconds: number, action: "read" | "write"): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set("bucket", this.bucket);
    url.searchParams.set("key", key);
    url.searchParams.set("action", action);
    url.searchParams.set("expiresInSeconds", expiresInSeconds.toString());
    return url.toString();
  }
}
