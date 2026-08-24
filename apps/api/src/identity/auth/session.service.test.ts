import { ForbiddenException } from "@nestjs/common";
import { MembershipRole, MembershipStatus } from "../../core/database/database.js";
import type { AppConfig } from "../../core/config/config.js";
import { describe, expect, it, vi } from "vitest";
import { SessionService } from "./session.service.js";

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
  MEDIA_UPLOAD_MAX_BYTES: 1_000_000,
  MEDIA_UPLOAD_ALLOWED_MIME_TYPES: "image/jpeg,image/png",
  SESSION_SECRET: "a-secret-with-at-least-thirty-two-chars",
  SESSION_COOKIE_NAME: "stackbuilder_session",
  SESSION_TTL_DAYS: 7,
  SMTP_PORT: 587,
  SMTP_SECURE: false,
};

describe("SessionService", () => {
  it("stores only a hash of the session token", async () => {
    const sessionCreate = vi.fn().mockResolvedValue({});
    const service = new SessionService(config, {
      session: {
        create: sessionCreate,
      },
    } as never);

    const result = await service.createSession("user-a", "tenant-a");

    expect(result.token).toEqual(expect.any(String));
    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-a",
        activeTenantId: "tenant-a",
        tokenHash: service.hashToken(result.token),
      }),
    });
    expect(sessionCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ token: result.token }),
      }),
    );
  });

  it("resolves a valid session with active tenant membership", async () => {
    const service = new SessionService(config, {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: "session-a",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
          revokedAt: null,
          activeTenantId: "tenant-a",
          user: {
            id: "user-a",
            email: "user@example.com",
            displayName: "User",
          },
        }),
      },
      tenantMember: {
        findUnique: vi.fn().mockResolvedValue({
          role: MembershipRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        }),
      },
    } as never);

    await expect(service.resolveSession("token")).resolves.toMatchObject({
      sessionId: "session-a",
      user: {
        id: "user-a",
      },
      activeTenant: {
        id: "tenant-a",
        role: MembershipRole.ADMIN,
      },
    });
  });

  it("rejects expired or invalid sessions", async () => {
    const service = new SessionService(config, {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: "session-a",
          expiresAt: new Date("2000-01-01T00:00:00.000Z"),
          revokedAt: null,
          activeTenantId: null,
          user: {
            id: "user-a",
            email: "user@example.com",
            displayName: "User",
          },
        }),
      },
    } as never);

    await expect(service.resolveSession("expired")).resolves.toBeNull();
    await expect(service.resolveSession(null)).resolves.toBeNull();
  });

  it("revokes sessions on logout", async () => {
    const updateMany = vi.fn().mockResolvedValue({});
    const service = new SessionService(config, {
      session: {
        updateMany,
      },
    } as never);

    await service.revokeSession("token");

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: service.hashToken("token"),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it("allows switching only to a tenant with active membership", async () => {
    const service = new SessionService(config, {
      tenantMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      session: {
        update: vi.fn(),
      },
    } as never);

    await expect(service.setActiveTenant("session-a", "user-a", "tenant-b")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
