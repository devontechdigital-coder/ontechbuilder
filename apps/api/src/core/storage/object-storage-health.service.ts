import { Inject, Injectable } from "@nestjs/common";
import { type AppConfig } from "../config/config.js";
import { APP_CONFIG } from "../config/config.provider.js";
import { ObjectStorageService } from "./object-storage.service.js";

@Injectable()
export class ObjectStorageHealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async healthCheck(): Promise<boolean> {
    return this.storage.client.provider === this.config.OBJECT_STORAGE_DRIVER;
  }
}
