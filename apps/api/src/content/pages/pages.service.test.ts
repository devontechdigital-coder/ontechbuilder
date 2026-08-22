import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PageKind, PageStatus, PageVersionStatus } from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { PagesService } from "./pages.service.js";

function createAccess(overrides?: Partial<Record<"tenant" | "website", Error | null>>) {
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
  };
}

function page(overrides?: Partial<{ id: string; tenantId: string; websiteId: string; parentId: string | null; draftVersionId: string | null; publishedVersionId: string | null }>) {
  return {
    id: "page-a",
    tenantId: "tenant-a",
    websiteId: "website-a",
    parentId: null,
    draftVersionId: null,
    publishedVersionId: null,
    ...overrides,
  };
}

describe("PagesService tenant and hierarchy boundaries", () => {
  it("creates a draft page scoped to the active tenant and website", async () => {
    const create = vi.fn().mockResolvedValue({ id: "page-a", status: PageStatus.DRAFT });
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          page: { create },
        }),
      ),
    };
    const access = createAccess();
    const service = new PagesService(prisma as never, access as never);

    await expect(
      service.createPage({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        websiteId: "website-a",
        title: "About",
        slug: "about",
      }),
    ).resolves.toEqual({ id: "page-a", status: PageStatus.DRAFT });

    expect(access.assertWebsiteAccess).toHaveBeenCalledWith("user-a", "tenant-a", "website-a");
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        websiteId: "website-a",
        title: "About",
        slug: "about",
        kind: PageKind.PAGE,
        status: PageStatus.DRAFT,
      },
      select: expect.any(Object),
    });
  });

  it("creates blog posts with the blog kind", async () => {
    const create = vi.fn().mockResolvedValue({ id: "blog-a", kind: PageKind.BLOG, status: PageStatus.DRAFT });
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          page: { create },
        }),
      ),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await service.createPage({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      websiteId: "website-a",
      title: "Launch notes",
      slug: "launch-notes",
      kind: "blog",
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: PageKind.BLOG,
        title: "Launch notes",
        slug: "launch-notes",
      }),
      select: expect.any(Object),
    });
  });

  it("rejects a parent page from another tenant or website", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.createPage({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        websiteId: "website-a",
        title: "Child",
        slug: "child",
        parentId: "page-b",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.page.findFirst).toHaveBeenCalledWith({
      where: {
        id: "page-b",
        tenantId: "tenant-a",
        websiteId: "website-a",
        status: {
          not: PageStatus.ARCHIVED,
        },
      },
      select: {
        id: true,
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a page being its own parent", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.updatePage({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        parentId: "page-a",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects circular parent relationships", async () => {
    const prisma = {
      page: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(page())
          .mockResolvedValueOnce({ id: "page-b" })
          .mockResolvedValueOnce({ parentId: "page-a" }),
      },
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.updatePage({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        parentId: "page-b",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks reads and writes for pages outside the active tenant", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(service.getPage("user-a", "tenant-a", "page-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.archivePage("user-a", "tenant-a", "page-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.createVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-b",
        content: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.page.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks users without tenant membership", async () => {
    const service = new PagesService({} as never, createAccess({ tenant: new ForbiddenException() }) as never);

    await expect(service.getPage("user-b", "tenant-a", "page-a")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe("PagesService versioning and publishing", () => {
  it("creates the first draft version and stores it as the current draft", async () => {
    const pageUpdate = vi.fn().mockResolvedValue({});
    const versionCreate = vi.fn().mockResolvedValue({
      id: "version-a",
      versionNumber: 1,
      status: PageVersionStatus.DRAFT,
    });
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
      $transaction: vi.fn((callback) =>
        callback({
          page: { update: pageUpdate },
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: versionCreate,
          },
        }),
      ),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.createVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        content: { document: { blocks: [] } },
      }),
    ).resolves.toEqual({
      id: "version-a",
      versionNumber: 1,
      status: PageVersionStatus.DRAFT,
    });

    expect(versionCreate).toHaveBeenCalledWith({
      data: {
        pageId: "page-a",
        versionNumber: 1,
        status: PageVersionStatus.DRAFT,
        content: { document: { blocks: [] } },
        createdBy: "user-a",
      },
      select: expect.any(Object),
    });
    expect(pageUpdate).toHaveBeenCalledWith({
      where: {
        id: "page-a",
        tenantId: "tenant-a",
      },
      data: {
        draftVersionId: "version-a",
      },
    });
  });

  it("increments version numbers from the current latest version", async () => {
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-b", versionNumber: 4 });
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
      $transaction: vi.fn((callback) =>
        callback({
          page: { update: vi.fn() },
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue({ versionNumber: 3 }),
            create: versionCreate,
          },
        }),
      ),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await service.createVersion({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      pageId: "page-a",
      content: { text: "draft" },
    });

    expect(versionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 4,
        }),
      }),
    );
  });

  it("updates draft content without changing published content", async () => {
    const update = vi.fn().mockResolvedValue({ id: "version-b", content: { text: "new" } });
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page({ publishedVersionId: "version-a" })),
      },
      pageVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: "version-b", status: PageVersionStatus.DRAFT }),
        update,
      },
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await service.updateDraftVersion({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      pageId: "page-a",
      versionId: "version-b",
      content: { text: "new" },
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: "version-b",
      },
      data: {
        content: { text: "new" },
      },
      select: expect.any(Object),
    });
  });

  it("rejects editing a published version", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
      pageVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "version-a",
          status: PageVersionStatus.PUBLISHED,
        }),
        update: vi.fn(),
      },
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.updateDraftVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        versionId: "version-a",
        content: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.pageVersion.update).not.toHaveBeenCalled();
  });

  it("lists version history newest first with bounded pagination", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
      pageVersion: {
        findMany: vi.fn().mockResolvedValue([{ id: "v3" }, { id: "v2" }, { id: "v1" }]),
      },
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.listVersions({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        limit: "2",
        cursor: "v4",
      }),
    ).resolves.toEqual({ data: [{ id: "v3" }, { id: "v2" }], nextCursor: "v2" });

    expect(prisma.pageVersion.findMany).toHaveBeenCalledWith({
      where: {
        pageId: "page-a",
      },
      orderBy: {
        versionNumber: "desc",
      },
      take: 3,
      cursor: {
        id: "v4",
      },
      skip: 1,
      select: expect.any(Object),
    });
  });

  it("rejects cross-page version access", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
      pageVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.getVersion("user-a", "tenant-a", "page-a", "version-from-page-b"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("publishes a version transactionally and archives the previous published version", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const versionUpdate = vi.fn().mockResolvedValue({
      id: "version-b",
      status: PageVersionStatus.PUBLISHED,
    });
    const pageUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(
          page({
            draftVersionId: "version-b",
            publishedVersionId: "version-a",
          }),
        ),
      },
      $transaction: vi.fn((callback) =>
        callback({
          page: { update: pageUpdate },
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue({ id: "version-b" }),
            updateMany,
            update: versionUpdate,
          },
        }),
      ),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.publishVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        versionId: "version-b",
      }),
    ).resolves.toEqual({ id: "version-b", status: PageVersionStatus.PUBLISHED });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        pageId: "page-a",
        status: PageVersionStatus.PUBLISHED,
        id: {
          not: "version-b",
        },
      },
      data: {
        status: PageVersionStatus.ARCHIVED,
      },
    });
    expect(pageUpdate).toHaveBeenCalledWith({
      where: {
        id: "page-a",
        tenantId: "tenant-a",
      },
      data: {
        publishedVersionId: "version-b",
        draftVersionId: null,
        status: PageStatus.PUBLISHED,
      },
    });
  });

  it("rejects publishing a version from another page", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
      $transaction: vi.fn((callback) =>
        callback({
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        }),
      ),
    };
    const service = new PagesService(prisma as never, createAccess() as never);

    await expect(
      service.publishVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        versionId: "version-b",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
