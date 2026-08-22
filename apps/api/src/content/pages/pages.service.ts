import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MembershipRole,
  PageKind,
  PageStatus,
  PageVersionStatus,
  Prisma,
} from "../../core/database/database.js";
import { optionalString, requiredSlug, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";

interface ActorInput {
  actorUserId: string;
  tenantId: string;
}

interface CreatePageInput extends ActorInput {
  websiteId: string;
  title: unknown;
  slug: unknown;
  parentId?: unknown;
  isHomePage?: unknown;
  templateId?: unknown;
  kind?: unknown;
  blogCategoryId?: unknown;
}

interface UpdatePageInput extends ActorInput {
  pageId: string;
  title?: unknown;
  slug?: unknown;
  parentId?: unknown;
  isHomePage?: unknown;
  status?: unknown;
  templateId?: unknown;
  blogCategoryId?: unknown;
  kind?: unknown;
}

interface UpdateSeoInput extends ActorInput {
  pageId: string;
  seo: unknown;
  kind?: unknown;
}

interface CreateVersionInput extends ActorInput {
  pageId: string;
  content: unknown;
}

interface UpdateVersionInput extends ActorInput {
  pageId: string;
  versionId: string;
  content: unknown;
}

interface PublishVersionInput extends ActorInput {
  pageId: string;
  versionId: string;
}

interface ListPagesInput extends ActorInput {
  websiteId: string;
  status?: unknown;
  query?: unknown;
  includeCounts?: unknown;
  kind?: unknown;
  blogCategoryId?: unknown;
}

interface CreateBlogCategoryInput extends ActorInput {
  websiteId: string;
  name: unknown;
  slug?: unknown;
}

interface ListBlogCategoriesInput extends ActorInput {
  websiteId: string;
  status?: unknown;
  query?: unknown;
  includeCounts?: unknown;
}

interface UpdateBlogCategoryInput extends ActorInput {
  categoryId: string;
  name?: unknown;
  slug?: unknown;
  status?: unknown;
  image?: unknown;
  imageAlt?: unknown;
}

interface UpdateBlogCategorySeoInput extends ActorInput {
  categoryId: string;
  seo: unknown;
}

interface BulkBlogCategoryActionInput extends ActorInput {
  categoryIds: unknown;
  action: unknown;
}

interface BulkPageActionInput extends ActorInput {
  pageIds: unknown;
  action: unknown;
  kind?: unknown;
}

interface VersionListInput extends ActorInput {
  pageId: string;
  limit?: unknown;
  cursor?: unknown;
}

const maxTreePages = 500;
const maxVersionHistoryLimit = 50;
const maxVersionContentBytes = 256_000;
const maxSeoFieldLength = 20_000;

const defaultSeoSettings = {
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  canonicalEnabled: false,
  canonicalUrl: "",
  redirectEnabled: false,
  redirectUrl: "",
  redirectType: "301",
  indexing: "index",
  linkFollowing: "follow",
  includeInSitemap: true,
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  twitterTitle: "",
  twitterDescription: "",
  twitterImage: "",
  /** Blog posts only — the featured image shown in blog listings/cards and its accessibility alt text. */
  blogImage: "",
  blogImageAlt: "",
  structuredData: "",
  headCode: "",
  bodyCode: "",
  footerCode: "",
};

@Injectable()
export class PagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async createPage(input: CreatePageInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const title = requiredString(input.title, "title");
    const slug = requiredSlug(input.slug);
    const parentId = optionalString(input.parentId, "parentId");
    const templateId = optionalString(input.templateId, "templateId");
    const isHomePage = parseOptionalBoolean(input.isHomePage, "isHomePage");
    const kind = parseOptionalPageKind(input.kind);
    const blogCategoryId = optionalString(input.blogCategoryId, "blogCategoryId");

    if (parentId) {
      await this.assertParentBelongsToWebsite(input.tenantId, input.websiteId, parentId);
    }
    if (blogCategoryId) {
      await this.assertBlogCategoryBelongsToWebsite(input.tenantId, input.websiteId, blogCategoryId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await tx.page.create({
          data: {
            tenantId: input.tenantId,
            websiteId: input.websiteId,
            ...(parentId ? { parentId } : {}),
            title,
            slug,
            ...(templateId ? { templateId } : {}),
            kind,
            ...(blogCategoryId ? { blogCategoryId } : {}),
            status: PageStatus.DRAFT,
          },
          select: pageSelect,
        });

        if (isHomePage) {
          await tx.website.update({
            where: {
              id: input.websiteId,
              tenantId: input.tenantId,
            },
            data: {
              homePageId: page.id,
            },
          });
        }

        return page;
      });
    } catch (error) {
      throw mapUniqueError(error, "Page slug already exists for this website");
    }
  }

  async listPages(input: ListPagesInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const status = parseOptionalPageStatusFilter(input.status);
    const query = optionalString(input.query, "q")?.trim();
    const kind = parseOptionalPageKind(input.kind);
    const blogCategoryId = optionalString(input.blogCategoryId, "blogCategoryId");
    const baseWhere: Prisma.PageWhereInput = {
      tenantId: input.tenantId,
      websiteId: input.websiteId,
      kind,
      ...(blogCategoryId ? { blogCategoryId } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const data = await this.prisma.page.findMany({
      where: {
        ...baseWhere,
        ...(status
          ? { status }
          : {
              status: {
                not: PageStatus.ARCHIVED,
              },
            }),
      },
      orderBy: [{ parentId: "asc" }, { title: "asc" }],
      select: pageListSelect,
    });

    if (!parseOptionalQueryBoolean(input.includeCounts, "includeCounts")) {
      return data;
    }

    const groupedCounts = await this.prisma.page.groupBy({
      by: ["status"],
      where: {
        tenantId: input.tenantId,
        websiteId: input.websiteId,
        kind,
        ...(blogCategoryId ? { blogCategoryId } : {}),
      },
      _count: {
        _all: true,
      },
    });
    const counts = {
      all: groupedCounts.reduce((total, item) => total + (item.status === PageStatus.ARCHIVED ? 0 : item._count._all), 0),
      DRAFT: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };

    for (const item of groupedCounts) {
      counts[item.status] = item._count._all;
    }

    return {
      data,
      counts,
    };
  }

  async getPage(actorUserId: string, tenantId: string, pageId: string, kind?: PageKind) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        tenantId,
        ...(kind ? { kind } : {}),
      },
      select: pageDetailSelect,
    });

    if (!page) {
      throw new NotFoundException("Page was not found in this tenant");
    }

    return page;
  }

  async updatePage(input: UpdatePageInput) {
    const page = await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId, parseOptionalExpectedPageKind(input.kind));
    const data: Prisma.PageUpdateInput = {};
    const isHomePage = parseOptionalBoolean(input.isHomePage, "isHomePage");

    if (input.title !== undefined) {
      data.title = requiredString(input.title, "title");
    }

    if (input.slug !== undefined) {
      data.slug = requiredSlug(input.slug);
    }

    if (input.parentId !== undefined) {
      const parentId = optionalString(input.parentId, "parentId");
      await this.validateParentChange(input.tenantId, page.websiteId, page.id, parentId);
      data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
    }

    if (input.status !== undefined) {
      data.status = parsePageStatus(input.status);
    }

    if (input.templateId !== undefined) {
      data.templateId = optionalString(input.templateId, "templateId") ?? null;
    }

    if (input.blogCategoryId !== undefined) {
      const blogCategoryId = optionalString(input.blogCategoryId, "blogCategoryId");
      if (blogCategoryId) {
        await this.assertBlogCategoryBelongsToWebsite(input.tenantId, page.websiteId, blogCategoryId);
      }
      data.blogCategory = blogCategoryId ? { connect: { id: blogCategoryId } } : { disconnect: true };
    }

    if (!Object.keys(data).length && isHomePage === undefined) {
      throw new BadRequestException("At least one page field is required");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = Object.keys(data).length
          ? await tx.page.update({
              where: {
                id: page.id,
                tenantId: input.tenantId,
              },
              data,
              select: pageSelect,
            })
          : await tx.page.findUniqueOrThrow({
              where: {
                id: page.id,
              },
              select: pageSelect,
            });

        if (isHomePage === true) {
          await tx.website.update({
            where: {
              id: page.websiteId,
              tenantId: input.tenantId,
            },
            data: {
              homePageId: page.id,
            },
          });
        } else if (isHomePage === false) {
          await tx.website.updateMany({
            where: {
              id: page.websiteId,
              tenantId: input.tenantId,
              homePageId: page.id,
            },
            data: {
              homePageId: null,
            },
          });
        }

        return updated;
      });
    } catch (error) {
      throw mapUniqueError(error, "Page slug already exists for this website");
    }
  }

  async getSeo(actorUserId: string, tenantId: string, pageId: string, kind?: PageKind) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        tenantId,
        ...(kind ? { kind } : {}),
      },
      select: {
        seo: true,
      },
    });

    if (!page) {
      throw new NotFoundException("Page was not found in this tenant");
    }

    return normalizeSeoSettings(page.seo);
  }

  async updateSeo(input: UpdateSeoInput) {
    await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId, parseOptionalExpectedPageKind(input.kind));
    const seo = parseSeoSettings(input.seo);

    const page = await this.prisma.page.update({
      where: {
        id: input.pageId,
        tenantId: input.tenantId,
      },
      data: {
        seo,
      },
      select: {
        seo: true,
      },
    });

    return normalizeSeoSettings(page.seo);
  }

  async archivePage(actorUserId: string, tenantId: string, pageId: string, kind?: PageKind) {
    const page = await this.assertPageAccess(actorUserId, tenantId, pageId, kind);

    return this.prisma.$transaction(async (tx) => {
      await tx.website.updateMany({
        where: {
          id: page.websiteId,
          tenantId,
          homePageId: page.id,
        },
        data: {
          homePageId: null,
        },
      });

      return tx.page.update({
        where: {
          id: page.id,
          tenantId,
        },
        data: {
          status: PageStatus.ARCHIVED,
        },
        select: {
          id: true,
          status: true,
        },
      });
    });
  }

  async clonePage(actorUserId: string, tenantId: string, pageId: string, kind?: PageKind) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const source = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        tenantId,
        ...(kind ? { kind } : {}),
      },
      select: {
        id: true,
        websiteId: true,
        parentId: true,
        title: true,
        slug: true,
        templateId: true,
        kind: true,
        blogCategoryId: true,
        seo: true,
        draftVersion: {
          select: {
            content: true,
          },
        },
        publishedVersion: {
          select: {
            content: true,
          },
        },
      },
    });

    if (!source) {
      throw new NotFoundException("Page was not found in this tenant");
    }

    const slug = await this.getUniquePageSlug(tenantId, source.websiteId, `${source.slug}-copy`);
    const content = source.draftVersion?.content ?? source.publishedVersion?.content ?? null;

    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          tenantId,
          websiteId: source.websiteId,
          ...(source.parentId ? { parentId: source.parentId } : {}),
          title: `${source.title} copy`,
          slug,
          ...(source.templateId ? { templateId: source.templateId } : {}),
          kind: source.kind,
          ...(source.blogCategoryId ? { blogCategoryId: source.blogCategoryId } : {}),
          seo: source.seo as Prisma.InputJsonValue,
          status: PageStatus.DRAFT,
        },
        select: pageSelect,
      });

      if (!content) {
        return page;
      }

      const version = await tx.pageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: 1,
          status: PageVersionStatus.DRAFT,
          content: content as Prisma.InputJsonValue,
          createdBy: actorUserId,
        },
        select: {
          id: true,
        },
      });

      return tx.page.update({
        where: {
          id: page.id,
          tenantId,
        },
        data: {
          draftVersionId: version.id,
        },
        select: pageSelect,
      });
    });
  }

  async bulkPageAction(input: BulkPageActionInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const pageIds = parsePageIds(input.pageIds);
    const action = parseBulkPageAction(input.action);
    const kind = parseOptionalExpectedPageKind(input.kind);

    if (action === "DELETE") {
      return this.deletePages(input.actorUserId, input.tenantId, pageIds, kind);
    }

    const status = action === "PUBLISH" ? PageStatus.PUBLISHED : action === "DRAFT" ? PageStatus.DRAFT : PageStatus.ARCHIVED;
    return this.prisma.$transaction(async (tx) => {
      const pages = await tx.page.findMany({
        where: {
          id: {
            in: pageIds,
          },
          tenantId: input.tenantId,
          ...(kind ? { kind } : {}),
        },
        select: {
          id: true,
        },
      });

      if (pages.length !== pageIds.length) {
        throw new NotFoundException("One or more pages were not found in this tenant");
      }

      if (status === PageStatus.ARCHIVED) {
        await tx.website.updateMany({
          where: {
            tenantId: input.tenantId,
            homePageId: {
              in: pageIds,
            },
          },
          data: {
            homePageId: null,
          },
        });
      }

      const result = await tx.page.updateMany({
        where: {
          id: {
            in: pageIds,
          },
          tenantId: input.tenantId,
          ...(kind ? { kind } : {}),
        },
        data: {
          status,
        },
      });

      return { count: result.count };
    });
  }

  async deletePages(actorUserId: string, tenantId: string, pageIds: string[], kind?: PageKind) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const ids = parsePageIds(pageIds);

    return this.prisma.$transaction(async (tx) => {
      const pages = await tx.page.findMany({
        where: {
          id: {
            in: ids,
          },
          tenantId,
          ...(kind ? { kind } : {}),
        },
        select: {
          id: true,
        },
      });

      if (pages.length !== ids.length) {
        throw new NotFoundException("One or more pages were not found in this tenant");
      }

      await tx.website.updateMany({
        where: {
          tenantId,
          homePageId: {
            in: ids,
          },
        },
        data: {
          homePageId: null,
        },
      });
      await tx.page.updateMany({
        where: {
          tenantId,
          parentId: {
            in: ids,
          },
        },
        data: {
          parentId: null,
        },
      });
      await tx.page.updateMany({
        where: {
          id: {
            in: ids,
          },
          tenantId,
          ...(kind ? { kind } : {}),
        },
        data: {
          draftVersionId: null,
          publishedVersionId: null,
        },
      });
      const result = await tx.page.deleteMany({
        where: {
          id: {
            in: ids,
          },
          tenantId,
          ...(kind ? { kind } : {}),
        },
      });

      return { count: result.count };
    });
  }

  async getPageTree(input: ActorInput & { websiteId: string }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const website = await this.prisma.website.findFirstOrThrow({
      where: {
        id: input.websiteId,
        tenantId: input.tenantId,
      },
      select: {
        homePageId: true,
      },
    });

    const pages = await this.prisma.page.findMany({
      where: {
        tenantId: input.tenantId,
        websiteId: input.websiteId,
        kind: PageKind.PAGE,
        status: {
          not: PageStatus.ARCHIVED,
        },
      },
      orderBy: [{ parentId: "asc" }, { title: "asc" }],
      take: maxTreePages + 1,
      select: pageTreeSelect,
    });

    if (pages.length > maxTreePages) {
      throw new BadRequestException("Page tree is too large to load in one request");
    }

    return buildTree(pages, website.homePageId);
  }

  async listBlogCategories(input: ListBlogCategoriesInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const status = parseOptionalPageStatusFilter(input.status);
    const query = optionalString(input.query, "q")?.trim();
    const baseWhere: Prisma.BlogCategoryWhereInput = {
      tenantId: input.tenantId,
      websiteId: input.websiteId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const data = await this.prisma.blogCategory.findMany({
      where: {
        ...baseWhere,
        ...(status
          ? { status }
          : {
              status: {
                not: PageStatus.ARCHIVED,
              },
            }),
      },
      orderBy: {
        name: "asc",
      },
      select: blogCategorySelect,
    });

    if (!parseOptionalQueryBoolean(input.includeCounts, "includeCounts")) {
      return data;
    }

    const groupedCounts = await this.prisma.blogCategory.groupBy({
      by: ["status"],
      where: {
        tenantId: input.tenantId,
        websiteId: input.websiteId,
      },
      _count: {
        _all: true,
      },
    });
    const counts = {
      all: groupedCounts.reduce((total, item) => total + (item.status === PageStatus.ARCHIVED ? 0 : item._count._all), 0),
      DRAFT: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };

    for (const item of groupedCounts) {
      counts[item.status] = item._count._all;
    }

    return {
      data,
      counts,
    };
  }

  async getBlogCategory(actorUserId: string, tenantId: string, categoryId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const category = await this.prisma.blogCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      select: blogCategorySelect,
    });

    if (!category) {
      throw new NotFoundException("Blog category was not found in this tenant");
    }

    return category;
  }

  async createBlogCategory(input: CreateBlogCategoryInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const name = requiredString(input.name, "name");
    const slug = input.slug === undefined || input.slug === null || input.slug === "" ? slugify(name) : requiredSlug(input.slug);

    try {
      return await this.prisma.blogCategory.create({
        data: {
          tenantId: input.tenantId,
          websiteId: input.websiteId,
          name,
          slug,
        },
        select: blogCategorySelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Blog category slug already exists for this website");
    }
  }

  async updateBlogCategory(input: UpdateBlogCategoryInput) {
    const category = await this.assertBlogCategoryAccessForActor(input.actorUserId, input.tenantId, input.categoryId);
    const data: Prisma.BlogCategoryUpdateInput = {};

    if (input.name !== undefined) {
      data.name = requiredString(input.name, "name");
    }

    if (input.slug !== undefined) {
      data.slug = requiredSlug(input.slug);
    }

    if (input.status !== undefined) {
      data.status = parsePageStatus(input.status);
    }

    if (input.image !== undefined) {
      data.image = optionalString(input.image, "image") ?? null;
    }

    if (input.imageAlt !== undefined) {
      data.imageAlt = optionalString(input.imageAlt, "imageAlt") ?? null;
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException("At least one blog category field is required");
    }

    try {
      return await this.prisma.blogCategory.update({
        where: {
          id: category.id,
          tenantId: input.tenantId,
        },
        data,
        select: blogCategorySelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Blog category slug already exists for this website");
    }
  }

  async getBlogCategorySeo(actorUserId: string, tenantId: string, categoryId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const category = await this.prisma.blogCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      select: {
        seo: true,
      },
    });

    if (!category) {
      throw new NotFoundException("Blog category was not found in this tenant");
    }

    return normalizeSeoSettings(category.seo);
  }

  async updateBlogCategorySeo(input: UpdateBlogCategorySeoInput) {
    const category = await this.assertBlogCategoryAccessForActor(input.actorUserId, input.tenantId, input.categoryId);
    const seo = parseSeoSettings(input.seo);

    const updated = await this.prisma.blogCategory.update({
      where: {
        id: category.id,
        tenantId: input.tenantId,
      },
      data: {
        seo,
      },
      select: {
        seo: true,
      },
    });

    return normalizeSeoSettings(updated.seo);
  }

  async cloneBlogCategory(actorUserId: string, tenantId: string, categoryId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const source = await this.prisma.blogCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      select: {
        websiteId: true,
        name: true,
        slug: true,
        image: true,
        imageAlt: true,
        seo: true,
      },
    });

    if (!source) {
      throw new NotFoundException("Blog category was not found in this tenant");
    }

    const slug = await this.getUniqueBlogCategorySlug(tenantId, source.websiteId, `${source.slug}-copy`);

    return this.prisma.blogCategory.create({
      data: {
        tenantId,
        websiteId: source.websiteId,
        name: `${source.name} copy`,
        slug,
        image: source.image,
        imageAlt: source.imageAlt,
        seo: source.seo as Prisma.InputJsonValue,
        status: PageStatus.DRAFT,
      },
      select: blogCategorySelect,
    });
  }

  async archiveBlogCategory(actorUserId: string, tenantId: string, categoryId: string) {
    const category = await this.assertBlogCategoryAccessForActor(actorUserId, tenantId, categoryId);

    return this.prisma.blogCategory.update({
      where: {
        id: category.id,
        tenantId,
      },
      data: {
        status: PageStatus.ARCHIVED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async bulkBlogCategoryAction(input: BulkBlogCategoryActionInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const categoryIds = parseBlogCategoryIds(input.categoryIds);
    const action = parseBulkPageAction(input.action);

    if (action === "DELETE") {
      return this.deleteBlogCategories(input.actorUserId, input.tenantId, categoryIds);
    }

    const status = action === "PUBLISH" ? PageStatus.PUBLISHED : action === "DRAFT" ? PageStatus.DRAFT : PageStatus.ARCHIVED;
    const categories = await this.prisma.blogCategory.findMany({
      where: {
        id: { in: categoryIds },
        tenantId: input.tenantId,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      throw new NotFoundException("One or more blog categories were not found in this tenant");
    }

    await this.prisma.blogCategory.updateMany({
      where: {
        id: { in: categoryIds },
        tenantId: input.tenantId,
      },
      data: {
        status,
      },
    });

    return { updated: categoryIds.length, status };
  }

  private async deleteBlogCategories(actorUserId: string, tenantId: string, categoryIds: string[]) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const categories = await this.prisma.blogCategory.findMany({
      where: {
        id: { in: categoryIds },
        tenantId,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      throw new NotFoundException("One or more blog categories were not found in this tenant");
    }

    await this.prisma.blogCategory.deleteMany({
      where: {
        id: { in: categoryIds },
        tenantId,
      },
    });

    return { deleted: categoryIds.length };
  }

  private async assertBlogCategoryAccessForActor(actorUserId: string, tenantId: string, categoryId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    return this.assertBlogCategoryAccess(tenantId, categoryId);
  }

  private async assertBlogCategoryAccess(tenantId: string, categoryId: string) {
    const category = await this.prisma.blogCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      select: {
        id: true,
        websiteId: true,
      },
    });

    if (!category) {
      throw new NotFoundException("Blog category was not found in this tenant");
    }

    return category;
  }

  private async getUniqueBlogCategorySlug(tenantId: string, websiteId: string, baseSlug: string) {
    const existingCategories = await this.prisma.blogCategory.findMany({
      where: {
        tenantId,
        websiteId,
        slug: {
          startsWith: baseSlug,
        },
      },
      select: {
        slug: true,
      },
    });
    const existingSlugs = new Set(existingCategories.map((category) => category.slug));

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    for (let suffix = 2; suffix <= 500; suffix += 1) {
      const slug = `${baseSlug}-${suffix}`;
      if (!existingSlugs.has(slug)) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique blog category slug");
  }

  async createVersion(input: CreateVersionInput) {
    const page = await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId);
    const content = parseVersionContent(input.content);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.pageVersion.findFirst({
        where: {
          pageId: page.id,
        },
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          versionNumber: true,
        },
      });

      const version = await tx.pageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          status: PageVersionStatus.DRAFT,
          content,
          createdBy: input.actorUserId,
        },
        select: versionSelect,
      });

      await tx.page.update({
        where: {
          id: page.id,
          tenantId: input.tenantId,
        },
        data: {
          draftVersionId: version.id,
        },
      });

      return version;
    });
  }

  async listVersions(input: VersionListInput) {
    await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId);
    const pagination = parsePagination(input.limit, input.cursor);

    const items = await this.prisma.pageVersion.findMany({
      where: {
        pageId: input.pageId,
      },
      orderBy: {
        versionNumber: "desc",
      },
      take: pagination.take,
      ...(pagination.cursor
        ? {
            cursor: {
              id: pagination.cursor,
            },
            skip: 1,
          }
        : {}),
      select: versionHistorySelect,
    });

    return pageResult(items, pagination.limit);
  }

  async getVersion(actorUserId: string, tenantId: string, pageId: string, versionId: string) {
    await this.assertPageAccess(actorUserId, tenantId, pageId);

    const version = await this.prisma.pageVersion.findFirst({
      where: {
        id: versionId,
        pageId,
      },
      select: versionSelect,
    });

    if (!version) {
      throw new NotFoundException("Page version was not found for this page");
    }

    return version;
  }

  async updateDraftVersion(input: UpdateVersionInput) {
    await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId);
    const content = parseVersionContent(input.content);

    const version = await this.prisma.pageVersion.findFirst({
      where: {
        id: input.versionId,
        pageId: input.pageId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!version) {
      throw new NotFoundException("Page version was not found for this page");
    }

    if (version.status !== PageVersionStatus.DRAFT) {
      throw new BadRequestException("Only draft versions can be edited");
    }

    return this.prisma.pageVersion.update({
      where: {
        id: input.versionId,
      },
      data: {
        content,
      },
      select: versionSelect,
    });
  }

  async getCurrentDraft(actorUserId: string, tenantId: string, pageId: string) {
    const page = await this.getPage(actorUserId, tenantId, pageId);
    return page.draftVersion;
  }

  async getCurrentPublished(actorUserId: string, tenantId: string, pageId: string) {
    const page = await this.getPage(actorUserId, tenantId, pageId);
    return page.publishedVersion;
  }

  async publishVersion(input: PublishVersionInput) {
    const page = await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId);

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.pageVersion.findFirst({
        where: {
          id: input.versionId,
          pageId: page.id,
        },
        select: {
          id: true,
        },
      });

      if (!version) {
        throw new NotFoundException("Page version was not found for this page");
      }

      await tx.pageVersion.updateMany({
        where: {
          pageId: page.id,
          status: PageVersionStatus.PUBLISHED,
          id: {
            not: version.id,
          },
        },
        data: {
          status: PageVersionStatus.ARCHIVED,
        },
      });

      const published = await tx.pageVersion.update({
        where: {
          id: version.id,
        },
        data: {
          status: PageVersionStatus.PUBLISHED,
        },
        select: versionSelect,
      });

      await tx.page.update({
        where: {
          id: page.id,
          tenantId: input.tenantId,
        },
        data: {
          publishedVersionId: published.id,
          draftVersionId: page.draftVersionId === published.id ? null : page.draftVersionId,
          status: PageStatus.PUBLISHED,
        },
      });

      return published;
    });
  }

  async resolvePagePath(actorUserId: string, tenantId: string, websiteId: string, path: unknown) {
    await this.access.assertWebsiteAccess(actorUserId, tenantId, websiteId);
    const slugs = normalizePath(path);

    if (!slugs.length) {
      const website = await this.prisma.website.findFirst({
        where: {
          id: websiteId,
          tenantId,
        },
        select: {
          homePage: {
            select: pageListSelect,
          },
        },
      });

      return website?.homePage ?? null;
    }

    let parentId: string | null = null;
    let page: (typeof pageListSelect extends Prisma.PageSelect ? unknown : never) | null = null;

    for (const slug of slugs) {
      page = await this.prisma.page.findFirst({
        where: {
          tenantId,
          websiteId,
          parentId,
          slug,
          status: {
            not: PageStatus.ARCHIVED,
          },
        },
        select: pageListSelect,
      });

      if (!page || typeof page !== "object" || !("id" in page)) {
        return null;
      }

      parentId = String(page.id);
    }

    return page;
  }

  private async assertPageAccess(actorUserId: string, tenantId: string, pageId: string, kind?: PageKind) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        tenantId,
        ...(kind ? { kind } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        websiteId: true,
        parentId: true,
        blogCategoryId: true,
        draftVersionId: true,
        publishedVersionId: true,
      },
    });

    if (!page) {
      throw new NotFoundException("Page was not found in this tenant");
    }

    return page;
  }

  private async assertParentBelongsToWebsite(tenantId: string, websiteId: string, parentId: string) {
    const parent = await this.prisma.page.findFirst({
      where: {
        id: parentId,
        tenantId,
        websiteId,
        status: {
          not: PageStatus.ARCHIVED,
        },
      },
      select: {
        id: true,
      },
    });

    if (!parent) {
      throw new BadRequestException("Parent page must belong to the same website and tenant");
    }
  }

  private async assertBlogCategoryBelongsToWebsite(tenantId: string, websiteId: string, categoryId: string) {
    const category = await this.prisma.blogCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
        websiteId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new BadRequestException("Blog category must belong to the same website and tenant");
    }
  }

  private async validateParentChange(
    tenantId: string,
    websiteId: string,
    pageId: string,
    parentId: string | undefined,
  ) {
    if (!parentId) {
      return;
    }

    if (parentId === pageId) {
      throw new BadRequestException("Page cannot be its own parent");
    }

    await this.assertParentBelongsToWebsite(tenantId, websiteId, parentId);

    let currentParentId: string | null = parentId;
    const visited = new Set<string>([pageId]);

    for (let depth = 0; currentParentId && depth < maxTreePages; depth += 1) {
      if (visited.has(currentParentId)) {
        throw new BadRequestException("Page hierarchy cannot contain a cycle");
      }

      visited.add(currentParentId);

      const parent: { parentId: string | null } | null = await this.prisma.page.findFirst({
        where: {
          id: currentParentId,
          tenantId,
          websiteId,
        },
        select: {
          parentId: true,
        },
      });

      currentParentId = parent?.parentId ?? null;
    }

    if (currentParentId) {
      throw new BadRequestException("Page hierarchy is too deep");
    }
  }

  private async getUniquePageSlug(tenantId: string, websiteId: string, baseSlug: string) {
    const existingPages = await this.prisma.page.findMany({
      where: {
        tenantId,
        websiteId,
        slug: {
          startsWith: baseSlug,
        },
      },
      select: {
        slug: true,
      },
    });
    const existingSlugs = new Set(existingPages.map((page) => page.slug));

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    for (let suffix = 2; suffix <= 500; suffix += 1) {
      const slug = `${baseSlug}-${suffix}`;
      if (!existingSlugs.has(slug)) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique page slug");
  }
}

