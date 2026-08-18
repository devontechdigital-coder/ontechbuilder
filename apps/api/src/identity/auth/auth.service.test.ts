import { ConflictException, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { MembershipRole, Prisma } from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("AuthService", () => {
  it("registers a user, creates an owner membership, and never returns a password hash", async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: "user-a",
          email: "owner@example.com",
          displayName: "Owner",
        }),
      },
      organization: {
        create: vi.fn().mockResolvedValue({ id: "org-a" }),
      },
      tenant: {
        create: vi.fn().mockResolvedValue({ id: "tenant-a" }),
      },
      tenantMember: {
        create: vi.fn().mockResolvedValue({ id: "membership-a" }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const sessions = {
      createSession: vi.fn().mockResolvedValue({
        token: "session-token",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
    };
    const service = new AuthService(prisma as never, sessions as never);

    const result = await service.register({
      email: "OWNER@EXAMPLE.COM",
      password: "a-valid-password",
      displayName: "Owner",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "owner@example.com",
        passwordHash: expect.any(String),
      }),
      select: expect.not.objectContaining({ passwordHash: true }),
    });
    expect(tx.tenantMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: MembershipRole.OWNER,
      }),
    });
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("rejects duplicate email registration", async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(uniqueError()),
    };
    const service = new AuthService(prisma as never, { createSession: vi.fn() } as never);

    await expect(
      service.register({
        email: "user@example.com",
        password: "a-valid-password",
        displayName: "User",
        tenantName: "Tenant",
        tenantSlug: "tenant",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with valid credentials and returns a safe user shape", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-a",
          email: "user@example.com",
          displayName: "User",
          passwordHash: await bcrypt.hash("a-valid-password", 4),
          tenantMemberships: [{ tenantId: "tenant-a" }],
        }),
      },
    };
    const sessions = {
      createSession: vi.fn().mockResolvedValue({
        token: "session-token",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
    };
    const service = new AuthService(prisma as never, sessions as never);

    const result = await service.login({
      email: "USER@EXAMPLE.COM",
      password: "a-valid-password",
    });

    expect(sessions.createSession).toHaveBeenCalledWith("user-a", "tenant-a");
    expect(result.user).toEqual({
      id: "user-a",
      email: "user@example.com",
      displayName: "User",
    });
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("rejects invalid credentials", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new AuthService(prisma as never, { createSession: vi.fn() } as never);

    await expect(
      service.login({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
