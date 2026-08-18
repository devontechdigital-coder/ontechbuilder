import { BadRequestException, Controller, Get, Inject, Put, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { type AppConfig } from "../config/config.js";
import { APP_CONFIG } from "../config/config.provider.js";
import { ObjectStorageService } from "./object-storage.service.js";

@Controller("dev/storage")
export class DevStorageController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  @Put()
  async putObject(@Req() request: Request, @Query("key") key: string, @Res() response: Response) {
    this.assertLocalStorage();
    const body = await readRequestBody(request, this.config.MEDIA_UPLOAD_MAX_FILE_BYTES);
    const contentType = request.headers["content-type"] ?? "application/octet-stream";
    await this.storage.client.putObject?.(requiredKey(key), body, Array.isArray(contentType) ? contentType[0] : contentType);
    response.status(204).send();
  }

  @Get()
  async getObject(@Query("key") key: string, @Res() response: Response) {
    this.assertLocalStorage();
    const object = await this.storage.client.getObject?.(requiredKey(key));

    if (!object) {
      response.status(404).send();
      return;
    }

    response.setHeader("Content-Type", object.contentType);
    response.send(Buffer.from(object.body));
  }

  private assertLocalStorage(): void {
    if (this.storage.client.provider !== "local") {
      throw new BadRequestException("Development storage endpoint is only available with local storage");
    }
  }
}

function requiredKey(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("tenants/")) {
    throw new BadRequestException("A tenant-scoped storage key is required");
  }

  return value;
}

function readRequestBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    request.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > maxBytes) {
        reject(new BadRequestException("File exceeds the configured size limit"));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    request.on("error", reject);
  });
}