export const pageSelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  parentId: true,
  blogCategoryId: true,
  title: true,
  slug: true,
  templateId: true,
  kind: true,
  seo: true,
  status: true,
  draftVersionId: true,
  publishedVersionId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PageSelect;

export const pageListSelect = {
  id: true,
  websiteId: true,
  parentId: true,
  blogCategoryId: true,
  title: true,
  slug: true,
  templateId: true,
  kind: true,
  status: true,
  draftVersionId: true,
  publishedVersionId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PageSelect;

export const blogCategorySelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  name: true,
  slug: true,
  image: true,
  imageAlt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BlogCategorySelect;

export const pageTreeSelect = {
  id: true,
  parentId: true,
  title: true,
  slug: true,
  status: true,
  draftVersionId: true,
  publishedVersionId: true,
} satisfies Prisma.PageSelect;

export const pageDetailSelect = {
  ...pageSelect,
  draftVersion: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      createdAt: true,
    },
  },
  publishedVersion: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PageSelect;

export const versionSelect = {
  id: true,
  pageId: true,
  versionNumber: true,
  status: true,
  content: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.PageVersionSelect;

export const versionHistorySelect = {
  id: true,
  pageId: true,
  versionNumber: true,
  status: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.PageVersionSelect;

export const pageEditorRoles = [MembershipRole.EDITOR];
export const pagePublisherRoles = [MembershipRole.ADMIN];

function parseOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new BadRequestException(`${field} must be a boolean`);
  }

  return value;
}

