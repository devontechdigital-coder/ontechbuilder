import { BadRequestException, NotFoundException } from "@nestjs/common";
import { type AppConfig } from "../../core/config/config.js";
import { MediaAccess, MediaStatus } from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { MediaMetadataService } from "./media-metadata.service.js";

const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 4000,
  API_BASE_URL: "http://localhost:4000",
  ADMIN_WEB_URL: "http://localhost:3000",
  SITE_RENDERER_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  OBJECT_STORAGE_DRIVER: "local",
  OBJECT_STORAGE_BUCKET: "stackbuilder-test",
  OBJECT_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS: 300,
  LOCAL_SIGNED_UPLOAD_BASE_URL: "http://localhost:4000/dev/storage",
  MEDIA_UPLOAD_MAX_IMAGE_BYTES: 1_000_000,
  MEDIA_UPLOAD_MAX_FILE_BYTES: 2_000_000,
  MEDIA_UPLOAD_MAX_BYTES: 2_000_000,
  MEDIA_UPLOAD_ALLOWED_MIME_TYPES: "image/jpeg,image/png,image/webp,image/gif,application/pdf",
  SESSION_SECRET: "a-secret-with-at-least-thirty-two-chars",
  SESSION_COOKIE_NAME: "stackbuilder_session",
  SESSION_TTL_DAYS: 7,
  SMTP_PORT: 587,
  SMTP_SECURE: false,
};

function createService(options?: { denyMediaAccess?: boolean }) {
  const createdMedia = {
    id: "media-a",
    tenantId: "tenant-a",
    createdBy: "user-a",
    originalFilename: "Hero Image.png",
    filename: "hero-image.png",
    mimeType: "image/png",
    sizeBytes: BigInt(8),
    storageKey: "tenants/tenant-a/media/media-a/hero-image.png",
    storageProvider: "local",
    bucket: "stackbuilder-test",
    access: MediaAccess.PRIVATE,
    width: null,
    height: null,
    status: MediaStatus.READY,
    createdAt: new Date("2026-08-11T00:00:00.000Z"),
    updatedAt: new Date("2026-08-11T00:00:00.000Z"),
  };

  const prisma = {
    media: {
      create: vi.fn().mockResolvedValue(createdMedia),
      findMany: vi.fn().mockResolvedValue([createdMedia]),
      findFirst: vi.fn().mockResolvedValue(createdMedia),
      findFirstOrThrow: vi.fn().mockResolvedValue(createdMedia),
      delete: vi.fn().mockResolvedValue({ id: "media-a" }),
    },
  };
  const storage = {
    client: {
      provider: "local",
      bucket: "stackbuilder-test",
      createSignedUpload: vi.fn().mockResolvedValue({
        method: "PUT",
        url: "http://localhost:4000/dev/storage?key=test",
        headers: { "Content-Type": "image/png" },
      }),
      getMetadata: vi.fn().mockResolvedValue({
        key: "tenants/tenant-a/media/media-a/hero-image.png",
        contentType: "image/png",
        size: 8,
      }),
      readPrefix: vi.fn().mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
      getSignedReadUrl: vi.fn().mockResolvedValue("http://localhost:4000/dev/storage?key=test&action=read"),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    },
  };
  const access = {
    assertTenantMember: vi.fn().mockResolvedValue(undefined),
    assertWebsiteAccess: vi.fn().mockResolvedValue(undefined),
    assertMediaAccess: options?.denyMediaAccess
      ? vi.fn().mockRejectedValue(new NotFoundException("not found"))
      : vi.fn().mockResolvedValue(undefined),
  };

  return {
    prisma,
    storage,
    access,
    service: new MediaMetadataService(config, prisma as never, storage as never, access as never),
  };
}

describe("MediaMetadataService", () => {
  it("creates tenant-scoped signed upload authorization without a database row", async () => {
    const { service, prisma, storage } = createService();

    const result = await service.initUpload({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      originalFilename: "../Hero Image.png",
      mimeType: "image/png",
      sizeBytes: 8,
    });

    expect(result.storageKey).toMatch(/^tenants\/tenant-a\/media\/.+\/hero-image\.png$/);
    expect(result.storageKey).not.toContain("..");
    expect(storage.client.createSignedUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        key: result.storageKey,
        contentType: "image/png",
        contentLength: 8,
      }),
    );
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("rejects MIME mismatch, invalid extension, and oversized uploads", async () => {
    const { service } = createService();

    await expect(
      service.initUpload({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        originalFilename: "script.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 8,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.initUpload({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        originalFilename: "hero.jpg",
        mimeType: "image/png",
        sizeBytes: 8,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.initUpload({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        originalFilename: "large.png",
        mimeType: "image/png",
        sizeBytes: 1_000_001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("completes media only after storage confirmation and image signature validation", async () => {
    const { service, prisma, storage } = createService();
    const init = await service.initUpload({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      originalFilename: "Hero Image.png",
      mimeType: "image/png",
      sizeBytes: 8,
    });

    const media = await service.completeUpload({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      mediaId: init.mediaId,
      uploadToken: init.uploadToken,
    });

    expect(storage.client.getMetadata).toHaveBeenCalledWith(init.storageKey);
    expect(storage.client.readPrefix).toHaveBeenCalledWith(init.storageKey, 16);
    expect(prisma.media.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: init.mediaId,
        tenantId: "tenant-a",
        createdBy: "user-a",
        filename: "hero-image.png",
        storageKey: init.storageKey,
        status: MediaStatus.READY,
      }),
      select: expect.any(Object),
    });
    expect(media.sizeBytes).toBe(8);
  });

  it("rejects completion when image bytes do not match the declared type", async () => {
    const { service, storage } = createService();
    storage.client.readPrefix.mockResolvedValue(new Uint8Array([0x00, 0x00, 0x00]));
    const init = await service.initUpload({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      originalFilename: "Hero Image.png",
      mimeType: "image/png",
      sizeBytes: 8,
    });

    await expect(
      service.completeUpload({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        mediaId: init.mediaId,
        uploadToken: init.uploadToken,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.client.deleteObject).toHaveBeenCalledWith(init.storageKey);
  });

  it("lists tenant media with pagination and filters", async () => {
    const { service, prisma } = createService();

    await service.listMedia({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      query: "hero",
      mimeType: "image",
      limit: "12",
    });

    expect(prisma.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          mimeType: { startsWith: "image/" },
        }),
        take: 13,
      }),
    );
  });

  it("rejects cross-tenant media reads and deletes before storage/database writes", async () => {
    const { service, prisma, storage, access } = createService({ denyMediaAccess: true });

    await expect(service.getMedia("user-a", "tenant-a", "media-b")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteMedia("user-a", "tenant-a", "media-b")).rejects.toBeInstanceOf(NotFoundException);

    expect(access.assertMediaAccess).toHaveBeenCalledWith("user-a", "tenant-a", "media-b");
    expect(storage.client.deleteObject).not.toHaveBeenCalled();
    expect(prisma.media.delete).not.toHaveBeenCalled();
  });

  it("deletes storage before deleting the metadata row", async () => {
    const { service, prisma, storage } = createService();

    await expect(service.deleteMedia("user-a", "tenant-a", "media-a")).resolves.toEqual({
      id: "media-a",
      deleted: true,
    });

    expect(storage.client.deleteObject).toHaveBeenCalledWith("tenants/tenant-a/media/media-a/hero-image.png");
    expect(prisma.media.delete).toHaveBeenCalledWith({
      where: { id: "media-a", tenantId: "tenant-a" },
    });
  });
});
