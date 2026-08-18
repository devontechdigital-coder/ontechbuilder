import { Inject, Injectable } from "@nestjs/common";
import { type AppConfig } from "../config/config.js";
import { APP_CONFIG } from "../config/config.provider.js";
import { GoogleCloudStorageService } from "./providers/google-cloud-storage/google-cloud-storage.service.js";
import { LocalMemoryStorageService } from "./providers/local-memory-storage.service.js";
import type { StorageProvider, StorageServicePort } from "./storage.interface.js";

export interface ObjectStorageConfig {
  provider: StorageProvider;
  bucket: string;
  gcsProjectId?: string;
  gcsClientEmail?: string;
  gcsPrivateKey?: string;
  gcsCredentialsFile?: string;
  localSignedUrlBaseUrl?: string;
}

@Injectable()
export class ObjectStorageService {
  readonly client: StorageServicePort;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const storageConfig = {
      provider: config.OBJECT_STORAGE_DRIVER,
      bucket: config.OBJECT_STORAGE_BUCKET,
      localSignedUrlBaseUrl: config.LOCAL_SIGNED_UPLOAD_BASE_URL,
      ...(config.GCS_PROJECT_ID ? { gcsProjectId: config.GCS_PROJECT_ID } : {}),
      ...(config.GCS_CLIENT_EMAIL ? { gcsClientEmail: config.GCS_CLIENT_EMAIL } : {}),
      ...(config.GCS_PRIVATE_KEY ? { gcsPrivateKey: config.GCS_PRIVATE_KEY } : {}),
      ...(config.GCS_CREDENTIALS_FILE ? { gcsCredentialsFile: config.GCS_CREDENTIALS_FILE } : {}),
    } satisfies ObjectStorageConfig;

    this.client =
      storageConfig.provider === "gcs"
        ? new GoogleCloudStorageService(storageConfig)
        : new LocalMemoryStorageService(
            storageConfig.bucket,
            storageConfig.localSignedUrlBaseUrl ?? "http://localhost:4000/dev/storage",
          );
  }
}