function parsePageStatus(value: unknown): PageStatus {
  const status = requiredString(value, "status").toUpperCase();

  if (!Object.values(PageStatus).includes(status as PageStatus) || status === PageStatus.ARCHIVED) {
    throw new BadRequestException("status must be draft or published");
  }

  return status as PageStatus;
}

function parseOptionalPageStatusFilter(value: unknown): PageStatus | undefined {
  if (value === undefined || value === null || value === "" || value === "all") {
    return undefined;
  }

  const status = requiredString(value, "status").toUpperCase();
  if (!Object.values(PageStatus).includes(status as PageStatus)) {
    throw new BadRequestException("status must be draft, published, archived, or all");
  }

  return status as PageStatus;
}

function parseOptionalPageKind(value: unknown): PageKind {
  if (value === undefined || value === null || value === "" || value === "page") {
    return PageKind.PAGE;
  }

  const kind = requiredString(value, "kind").toUpperCase();
  if (!Object.values(PageKind).includes(kind as PageKind)) {
    throw new BadRequestException("kind must be page or blog");
  }

  return kind as PageKind;
}

function parseOptionalExpectedPageKind(value: unknown): PageKind | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return parseOptionalPageKind(value);
}

function parsePageIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException("pageIds must be an array");
  }

  const ids = value.map((item) => requiredString(item, "pageId"));
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) {
    throw new BadRequestException("At least one page must be selected");
  }

  return uniqueIds;
}

function parseBlogCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException("categoryIds must be an array");
  }

  const ids = value.map((item) => requiredString(item, "categoryId"));
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) {
    throw new BadRequestException("At least one blog category must be selected");
  }

  return uniqueIds;
}

function parseBulkPageAction(value: unknown): "PUBLISH" | "DRAFT" | "ARCHIVE" | "DELETE" {
  const action = requiredString(value, "action").toUpperCase();

  if (action !== "PUBLISH" && action !== "DRAFT" && action !== "ARCHIVE" && action !== "DELETE") {
    throw new BadRequestException("action must be publish, draft, archive, or delete");
  }

  return action;
}

function parseOptionalQueryBoolean(value: unknown, field: string): boolean {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  throw new BadRequestException(`${field} must be a boolean`);
}

function parseVersionContent(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    throw new BadRequestException("content is required");
  }

  const serialized = JSON.stringify(value);
  if (!serialized) {
    throw new BadRequestException("content must be valid JSON");
  }

  if (serialized.length > maxVersionContentBytes) {
    throw new BadRequestException("content is too large");
  }

  return value as Prisma.InputJsonValue;
}

function normalizeSeoSettings(value: unknown) {
  const source = isRecord(value) ? value : {};

  return {
    ...defaultSeoSettings,
    ...Object.fromEntries(
      Object.keys(defaultSeoSettings).map((key) => [key, source[key] ?? defaultSeoSettings[key as keyof typeof defaultSeoSettings]]),
    ),
  };
}

