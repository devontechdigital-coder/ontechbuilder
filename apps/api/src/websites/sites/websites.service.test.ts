import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import {
  DomainStatus,
  DomainVerificationStatus,
  Prisma,
  WebsiteStatus,
} from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { normalizeHostname, WebsitesService } from "./websites.service.js";

function createAccess(overrides?: Partial<Record<"tenant" | "website" | "domain", Error | null>>) {
  return {
    assertTenantMember: vi.fn().mockImplementation(() => {
      if (overrides?.tenant) {
        throw overrides.tenant;
      }
    }),
    assertWebsiteAccess: vi.fn().mockImplementation(() => {
      if (overrides?.website) {
        throw overrides.website;
      }
    }),
    assertDomainAccess: vi.fn().mockImplementation(() => {
      if (overrides?.domain) {
        throw overrides.domain;
      }
    }),
  };
}

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("WebsitesService", () => {
  it("creates a draft website scoped to the tenant", async () => {
    const prisma = {
      website: {
        create: vi.fn().mockResolvedValue({ id: "website-a" }),
      },
    };
    const access = createAccess();
    const service = new WebsitesService(prisma as never, access as never);

    await expect(
      service.createWebsite({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        name: "Main Site",
        slug: "main-site",
      }),
    ).resolves.toEqual({ id: "website-a" });

    expect(prisma.website.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        name: "Main Site",
        slug: "main-site",
        status: WebsiteStatus.DRAFT,
        themes: {
          create: {
            name: "Default theme",
            tokens: expect.any(Object),
            isActive: true,
          },
        },
      },
      select: expect.any(Object),
    });
  });

  it("lists websites with tenant filtering and cursor pagination", async () => {
    const prisma = {
      website: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "website-a" }, { id: "website-b" }, { id: "website-c" }]),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(
      service.listWebsites({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        limit: "2",
        cursor: "cursor-a",
      }),
    ).resolves.toEqual({
      data: [{ id: "website-a" }, { id: "website-b" }],
      nextCursor: "website-b",
    });

    expect(prisma.website.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        status: {
          not: WebsiteStatus.ARCHIVED,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
      cursor: {
        id: "cursor-a",
      },
      skip: 1,
      select: expect.any(Object),
    });
  });

  it("gets and updates websites only by tenant scope", async () => {
    const prisma = {
      website: {
        findFirstOrThrow: vi.fn().mockResolvedValue({ id: "website-a" }),
        update: vi.fn().mockResolvedValue({ id: "website-a", status: WebsiteStatus.PUBLISHED }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await service.getWebsite("user-a", "tenant-a", "website-a");
    await service.updateWebsite({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      websiteId: "website-a",
      name: "Renamed",
      slug: "renamed",
      status: "published",
    });

    expect(prisma.website.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        id: "website-a",
        tenantId: "tenant-a",
      },
      select: expect.any(Object),
    });
    expect(prisma.website.update).toHaveBeenCalledWith({
      where: {
        id: "website-a",
        tenantId: "tenant-a",
      },
      data: {
        name: "Renamed",
        slug: "renamed",
        status: WebsiteStatus.PUBLISHED,
      },
      select: expect.any(Object),
    });
  });

  it("archives a website instead of deleting it", async () => {
    const prisma = {
      website: {
        update: vi.fn().mockResolvedValue({ id: "website-a", status: WebsiteStatus.ARCHIVED }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(service.archiveWebsite("user-a", "tenant-a", "website-a")).resolves.toEqual({
      id: "website-a",
      status: WebsiteStatus.ARCHIVED,
    });

    expect(prisma.website.update).toHaveBeenCalledWith({
      where: {
        id: "website-a",
        tenantId: "tenant-a",
      },
      data: {
        status: WebsiteStatus.ARCHIVED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  });

  it("maps duplicate website slugs to conflict while allowing other tenants through DB scope", async () => {
    const prisma = {
      website: {
        create: vi.fn().mockRejectedValue(uniqueError()),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(
      service.createWebsite({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        name: "Main",
        slug: "main",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.website.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-a",
          slug: "main",
        }),
      }),
    );
  });

  it("allows the same website slug to be created in a different tenant", async () => {
    const prisma = {
      website: {
        create: vi.fn().mockResolvedValue({ id: "website-b", tenantId: "tenant-b", slug: "main" }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(
      service.createWebsite({
        actorUserId: "user-b",
        tenantId: "tenant-b",
        name: "Main",
        slug: "main",
      }),
    ).resolves.toEqual({ id: "website-b", tenantId: "tenant-b", slug: "main" });

    expect(prisma.website.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-b",
          slug: "main",
        }),
      }),
    );
  });

  it("rejects cross-tenant website reads, updates, and archive before writing", async () => {
    const prisma = {
      website: {
        findFirstOrThrow: vi.fn().mockRejectedValue(new NotFoundException("not found")),
        update: vi.fn(),
      },
    };
    const access = createAccess({
      website: new NotFoundException("not found"),
    });
    const service = new WebsitesService(prisma as never, access as never);

    await expect(service.getWebsite("user-a", "tenant-a", "website-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateWebsite({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        websiteId: "website-b",
        name: "Bad",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.archiveWebsite("user-a", "tenant-a", "website-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.website.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        id: "website-b",
        tenantId: "tenant-a",
      },
      select: expect.any(Object),
    });
    expect(prisma.website.update).not.toHaveBeenCalled();
  });

  it("creates a default active theme when a website has no theme", async () => {
    const prisma = {
      websiteTheme: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "theme-a", websiteId: "website-a", isActive: true }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(service.getTheme("user-a", "tenant-a", "website-a")).resolves.toEqual({
      id: "theme-a",
      websiteId: "website-a",
      isActive: true,
    });

    expect(prisma.websiteTheme.create).toHaveBeenCalledWith({
      data: {
        websiteId: "website-a",
        name: "Default theme",
        tokens: expect.any(Object),
        isActive: true,
      },
      select: expect.any(Object),
    });
  });

  it("updates and resets theme tokens after website access is verified", async () => {
    const prisma = {
      websiteTheme: {
        findFirst: vi.fn().mockResolvedValue({ id: "theme-a", tokens: {} }),
        update: vi.fn().mockResolvedValue({ id: "theme-a", name: "Brand", tokens: { colors: { primary: "#123456" } } }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await service.updateTheme({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      websiteId: "website-a",
      name: "Brand",
      tokens: { colors: { primary: "#123456" } },
    });
    await service.resetTheme("user-a", "tenant-a", "website-a");

    expect(prisma.websiteTheme.update).toHaveBeenCalledWith({
      where: { id: "theme-a" },
      data: {
        name: "Brand",
        tokens: expect.objectContaining({
          colors: expect.objectContaining({ primary: "#123456" }),
        }),
      },
      select: expect.any(Object),
    });
    expect(prisma.websiteTheme.update).toHaveBeenLastCalledWith({
      where: { id: "theme-a" },
      data: {
        name: "Default theme",
        tokens: expect.any(Object),
      },
      select: expect.any(Object),
    });
  });

  it("rejects invalid theme values", async () => {
    const prisma = {
      websiteTheme: {
        findFirst: vi.fn().mockResolvedValue({ id: "theme-a", tokens: {} }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(
      service.updateTheme({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        websiteId: "website-a",
        tokens: { colors: { primary: "javascript:alert(1)" } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("DomainsService behavior inside WebsitesService", () => {
  it("normalizes hostnames and rejects invalid input", () => {
    expect(normalizeHostname(" HTTPS://Example.com/path?x=1 ")).toBe("example.com");
    expect(normalizeHostname("example.com.")).toBe("example.com");
    expect(() => normalizeHostname("bad_host")).toThrow(BadRequestException);
  });

  it("adds a pending domain with tenant and website ownership", async () => {
    const domainCreate = vi.fn().mockResolvedValue({ id: "domain-a" });
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          domain: {
            create: domainCreate,
            updateMany,
          },
        }),
      ),
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await service.createDomain({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      websiteId: "website-a",
      hostname: "Example.COM.",
      isPrimary: true,
    });

    expect(domainCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        websiteId: "website-a",
        hostname: "example.com",
        normalizedHostname: "example.com",
        status: DomainStatus.PENDING,
        isPrimary: true,
        verificationStatus: DomainVerificationStatus.PENDING,
        verificationToken: expect.any(String),
      },
      select: expect.any(Object),
    });
  });

  it("rejects duplicate normalized hostnames", async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(uniqueError()),
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(
      service.createDomain({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        websiteId: "website-a",
        hostname: "example.com",
        isPrimary: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("sets the primary domain transactionally", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ id: "domain-b", isPrimary: true });
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          domain: {
            findFirst: vi.fn().mockResolvedValue({ id: "domain-b", websiteId: "website-a" }),
            updateMany,
            update,
          },
        }),
      ),
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await expect(service.setPrimaryDomain("user-a", "tenant-a", "domain-b")).resolves.toEqual({
      id: "domain-b",
      isPrimary: true,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        websiteId: "website-a",
        isPrimary: true,
        id: {
          not: "domain-b",
        },
      },
      data: {
        isPrimary: false,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "domain-b",
        tenantId: "tenant-a",
      },
      data: {
        isPrimary: true,
      },
      select: expect.any(Object),
    });
  });

  it("disables a domain and removes primary status", async () => {
    const prisma = {
      domain: {
        update: vi.fn().mockResolvedValue({ id: "domain-a", status: DomainStatus.DISABLED }),
      },
    };
    const service = new WebsitesService(prisma as never, createAccess() as never);

    await service.disableDomain("user-a", "tenant-a", "domain-a");

    expect(prisma.domain.update).toHaveBeenCalledWith({
      where: {
        id: "domain-a",
        tenantId: "tenant-a",
      },
      data: {
        status: DomainStatus.DISABLED,
        isPrimary: false,
      },
      select: expect.any(Object),
    });
  });

  it("rejects cross-tenant domain management before writing", async () => {
    const prisma = {
      domain: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const access = createAccess({
      domain: new NotFoundException("not found"),
    });
    const service = new WebsitesService(prisma as never, access as never);

    await expect(service.setPrimaryDomain("user-a", "tenant-a", "domain-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.disableDomain("user-a", "tenant-a", "domain-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateDomain({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        domainId: "domain-b",
        hostname: "example.com",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.domain.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
