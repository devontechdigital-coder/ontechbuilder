import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { type AppConfig } from "../../core/config/config.js";
import { APP_CONFIG } from "../../core/config/config.provider.js";
import { MediaAccess, MediaStatus, Prisma } from "../../core/database/database.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { ObjectStorageService } from "../../core/storage/object-storage.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";

interface InitUploadInput {
  actorUserId: string;
  tenantId: string;
  originalFilename: unknown;
  mimeType: unknown;
  sizeBytes: unknown;
  width?: unknown;
  height?: unknown;
  access?: unknown;
}

interface CompleteUploadInput {
  actorUserId: string;
  tenantId: string;
  mediaId: string;
  uploadToken: unknown;
}

interface ListMediaInput {
  actorUserId: string;
  tenantId: string;
  query?: unknown;
  mimeType?: unknown;
  limit?: unknown;
  cursor?: unknown;
}

interface UploadTokenPayload {
  mediaId: string;
  tenantId: string;
  createdBy: string;
  originalFilename: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  width?: number;
  height?: number;
  access: MediaAccess;
  expiresAt: number;
}

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedFileTypes = new Set(["application/pdf"]);

@Injectable()
export class MediaMetadataService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async initUpload(input: InitUploadInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const upload = this.parseUpload(input);
    const mediaId = randomUUID();
    const storageKey = this.createStorageKey(input.tenantId, mediaId, upload.filename);
    const expiresInSeconds = this.config.OBJECT_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS;
    const expiresAt = Date.now() + expiresInSeconds * 1_000;

    const signedUpload = await this.storage.client.createSignedUpload({
      key: storageKey,
      contentType: upload.mimeType,
      contentLength: upload.sizeBytes,
      expiresInSeconds,
    });

    const tokenPayload: UploadTokenPayload = {
      mediaId,
      tenantId: input.tenantId,
      createdBy: input.actorUserId,
      originalFilename: upload.originalFilename,
      filename: upload.filename,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      storageKey,
      access: upload.access,
      expiresAt,
      ...(upload.width ? { width: upload.width } : {}),
      ...(upload.height ? { height: upload.height } : {}),
    };

    return {
      mediaId,
      storageKey,
      upload: signedUpload,
      uploadToken: this.signUploadToken(tokenPayload),
      expiresInSeconds,
    };
  }

  async completeUpload(input: CompleteUploadInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const token = this.verifyUploadToken(input.uploadToken);

    if (token.mediaId !== input.mediaId || token.tenantId !== input.tenantId || token.createdBy !== input.actorUserId) {
      throw new BadRequestException("Upload authorization does not match this request");
    }

    const metadata = await this.storage.client.getMetadata(token.storageKey);
    if (!metadata) {
      throw new BadRequestException("Uploaded object was not found in storage");
    }

    if (metadata.size !== undefined && metadata.size !== token.sizeBytes) {
      await this.storage.client.deleteObject(token.storageKey);
      throw new BadRequestException("Uploaded object size does not match authorization");
    }

    if (metadata.contentType && metadata.contentType.toLowerCase() !== token.mimeType) {
      await this.storage.client.deleteObject(token.storageKey);
      throw new BadRequestException("Uploaded object MIME type does not match authorization");
    }

    await this.assertStoredFileSignature(token.storageKey, token.mimeType);

    try {
      const media = await this.prisma.media.create({
        data: {
          id: token.mediaId,
          tenantId: token.tenantId,
          createdBy: token.createdBy,
          originalFilename: token.originalFilename,
          filename: token.filename,
          mimeType: token.mimeType,
          sizeBytes: BigInt(token.sizeBytes),
          storageKey: token.storageKey,
          storageProvider: this.storage.client.provider,
          bucket: this.storage.client.bucket,
          access: token.access,
          status: MediaStatus.READY,
          ...(token.width ? { width: token.width } : {}),
          ...(token.height ? { height: token.height } : {}),
        },
        select: mediaSelect,
      });
      return serializeMedia(media);
    } catch (error) {
      await this.storage.client.deleteObject(token.storageKey);
      throw mapUniqueError(error, "Media upload was already completed");
    }
  }

  async listMedia(input: ListMediaInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const pagination = parsePagination(input.limit, input.cursor);
    const query = optionalSearch(input.query);
    const mimeType = optionalMimeType(input.mimeType);

    const items = await this.prisma.media.findMany({
      where: {
        tenantId: input.tenantId,
        status: MediaStatus.READY,
        ...(mimeType ? { mimeType: { startsWith: mimeType } } : {}),
        ...(query
          ? {
              OR: [
                { originalFilename: { contains: query, mode: "insensitive" } },
                { filename: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: pagination.take,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
      select: mediaSelect,
    });

    return pageResult(items, pagination.limit);
  }

  async getMedia(actorUserId: string, tenantId: string, mediaId: string) {
    await this.access.assertMediaAccess(actorUserId, tenantId, mediaId);

    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        tenantId,
        status: MediaStatus.READY,
      },
      select: mediaSelect,
    });

    if (!media) {
      throw new NotFoundException("Media item was not found in this tenant");
    }

    return serializeMedia(media);
  }

  async getMediaAccess(actorUserId: string, tenantId: string, mediaId: string) {
    const media = await this.getMedia(actorUserId, tenantId, mediaId);
    const url = await this.storage.client.getSignedReadUrl({
      key: media.storageKey,
      expiresInSeconds: this.config.OBJECT_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS,
    });

    return {
      media: serializeMedia(media),
      url,
      expiresInSeconds: this.config.OBJECT_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS,
    };
  }

  async deleteMedia(actorUserId: string, tenantId: string, mediaId: string) {
    await this.access.assertMediaAccess(actorUserId, tenantId, mediaId);
    const media = await this.prisma.media.findFirstOrThrow({
      where: { id: mediaId, tenantId },
      select: { id: true, storageKey: true },
    });

    await this.storage.client.deleteObject(media.storageKey);
    await this.prisma.media.delete({
      where: {
        id: media.id,
        tenantId,
      },
    });

    return { id: media.id, deleted: true };
  }

  private parseUpload(input: InitUploadInput) {
    const originalFilename = requiredText(input.originalFilename, "originalFilename", 255);
    const filename = sanitizeFilename(originalFilename);
    const mimeType = requiredText(input.mimeType, "mimeType", 120).toLowerCase();
    const sizeBytes = parsePositiveInteger(input.sizeBytes, "sizeBytes", this.maxSizeForMimeType(mimeType));
    const access = parseAccess(input.access);
    const width = optionalPositiveInteger(input.width, "width");
    const height = optionalPositiveInteger(input.height, "height");

    assertAllowedMimeType(mimeType);
    assertExtensionMatchesMimeType(filename, mimeType);

    return {
      originalFilename,
      filename,
      mimeType,
      sizeBytes,
      access,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    };
  }

  private maxSizeForMimeType(mimeType: string): number {
    return allowedImageTypes.has(mimeType)
      ? this.config.MEDIA_UPLOAD_MAX_IMAGE_BYTES
      : this.config.MEDIA_UPLOAD_MAX_FILE_BYTES;
  }

  private createStorageKey(tenantId: string, mediaId: string, filename: string): string {
    return `tenants/${tenantId}/media/${mediaId}/${filename}`;
  }

  private signUploadToken(payload: UploadTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.config.SESSION_SECRET)
      .update(encodedPayload)
      .digest("base64url");
    return `${encodedPayload}.${signature}`;
  }

  private verifyUploadToken(value: unknown): UploadTokenPayload {
    const token = requiredText(value, "uploadToken", 4096);
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new BadRequestException("Upload token is invalid");
    }

    const expectedSignature = createHmac("sha256", this.config.SESSION_SECRET)
      .update(encodedPayload)
      .digest("base64url");

    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new BadRequestException("Upload token is invalid");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as UploadTokenPayload;
    if (Date.now() > payload.expiresAt) {
      throw new BadRequestException("Upload token has expired");
    }

    return payload;
  }

  private async assertStoredFileSignature(storageKey: string, mimeType: string): Promise<void> {
    if (!allowedImageTypes.has(mimeType)) {
      return;
    }

    const prefix = await this.storage.client.readPrefix(storageKey, 16);
    if (!matchesImageSignature(prefix, mimeType)) {
      await this.storage.client.deleteObject(storageKey);
      throw new BadRequestException("Uploaded image content does not match the declared file type");
    }
  }
}

