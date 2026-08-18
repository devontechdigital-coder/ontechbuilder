import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MembershipStatus } from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { TenantAccessService } from "./tenant-access.service.js";

function createService(options?: {
  membership?: { status: MembershipStatus } | null;
  website?: { id: string } | null;
  domain?: { id: string } | null;
  media?: { id: string } | null;
}) {
  const membership =
    options && "membership" in options ? options.membership : { status: MembershipStatus.ACTIVE };
  const website = options && "website" in options ? options.website : { id: "website-a" };
  const domain = options && "domain" in options ? options.domain : { id: "domain-a" };
  const media = options && "media" in options ? options.media : { id: "media-a" };

  const prisma = {
    tenantMember: {
      findUnique: vi.fn().mockResolvedValue(membership),
    },
    website: {
      findFirst: vi.fn().mockResolvedValue(website),
    },
    domain: {
      findFirst: vi.fn().mockResolvedValue(domain),
    },
    media: {
      findFirst: vi.fn().mockResolvedValue(media),
    },
  };

  return {
    prisma,
    service: new TenantAccessService(prisma as never),
  };
}

describe("TenantAccessService", () => {
  it("rejects a user who is not a member of the tenant", async () => {
    const { service } = createService({ membership: null });

    await expect(service.assertTenantMember("user-a", "tenant-a")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("prevents Tenant A from accessing Tenant B's website", async () => {
    const { service, prisma } = createService({ website: null });

    await expect(
      service.assertWebsiteAccess("user-a", "tenant-a", "website-b"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.website.findFirst).toHaveBeenCalledWith({
      where: {
        id: "website-b",
        tenantId: "tenant-a",
      },
      select: {
        id: true,
      },
    });
  });

  it("prevents Tenant A from accessing Tenant B's domain", async () => {
    const { service, prisma } = createService({ domain: null });

    await expect(
      service.assertDomainAccess("user-a", "tenant-a", "domain-b"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.domain.findFirst).toHaveBeenCalledWith({
      where: {
        id: "domain-b",
        tenantId: "tenant-a",
      },
      select: {
        id: true,
      },
    });
  });

  it("prevents Tenant A from accessing Tenant B's media metadata", async () => {
    const { service, prisma } = createService({ media: null });

    await expect(service.assertMediaAccess("user-a", "tenant-a", "media-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.media.findFirst).toHaveBeenCalledWith({
      where: {
        id: "media-b",
        tenantId: "tenant-a",
      },
      select: {
        id: true,
      },
    });
  });
});
