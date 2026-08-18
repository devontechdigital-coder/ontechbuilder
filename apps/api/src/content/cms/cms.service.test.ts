import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  ContentEntryStatus,
  ContentEntryVersionStatus,
  ContentFieldStatus,
  ContentFieldType,
  ContentTypeStatus,
  MediaStatus,
} from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { CmsService } from "./cms.service.js";

function createAccess(overrides?: Partial<Record<"tenant" | "website" | "media", Error | null>>) {
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
    assertMediaAccess: vi.fn().mockImplementation(() => {
      if (overrides?.media) {
        throw overrides.media;
      }
    }),
  };
}

function contentType(fields = defaultFields()) {
  return {
    id: "type-a",
    websiteId: "website-a",
    fields,
  };
}

function entry(overrides?: Partial<{ id: string; websiteId: string; contentTypeId: string; draftVersionId: string | null; publishedVersionId: string | null; status: ContentEntryStatus }>) {
  return {
    id: "entry-a",
    tenantId: "tenant-a",
    websiteId: "website-a",
    contentTypeId: "type-a",
    draftVersionId: "version-a",
    publishedVersionId: null,
    status: ContentEntryStatus.DRAFT,
    ...overrides,
  };
}

function defaultFields() {
  return [
    {
      id: "field-title",
      contentTypeId: "type-a",
      name: "Title",
      slug: "title",
      type: ContentFieldType.TEXT,
      required: true,
      position: 0,
      configuration: null,
      status: ContentFieldStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "field-hero",
      contentTypeId: "type-a",
      name: "Hero Image",
      slug: "heroImage",
      type: ContentFieldType.IMAGE,
      required: false,
      position: 1,
      configuration: null,
      status: ContentFieldStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

describe("CmsService tenant and ownership boundaries", () => {
  it("creates content types only after website access is verified", async () => {
    const create = vi.fn().mockResolvedValue({ id: "type-a", slug: "blog" });
    const prisma = {
      contentType: { create },
    };
    const access = createAccess();
    const service = new CmsService(prisma as never, access as never);

    await expect(
      service.createContentType({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        websiteId: "website-a",
        name: "Blog Post",
        slug: "blog-post",
      }),
    ).resolves.toEqual({ id: "type-a", slug: "blog" });

    expect(access.assertWebsiteAccess).toHaveBeenCalledWith("user-a", "tenant-a", "website-a");
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        websiteId: "website-a",
        name: "Blog Post",
        slug: "blog-post",
      },
      select: expect.any(Object),
    });
  });

  it("blocks users without tenant membership from CMS reads", async () => {
    const service = new CmsService({} as never, createAccess({ tenant: new ForbiddenException() }) as never);
    await expect(service.getContentType("user-b", "tenant-a", "type-a")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejects content types from another tenant", async () => {
    const prisma = {
      contentType: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(service.getContentType("user-a", "tenant-a", "type-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.contentType.findFirst).toHaveBeenCalledWith({
      where: {
        id: "type-b",
        tenantId: "tenant-a",
        status: ContentTypeStatus.ACTIVE,
      },
      select: expect.any(Object),
    });
  });

  it("rejects entries from another tenant", async () => {
    const prisma = {
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(service.getEntry("user-a", "tenant-a", "entry-b")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("CmsService schema validation", () => {
  it("rejects missing required fields", async () => {
    const prisma = {
      contentType: {
        findFirst: vi.fn().mockResolvedValue(contentType()),
      },
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(
      service.createEntry({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        contentTypeId: "type-a",
        data: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unknown fields", async () => {
    const prisma = {
      contentType: {
        findFirst: vi.fn().mockResolvedValue(contentType()),
      },
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(
      service.createEntry({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        contentTypeId: "type-a",
        data: { title: "Hello", extra: "nope" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid field types", async () => {
    const prisma = {
      contentType: {
        findFirst: vi.fn().mockResolvedValue(contentType()),
      },
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(
      service.createEntry({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        contentTypeId: "type-a",
        data: { title: 123 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates image fields through tenant-safe media access", async () => {
    const createEntry = vi.fn().mockResolvedValue({ id: "entry-a" });
    const createVersion = vi.fn().mockResolvedValue({ id: "version-a" });
    const updateEntry = vi.fn().mockResolvedValue({ id: "entry-a", draftVersionId: "version-a" });
    const prisma = {
      contentType: {
        findFirst: vi.fn().mockResolvedValue(contentType()),
      },
      media: {
        findFirst: vi.fn().mockResolvedValue({ id: "media-a" }),
      },
      $transaction: vi.fn((callback) =>
        callback({
          contentEntry: {
            create: createEntry,
            update: updateEntry,
          },
          contentEntryVersion: {
            create: createVersion,
          },
        }),
      ),
    };
    const access = createAccess();
    const service = new CmsService(prisma as never, access as never);

    await service.createEntry({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      contentTypeId: "type-a",
      data: { title: "Hello", heroImage: "media-a" },
    });

    expect(access.assertMediaAccess).toHaveBeenCalledWith("user-a", "tenant-a", "media-a");
    expect(prisma.media.findFirst).toHaveBeenCalledWith({
      where: {
        id: "media-a",
        tenantId: "tenant-a",
        status: MediaStatus.READY,
        mimeType: {
          startsWith: "image/",
        },
        OR: [{ websiteId: "website-a" }, { websiteId: null }],
      },
      select: {
        id: true,
      },
    });
  });

  it("keeps field slugs stable after entries exist", async () => {
    const prisma = {
      contentField: {
        findFirst: vi.fn().mockResolvedValue({
          id: "field-title",
          contentTypeId: "type-a",
          slug: "title",
          type: ContentFieldType.TEXT,
        }),
      },
      contentEntry: {
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(
      service.updateField({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        fieldId: "field-title",
        slug: "headline",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("CmsService versioning", () => {
  it("creates the first draft version with an entry", async () => {
    const entryCreate = vi.fn().mockResolvedValue({ id: "entry-a" });
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-a" });
    const entryUpdate = vi.fn().mockResolvedValue({ id: "entry-a", draftVersionId: "version-a" });
    const prisma = {
      contentType: {
        findFirst: vi.fn().mockResolvedValue(contentType(defaultFields().slice(0, 1))),
      },
      $transaction: vi.fn((callback) =>
        callback({
          contentEntry: {
            create: entryCreate,
            update: entryUpdate,
          },
          contentEntryVersion: {
            create: versionCreate,
          },
        }),
      ),
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await service.createEntry({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      contentTypeId: "type-a",
      data: { title: "Hello" },
    });

    expect(versionCreate).toHaveBeenCalledWith({
      data: {
        entryId: "entry-a",
        versionNumber: 1,
        status: ContentEntryVersionStatus.DRAFT,
        data: { title: "Hello" },
        createdBy: "user-a",
      },
      select: {
        id: true,
      },
    });
  });

  it("increments version numbers when updating the draft", async () => {
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-b" });
    const prisma = {
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue(entry()),
      },
      contentType: {
        findFirst: vi.fn().mockResolvedValue(contentType(defaultFields().slice(0, 1))),
      },
      $transaction: vi.fn((callback) =>
        callback({
          contentEntry: {
            update: vi.fn().mockResolvedValue({ id: "entry-a" }),
          },
          contentEntryVersion: {
            findFirst: vi.fn().mockResolvedValue({ versionNumber: 2 }),
            create: versionCreate,
          },
        }),
      ),
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await service.updateDraftEntry({
      actorUserId: "user-a",
      tenantId: "tenant-a",
      entryId: "entry-a",
      data: { title: "Updated" },
    });

    expect(versionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 3,
          status: ContentEntryVersionStatus.DRAFT,
        }),
      }),
    );
  });

  it("publishes a version transactionally and archives the previous published version", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const versionUpdate = vi.fn().mockResolvedValue({
      id: "version-b",
      status: ContentEntryVersionStatus.PUBLISHED,
    });
    const entryUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue(
          entry({
            draftVersionId: "version-b",
            publishedVersionId: "version-a",
          }),
        ),
      },
      $transaction: vi.fn((callback) =>
        callback({
          contentEntry: {
            update: entryUpdate,
          },
          contentEntryVersion: {
            findFirst: vi.fn().mockResolvedValue({ id: "version-b", data: { title: "Published" } }),
            updateMany,
            update: versionUpdate,
          },
        }),
      ),
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(
      service.publishVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        entryId: "entry-a",
        versionId: "version-b",
      }),
    ).resolves.toEqual({ id: "version-b", status: ContentEntryVersionStatus.PUBLISHED });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        entryId: "entry-a",
        status: ContentEntryVersionStatus.PUBLISHED,
        id: {
          not: "version-b",
        },
      },
      data: {
        status: ContentEntryVersionStatus.ARCHIVED,
      },
    });
    expect(entryUpdate).toHaveBeenCalledWith({
      where: {
        id: "entry-a",
        tenantId: "tenant-a",
      },
      data: {
        data: { title: "Published" },
        publishedVersionId: "version-b",
        draftVersionId: null,
        status: ContentEntryStatus.PUBLISHED,
        updatedBy: "user-a",
      },
    });
  });

  it("rejects cross-entry version publishing", async () => {
    const prisma = {
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue(entry()),
      },
      $transaction: vi.fn((callback) =>
        callback({
          contentEntryVersion: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        }),
      ),
    };
    const service = new CmsService(prisma as never, createAccess() as never);

    await expect(
      service.publishVersion({
        actorUserId: "user-a",
        tenantId: "tenant-a",
        entryId: "entry-a",
        versionId: "version-from-entry-b",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