export const mediaSelect = {
  id: true,
  tenantId: true,
  createdBy: true,
  originalFilename: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  storageKey: true,
  storageProvider: true,
  bucket: true,
  access: true,
  width: true,
  height: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MediaSelect;

function sanitizeFilename(value: string): string {
  const withoutPath = value.replace(/\\/g, "/").split("/").pop() ?? "file";
  const withoutControls = Array.from(withoutPath)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
  const dotIndex = withoutControls.lastIndexOf(".");
  const rawName = dotIndex > 0 ? withoutControls.slice(0, dotIndex) : withoutControls;
  const rawExtension = dotIndex > 0 ? withoutControls.slice(dotIndex + 1) : "";
  const name = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);

  if (!name || !extension) {
    throw new BadRequestException("Filename must include a safe name and extension");
  }

  return `${name}.${extension}`;
}

function assertAllowedMimeType(mimeType: string): void {
  if (!allowedImageTypes.has(mimeType) && !allowedFileTypes.has(mimeType)) {
    throw new BadRequestException("MIME type is not allowed");
  }
}

function assertExtensionMatchesMimeType(filename: string, mimeType: string): void {
  const extension = filename.split(".").pop();
  const allowedExtensions: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "application/pdf": ["pdf"],
  };

  if (!extension || !allowedExtensions[mimeType]?.includes(extension)) {
    throw new BadRequestException("Filename extension does not match MIME type");
  }
}