function parseSeoSettings(value: unknown): Prisma.InputJsonValue {
  const source = normalizeSeoSettings(value);
  const seo = {
    metaTitle: seoString(source.metaTitle, "metaTitle", 120),
    metaDescription: seoString(source.metaDescription, "metaDescription", 320),
    metaKeywords: seoString(source.metaKeywords, "metaKeywords", 500),
    canonicalEnabled: seoBoolean(source.canonicalEnabled, "canonicalEnabled"),
    canonicalUrl: seoString(source.canonicalUrl, "canonicalUrl", 500),
    redirectEnabled: seoBoolean(source.redirectEnabled, "redirectEnabled"),
    redirectUrl: seoString(source.redirectUrl, "redirectUrl", 500),
    redirectType: seoEnum(source.redirectType, "redirectType", ["301", "302"]),
    indexing: seoEnum(source.indexing, "indexing", ["index", "noindex"]),
    linkFollowing: seoEnum(source.linkFollowing, "linkFollowing", ["follow", "nofollow"]),
    includeInSitemap: seoBoolean(source.includeInSitemap, "includeInSitemap"),
    ogTitle: seoString(source.ogTitle, "ogTitle", 120),
    ogDescription: seoString(source.ogDescription, "ogDescription", 320),
    ogImage: seoString(source.ogImage, "ogImage", 1_000),
    twitterTitle: seoString(source.twitterTitle, "twitterTitle", 120),
    twitterDescription: seoString(source.twitterDescription, "twitterDescription", 320),
    twitterImage: seoString(source.twitterImage, "twitterImage", 1_000),
    blogImage: seoString(source.blogImage, "blogImage", 1_000),
    blogImageAlt: seoString(source.blogImageAlt, "blogImageAlt", 200),
    structuredData: seoString(source.structuredData, "structuredData", maxSeoFieldLength),
    headCode: seoString(source.headCode, "headCode", maxSeoFieldLength),
    bodyCode: seoString(source.bodyCode, "bodyCode", maxSeoFieldLength),
    footerCode: seoString(source.footerCode, "footerCode", maxSeoFieldLength),
  };

  if (seo.canonicalEnabled && !seo.canonicalUrl) {
    throw new BadRequestException("canonicalUrl is required when custom canonical is enabled");
  }

  if (seo.redirectEnabled && !seo.redirectUrl) {
    throw new BadRequestException("redirectUrl is required when redirection is enabled");
  }

  if (seo.structuredData.trim()) {
    try {
      JSON.parse(seo.structuredData);
    } catch {
      throw new BadRequestException("structuredData must be valid JSON-LD");
    }
  }

  return seo as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function seoString(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string`);
  }

  if (value.length > maxLength) {
    throw new BadRequestException(`${field} is too long`);
  }

  return value;
}

function seoBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${field} must be a boolean`);
  }

  return value;
}

