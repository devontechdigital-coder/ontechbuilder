import { ConflictException } from "@nestjs/common";
import { MembershipRole, Prisma } from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { TenantsService } from "./tenants.service.js";

function createUniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("TenantsService", () => {
  it("rejects duplicate memberships", async () => {
    const prisma = {
      tenantMember: {
        create: vi.fn().mockRejectedValue(createUniqueError()),
      },
    };
    const access = {
      assertTenantMember: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TenantsService(prisma as never, access as never);

    await expect(
      service.createMembership({
        actorUserId: "user-owner",
        tenantId: "tenant-a",
        userId: "user-b",
        role: MembershipRole.EDITOR,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
