import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PageStatus, PageVersionStatus } from "../../core/database/database.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";
import {
  createBuilderContent,
  createDefaultBuilderDocument,
  parseBuilderContent,
  toBuilderJson,
  validateBuilderDocument,
} from "./builder-document.js";

interface ActorInput {
  actorUserId: string;
  tenantId: string;
}

@Injectable()
export class BuilderService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async getDraft(input: ActorInput & { pageId: string }) {
    const page = await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId);

    if (!page.draftVersionId) {
      return {
        pageId: page.id,
        versionId: null,
        versionNumber: null,
        revision: 0,
        document: createDefaultBuilderDocument(),
      };
    }

    const version = await this.prisma.pageVersion.findFirst({
      where: {
        id: page.draftVersionId,
        pageId: page.id,
      },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        content: true,
      },
    });

    if (!version) {
      throw new NotFoundException("Draft page version was not found");
    }
    if (version.status !== PageVersionStatus.DRAFT) {
      throw new BadRequestException("Builder can only edit draft page versions");
    }

    const builderContent = parseBuilderContent(version.content) ?? createBuilderContent();
    return {
      pageId: page.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
      revision: builderContent.revision,
      document: builderContent.document,
    };
  }

  async saveDraft(input: ActorInput & { pageId: string; document: unknown; expectedRevision: unknown }) {
    const page = await this.assertPageAccess(input.actorUserId, input.tenantId, input.pageId);
    if (page.status === PageStatus.ARCHIVED) {
      throw new BadRequestException("Archived pages cannot be edited in the builder");
    }

    const document = validateBuilderDocument(input.document);
    const expectedRevision = parseRevision(input.expectedRevision);

    return this.prisma.$transaction(async (tx) => {
      if (page.draftVersionId) {
        const draft = await tx.pageVersion.findFirst({
          where: {
            id: page.draftVersionId,
            pageId: page.id,
          },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            content: true,
          },
        });

        if (!draft) {
          throw new NotFoundException("Draft page version was not found");
        }
        if (draft.status !== PageVersionStatus.DRAFT) {
          throw new BadRequestException("Published page versions cannot be edited by the builder");
        }

        const current = parseBuilderContent(draft.content);
        const currentRevision = current?.revision ?? 0;
        if (expectedRevision !== currentRevision) {
          throw new ConflictException("Builder draft has changed. Reload before saving.");
        }

        const nextRevision = currentRevision + 1;
        const version = await tx.pageVersion.update({
          where: {
            id: draft.id,
          },
          data: {
            content: toBuilderJson(document, nextRevision),
          },
          select: {
            id: true,
            versionNumber: true,
          },
        });

        return {
          pageId: page.id,
          versionId: version.id,
          versionNumber: version.versionNumber,
          revision: nextRevision,
          document,
        };
      }

      if (expectedRevision !== 0) {
        throw new ConflictException("Builder draft has changed. Reload before saving.");
      }

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
      const nextRevision = 1;
      const version = await tx.pageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          status: PageVersionStatus.DRAFT,
          content: toBuilderJson(document, nextRevision),
          createdBy: input.actorUserId,
        },
        select: {
          id: true,
          versionNumber: true,
        },
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

      return {
        pageId: page.id,
        versionId: version.id,
        versionNumber: version.versionNumber,
        revision: nextRevision,
        document,
      };
    });
  }

  private async assertPageAccess(actorUserId: string, tenantId: string, pageId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        websiteId: true,
        status: true,
        draftVersionId: true,
        publishedVersionId: true,
      },
    });

    if (!page) {
      throw new NotFoundException("Page was not found in this tenant");
    }

    await this.access.assertWebsiteAccess(actorUserId, tenantId, page.websiteId);
    return page;
  }
}

function parseRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException("expectedRevision must be zero or a positive integer");
  }
  return value;
}