function seoEnum<T extends string>(value: unknown, field: string, options: T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new BadRequestException(`${field} has an invalid value`);
  }

  return value as T;
}

function parsePagination(
  limit: unknown,
  cursor: unknown,
): { limit: number; take: number; cursor?: string } {
  const parsedLimit =
    limit === undefined
      ? 20
      : Number.parseInt(typeof limit === "string" ? limit : String(limit), 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > maxVersionHistoryLimit) {
    throw new BadRequestException(`limit must be between 1 and ${maxVersionHistoryLimit}`);
  }

  const parsedCursor = cursor === undefined ? undefined : requiredString(cursor, "cursor");

  const result: { limit: number; take: number; cursor?: string } = {
    limit: parsedLimit,
    take: parsedLimit + 1,
  };

  if (parsedCursor !== undefined) {
    result.cursor = parsedCursor;
  }

  return result;
}

function pageResult<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  return {
    data,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
}

function buildTree(
  pages: Array<{
    id: string;
    parentId: string | null;
    title: string;
    slug: string;
    status: PageStatus;
    draftVersionId: string | null;
    publishedVersionId: string | null;
  }>,
  homePageId: string | null,
) {
  const byId = new Map<string, (typeof pages)[number] & { isHomePage: boolean; children: unknown[] }>();
  const roots: Array<(typeof pages)[number] & { isHomePage: boolean; children: unknown[] }> = [];

  for (const page of pages) {
    byId.set(page.id, {
      ...page,
      isHomePage: page.id === homePageId,
      children: [],
    });
  }

  for (const page of byId.values()) {
    const parent = page.parentId ? byId.get(page.parentId) : undefined;
    if (parent) {
      parent.children.push(page);
    } else {
      roots.push(page);
    }
  }

  return roots;
}

function normalizePath(value: unknown): string[] {
  const path = optionalString(value, "path") ?? "/";
  return path
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .map((segment) => requiredSlug(segment, "path segment"));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return requiredSlug(slug, "slug");
}

function mapUniqueError(error: unknown, message: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(message);
  }

  if (error instanceof ForbiddenException || error instanceof BadRequestException) {
    return error;
  }

  return error instanceof Error ? error : new Error("Unexpected database error");
}
