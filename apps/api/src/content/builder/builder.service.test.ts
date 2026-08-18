import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PageStatus, PageVersionStatus } from "../../core/database/database.js";
import {
  createBuilderContent,
  createDefaultBuilderDocument,
  validateBuilderDocument,
} from "./builder-document.js";
import { BuilderService } from "./builder.service.js";

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

function page(overrides?: Partial<{ draftVersionId: string | null; status: PageStatus }>) {
  return {
    id: "page-a",
    tenantId: "tenant-a",
    websiteId: "website-a",
    status: PageStatus.DRAFT,
    draftVersionId: null,
    publishedVersionId: null,
    ...overrides,
  };
}

describe("builder document validation", () => {
  it("accepts the default builder document", () => {
    expect(validateBuilderDocument(createDefaultBuilderDocument()).rootNodeId).toBe("root");
  });

  it("rejects unknown node types", () => {
    const document = createDefaultBuilderDocument() as unknown as {
      nodes: Record<string, { type: string }>;
    };
    document.nodes["heading-1"]!.type = "script";
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });

  it("rejects orphan nodes", () => {
    const document = createDefaultBuilderDocument();
    document.nodes.orphan = { id: "orphan", type: "text", props: { text: "Lost" } };
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });

  it("rejects cyclic structures", () => {
    const document = createDefaultBuilderDocument();
    document.nodes["container-1"]!.children = ["section-1"];
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });

  it("rejects invalid children", () => {
    const document = createDefaultBuilderDocument();
    document.nodes.root!.children = ["heading-1"];
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });

  it("rejects unsafe properties", () => {
    const document = createDefaultBuilderDocument();
    document.nodes["heading-1"]!.props = { text: "<script>alert(1)</script>", level: 1 };
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });

  it("accepts structured responsive styles", () => {
    const document = createDefaultBuilderDocument();
    document.nodes["section-1"]!.styles = {
      base: {
        backgroundColor: "#ffffff",
        padding: { top: "4rem", right: "2rem", bottom: "4rem", left: "2rem" },
      },
      tablet: {
        backgroundColor: "#f8fafc",
      },
      mobile: {
        padding: { top: "2rem" },
      },
    };
    expect(validateBuilderDocument(document).nodes["section-1"]?.styles).toBeDefined();
  });

  it("rejects invalid style units and colors", () => {
    const document = createDefaultBuilderDocument();
    document.nodes["section-1"]!.styles = {
      base: {
        width: "calc(100% - 1rem)",
        backgroundColor: "red",
      },
    };
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });

  it("rejects malicious CSS-like style values", () => {
    const document = createDefaultBuilderDocument();
    document.nodes["section-1"]!.styles = {
      base: {
        width: "url(javascript:alert(1))",
      },
    };
    expect(() => validateBuilderDocument(document)).toThrow(BadRequestException);
  });
});

describe("BuilderService draft persistence", () => {
  it("returns a default draft document when no draft version exists", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page()),
      },
    };
    const service = new BuilderService(prisma as never, createAccess() as never);

    await expect(
      service.getDraft({ actorUserId: "user-a", tenantId: "tenant-a", pageId: "page-a" }),
    ).resolves.toMatchObject({
      pageId: "page-a",
      versionId: null,
      revision: 0,
      document: { rootNodeId: "root" },
    });
  });

  it("creates a draft version on first save", async () => {
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-a", versionNumber: 1 });
    const pageUpdate = vi.fn().mockResolvedValue({});
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
    const service = new BuilderService(prisma as never, createAccess() as never);

    await service.saveDraft({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      pageId: "page-a",
      expectedRevision: 0,
      document: createDefaultBuilderDocument(),
    });

    expect(versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pageId: "page-a",
        versionNumber: 1,
        status: PageVersionStatus.DRAFT,
        createdBy: "user-a",
      }),
      select: {
        id: true,
        versionNumber: true,
      },
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

  it("updates an existing draft when the revision matches", async () => {
    const update = vi.fn().mockResolvedValue({ id: "version-a", versionNumber: 2 });
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page({ draftVersionId: "version-a" })),
      },
      $transaction: vi.fn((callback) =>
        callback({
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue({
              id: "version-a",
              versionNumber: 2,
              status: PageVersionStatus.DRAFT,
              content: createBuilderContent(createDefaultBuilderDocument(), 3),
            }),
            update,
          },
        }),
      ),
    };
    const service = new BuilderService(prisma as never, createAccess() as never);

    await expect(
      service.saveDraft({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        expectedRevision: 3,
        document: createDefaultBuilderDocument(),
      }),
    ).resolves.toMatchObject({ revision: 4 });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: "version-a",
      },
      data: {
        content: expect.objectContaining({ revision: 4 }),
      },
      select: {
        id: true,
        versionNumber: true,
      },
    });
  });

  it("rejects stale revisions", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page({ draftVersionId: "version-a" })),
      },
      $transaction: vi.fn((callback) =>
        callback({
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue({
              id: "version-a",
              status: PageVersionStatus.DRAFT,
              content: createBuilderContent(createDefaultBuilderDocument(), 8),
            }),
          },
        }),
      ),
    };
    const service = new BuilderService(prisma as never, createAccess() as never);

    await expect(
      service.saveDraft({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        expectedRevision: 7,
        document: createDefaultBuilderDocument(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects editing a published version as draft", async () => {
    const prisma = {
      page: {
        findFirst: vi.fn().mockResolvedValue(page({ draftVersionId: "version-a" })),
      },
      $transaction: vi.fn((callback) =>
        callback({
          pageVersion: {
            findFirst: vi.fn().mockResolvedValue({
              id: "version-a",
              status: PageVersionStatus.PUBLISHED,
              content: createBuilderContent(),
            }),
          },
        }),
      ),
    };
    const service = new BuilderService(prisma as never, createAccess() as never);

    await expect(
      service.saveDraft({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        pageId: "page-a",
        expectedRevision: 0,
        document: createDefaultBuilderDocument(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks users without tenant membership", async () => {
    const service = new BuilderService(
      {} as never,
      createAccess({ tenant: new ForbiddenException() }) as never,
    );

    await expect(
      service.getDraft({ actorUserId: "user-b", tenantId: "tenant-a", pageId: "page-a" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