function parseAccess(value: unknown): MediaAccess {
  if (value === undefined || value === null || value === "") {
    return MediaAccess.PRIVATE;
  }

  const normalized = requiredText(value, "access", 20).toUpperCase();
  if (normalized === MediaAccess.PRIVATE || normalized === MediaAccess.PUBLIC) {
    return normalized;
  }

  throw new BadRequestException("access must be private or public");
}

function parsePositiveInteger(value: unknown, field: string, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }

  if (value > max) {
    throw new BadRequestException(`${field} exceeds the configured limit`);
  }

  return value;
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return parsePositiveInteger(value, field, 100_000);
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} is required`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BadRequestException(`${field} is invalid`);
  }

  return normalized;
}

function optionalSearch(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return requiredText(value, "query", 100);
}

function optionalMimeType(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const mimeType = requiredText(value, "mimeType", 120).toLowerCase();
  if (mimeType === "image" || mimeType === "application") {
    return `${mimeType}/`;
  }

  assertAllowedMimeType(mimeType);
  return mimeType;
}

function parsePagination(
  limit: unknown,
  cursor: unknown,
): { limit: number; take: number; cursor?: string } {
  const parsedLimit =
    limit === undefined
      ? 24
      : Number.parseInt(typeof limit === "string" ? limit : String(limit), 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 60) {
    throw new BadRequestException("limit must be between 1 and 60");
  }

  const parsedCursor = cursor === undefined ? undefined : requiredText(cursor, "cursor", 80);
  return {
    limit: parsedLimit,
    take: parsedLimit + 1,
    ...(parsedCursor ? { cursor: parsedCursor } : {}),
  };
}

function pageResult<T extends { id: string; sizeBytes?: bigint | number }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return {
    data: data.map(serializeMedia),
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
}

function serializeMedia<T extends { sizeBytes?: bigint | number }>(item: T) {
  return {
    ...item,
    ...(typeof item.sizeBytes === "bigint" ? { sizeBytes: Number(item.sizeBytes) } : {}),
  };
}

function matchesImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }

  if (mimeType === "image/gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  }

  if (mimeType === "image/webp") {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  return false;
}

function mapUniqueError(error: unknown, message: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(message);
  }

  return error instanceof Error ? error : new Error("Unexpected database error");
}
