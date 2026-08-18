import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContentEntryStatus,
  ContentEntryVersionStatus,
  ContentFieldStatus,
  ContentFieldType,
  ContentTypeStatus,
  MediaStatus,
  Prisma,
} from "../../core/database/database.js";
import { optionalString, requiredSlug, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";

interface ActorInput {
  actorUserId: string;
  tenantId: string;
}

const maxListLimit = 50;
const maxVersionListLimit = 30;
const maxEntryDataBytes = 256_000;
const maxConfigurationBytes = 16_000;
const fieldTypes = new Set<string>(Object.values(ContentFieldType));

@Injectable()
export class CmsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async createContentType(input: ActorInput & { websiteId: string; name: unknown; slug: unknown; description?: unknown }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const name = requiredString(input.name, "name");
    const slug = requiredSlug(input.slug);
    const description = optionalString(input.description, "description");

    try {
      return await this.prisma.contentType.create({
        data: {
          tenantId: input.tenantId,
          websiteId: input.websiteId,
          name,
          slug,
          ...(description ? { description } : {}),
        },
        select: contentTypeDetailSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Content type slug already exists for this website");
    }
  }

  async listContentTypes(input: ActorInput & { websiteId: string; limit?: unknown; cursor?: unknown }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const pagination = parsePagination(input.limit, input.cursor, maxListLimit, 20);

    const items = await this.prisma.contentType.findMany({
      where: {
        tenantId: input.tenantId,
        websiteId: input.websiteId,
        status: ContentTypeStatus.ACTIVE,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: pagination.take,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
      select: contentTypeListSelect,
    });

    return pageResult(items, pagination.limit);
  }

  async getContentType(actorUserId: string, tenantId: string, contentTypeId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const contentType = await this.prisma.contentType.findFirst({
      where: {
        id: contentTypeId,
        tenantId,
        status: ContentTypeStatus.ACTIVE,
      },
      select: contentTypeDetailSelect,
    });

    if (!contentType) {
      throw new NotFoundException("Content type was not found in this tenant");
    }

    return contentType;
  }

  async updateContentType(input: ActorInput & { contentTypeId: string; name?: unknown; slug?: unknown; description?: unknown }) {
    const contentType = await this.assertContentTypeAccess(input.actorUserId, input.tenantId, input.contentTypeId);
    const data: Prisma.ContentTypeUpdateInput = {};

    if (input.name !== undefined) {
      data.name = requiredString(input.name, "name");
    }
    if (input.slug !== undefined) {
      data.slug = requiredSlug(input.slug);
    }
    if (input.description !== undefined) {
      data.description = optionalString(input.description, "description") ?? null;
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException("At least one content type field is required");
    }

    try {
      return await this.prisma.contentType.update({
        where: {
          id: contentType.id,
          tenantId: input.tenantId,
        },
        data,
        select: contentTypeDetailSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Content type slug already exists for this website");
    }
  }

  async archiveContentType(actorUserId: string, tenantId: string, contentTypeId: string) {
    const contentType = await this.assertContentTypeAccess(actorUserId, tenantId, contentTypeId);

    return this.prisma.contentType.update({
      where: {
        id: contentType.id,
        tenantId,
      },
      data: {
        status: ContentTypeStatus.ARCHIVED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async addField(input: ActorInput & { contentTypeId: string; name: unknown; slug: unknown; type: unknown; required?: unknown; configuration?: unknown }) {
    await this.assertContentTypeAccess(input.actorUserId, input.tenantId, input.contentTypeId);
    const field = parseFieldDefinition(input);
    const configuration = parseConfiguration(input.configuration, field.type);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const latest = await tx.contentField.findFirst({
          where: {
            contentTypeId: input.contentTypeId,
          },
          orderBy: {
            position: "desc",
          },
          select: {
            position: true,
          },
        });

        return tx.contentField.create({
          data: {
            contentTypeId: input.contentTypeId,
            name: field.name,
            slug: field.slug,
            type: field.type,
            required: field.required,
            position: (latest?.position ?? -1) + 1,
            ...(configuration ? { configuration } : {}),
          },
          select: contentFieldSelect,
        });
      });
    } catch (error) {
      throw mapUniqueError(error, "Field slug or position already exists for this content type");
    }
  }

  async updateField(input: ActorInput & { fieldId: string; name?: unknown; slug?: unknown; type?: unknown; required?: unknown; configuration?: unknown }) {
    const field = await this.assertFieldAccess(input.actorUserId, input.tenantId, input.fieldId);
    const data: Prisma.ContentFieldUpdateInput = {};

    if (input.slug !== undefined) {
      const slug = requiredSlug(input.slug);
      if (slug !== field.slug) {
        const entryCount = await this.prisma.contentEntry.count({
          where: {
            contentTypeId: field.contentTypeId,
            status: {
              not: ContentEntryStatus.ARCHIVED,
            },
          },
        });
        if (entryCount > 0) {
          throw new BadRequestException("Field slug cannot be changed after entries exist");
        }
        data.slug = slug;
      }
    }

    const nextType = input.type === undefined ? field.type : parseFieldType(input.type);
    if (input.type !== undefined && nextType !== field.type) {
      const entryCount = await this.prisma.contentEntry.count({
        where: {
          contentTypeId: field.contentTypeId,
          status: {
            not: ContentEntryStatus.ARCHIVED,
          },
        },
      });
      if (entryCount > 0) {
        throw new BadRequestException("Field type cannot be changed after entries exist");
      }
      data.type = nextType;
    }

    if (input.name !== undefined) {
      data.name = requiredString(input.name, "name");
    }
    if (input.required !== undefined) {
      data.required = parseBoolean(input.required, "required");
    }
    if (input.configuration !== undefined) {
      data.configuration = parseConfiguration(input.configuration, nextType) ?? Prisma.JsonNull;
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException("At least one field property is required");
    }

    try {
      return await this.prisma.contentField.update({
        where: {
          id: field.id,
        },
        data,
        select: contentFieldSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Field slug already exists for this content type");
    }
  }

  async reorderField(input: ActorInput & { fieldId: string; position: unknown }) {
    const field = await this.assertFieldAccess(input.actorUserId, input.tenantId, input.fieldId);
    const position = parseZeroBasedInteger(input.position, "position");

    return this.prisma.$transaction(async (tx) => {
      const fields = await tx.contentField.findMany({
        where: {
          contentTypeId: field.contentTypeId,
          status: ContentFieldStatus.ACTIVE,
        },
        orderBy: {
          position: "asc",
        },
        select: {
          id: true,
        },
      });

      const currentIndex = fields.findIndex((item) => item.id === field.id);
      if (currentIndex === -1) {
        throw new NotFoundException("Field was not found in this content type");
      }

      const [moving] = fields.splice(currentIndex, 1);
      if (!moving) {
        throw new NotFoundException("Field was not found in this content type");
      }
      fields.splice(Math.min(position, fields.length), 0, moving);

      for (let index = 0; index < fields.length; index += 1) {
        await tx.contentField.update({
          where: { id: fields[index]!.id },
          data: { position: -index - 1 },
        });
      }
      for (let index = 0; index < fields.length; index += 1) {
        await tx.contentField.update({
          where: { id: fields[index]!.id },
          data: { position: index },
        });
      }

      return tx.contentField.findMany({
        where: {
          contentTypeId: field.contentTypeId,
          status: ContentFieldStatus.ACTIVE,
        },
        orderBy: {
          position: "asc",
        },
        select: contentFieldSelect,
      });
    });
  }

  async removeField(actorUserId: string, tenantId: string, fieldId: string) {
    const field = await this.assertFieldAccess(actorUserId, tenantId, fieldId);
    return this.prisma.contentField.update({
      where: {
        id: field.id,
      },
      data: {
        status: ContentFieldStatus.ARCHIVED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async createEntry(input: ActorInput & { contentTypeId: string; data: unknown }) {
    const contentType = await this.loadContentTypeWithFields(input.actorUserId, input.tenantId, input.contentTypeId);
    const data = await this.validateEntryData(input.actorUserId, input.tenantId, contentType.websiteId, contentType.fields, input.data);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.contentEntry.create({
        data: {
          tenantId: input.tenantId,
          websiteId: contentType.websiteId,
          contentTypeId: contentType.id,
          status: ContentEntryStatus.DRAFT,
          data,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        },
        select: {
          id: true,
        },
      });

      const version = await tx.contentEntryVersion.create({
        data: {
          entryId: entry.id,
          versionNumber: 1,
          status: ContentEntryVersionStatus.DRAFT,
          data,
          createdBy: input.actorUserId,
        },
        select: {
          id: true,
        },
      });

      return tx.contentEntry.update({
        where: {
          id: entry.id,
          tenantId: input.tenantId,
        },
        data: {
          draftVersionId: version.id,
        },
        select: contentEntryDetailSelect,
      });
    });
  }

  async listEntries(input: ActorInput & { contentTypeId: string; status?: unknown; query?: unknown; limit?: unknown; cursor?: unknown }) {
    await this.assertContentTypeAccess(input.actorUserId, input.tenantId, input.contentTypeId);
    const pagination = parsePagination(input.limit, input.cursor, maxListLimit, 20);
    const status = parseOptionalEntryStatus(input.status);
    const query = optionalString(input.query, "query")?.slice(0, 80);

    const items = await this.prisma.contentEntry.findMany({
      where: {
        tenantId: input.tenantId,
        contentTypeId: input.contentTypeId,
        status: status ?? { not: ContentEntryStatus.ARCHIVED },
        ...(query ? { data: { string_contains: query } } : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: pagination.take,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
      select: contentEntryListSelect,
    });

    return pageResult(items, pagination.limit);
  }

  async getEntry(actorUserId: string, tenantId: string, entryId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const entry = await this.prisma.contentEntry.findFirst({
      where: {
        id: entryId,
        tenantId,
      },
      select: contentEntryDetailSelect,
    });

    if (!entry) {
      throw new NotFoundException("Content entry was not found in this tenant");
    }

    return entry;
  }

  async updateDraftEntry(input: ActorInput & { entryId: string; data: unknown }) {
    const entry = await this.assertEntryAccess(input.actorUserId, input.tenantId, input.entryId);
    if (entry.status === ContentEntryStatus.ARCHIVED) {
      throw new BadRequestException("Archived entries cannot be edited");
    }

    const contentType = await this.loadContentTypeWithFields(input.actorUserId, input.tenantId, entry.contentTypeId);
    const data = await this.validateEntryData(input.actorUserId, input.tenantId, entry.websiteId, contentType.fields, input.data);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.contentEntryVersion.findFirst({
        where: {
          entryId: entry.id,
        },
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          versionNumber: true,
        },
      });

      const version = await tx.contentEntryVersion.create({
        data: {
          entryId: entry.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          status: ContentEntryVersionStatus.DRAFT,
          data,
          createdBy: input.actorUserId,
        },
        select: {
          id: true,
        },
      });

      return tx.contentEntry.update({
        where: {
          id: entry.id,
          tenantId: input.tenantId,
        },
        data: {
          data,
          draftVersionId: version.id,
          status: entry.publishedVersionId ? ContentEntryStatus.PUBLISHED : ContentEntryStatus.DRAFT,
          updatedBy: input.actorUserId,
        },
        select: contentEntryDetailSelect,
      });
    });
  }

  async archiveEntry(actorUserId: string, tenantId: string, entryId: string) {
    const entry = await this.assertEntryAccess(actorUserId, tenantId, entryId);
    return this.prisma.contentEntry.update({
      where: {
        id: entry.id,
        tenantId,
      },
      data: {
        status: ContentEntryStatus.ARCHIVED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async listVersions(input: ActorInput & { entryId: string; limit?: unknown; cursor?: unknown }) {
    const entry = await this.assertEntryAccess(input.actorUserId, input.tenantId, input.entryId);
    const pagination = parsePagination(input.limit, input.cursor, maxVersionListLimit, 20);

    const items = await this.prisma.contentEntryVersion.findMany({
      where: {
        entryId: entry.id,
      },
      orderBy: {
        versionNumber: "desc",
      },
      take: pagination.take,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
      select: contentEntryVersionHistorySelect,
    });

    return pageResult(items, pagination.limit);
  }

  async publishVersion(input: ActorInput & { entryId: string; versionId: string }) {
    const entry = await this.assertEntryAccess(input.actorUserId, input.tenantId, input.entryId);

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.contentEntryVersion.findFirst({
        where: {
          id: input.versionId,
          entryId: entry.id,
        },
        select: {
          id: true,
          data: true,
        },
      });

      if (!version) {
        throw new NotFoundException("Content entry version was not found for this entry");
      }

      await tx.contentEntryVersion.updateMany({
        where: {
          entryId: entry.id,
          status: ContentEntryVersionStatus.PUBLISHED,
          id: {
            not: version.id,
          },
        },
        data: {
          status: ContentEntryVersionStatus.ARCHIVED,
        },
      });

      const published = await tx.contentEntryVersion.update({
        where: {
          id: version.id,
        },
        data: {
          status: ContentEntryVersionStatus.PUBLISHED,
        },
        select: contentEntryVersionSelect,
      });

      await tx.contentEntry.update({
        where: {
          id: entry.id,
          tenantId: input.tenantId,
        },
        data: {
          data: version.data as Prisma.InputJsonValue,
          publishedVersionId: published.id,
          draftVersionId: entry.draftVersionId === published.id ? null : entry.draftVersionId,
          status: ContentEntryStatus.PUBLISHED,
          updatedBy: input.actorUserId,
        },
      });

      return published;
    });
  }

  private async assertContentTypeAccess(actorUserId: string, tenantId: string, contentTypeId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const contentType = await this.prisma.contentType.findFirst({
      where: {
        id: contentTypeId,
        tenantId,
        status: ContentTypeStatus.ACTIVE,
      },
      select: {
        id: true,
        tenantId: true,
        websiteId: true,
      },
    });

    if (!contentType) {
      throw new NotFoundException("Content type was not found in this tenant");
    }

    return contentType;
  }

  private async assertFieldAccess(actorUserId: string, tenantId: string, fieldId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const field = await this.prisma.contentField.findFirst({
      where: {
        id: fieldId,
        status: ContentFieldStatus.ACTIVE,
        contentType: {
          tenantId,
          status: ContentTypeStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        contentTypeId: true,
        slug: true,
        type: true,
      },
    });

    if (!field) {
      throw new NotFoundException("Content field was not found in this tenant");
    }

    return field;
  }

  private async assertEntryAccess(actorUserId: string, tenantId: string, entryId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const entry = await this.prisma.contentEntry.findFirst({
      where: {
        id: entryId,
        tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        websiteId: true,
        contentTypeId: true,
        draftVersionId: true,
        publishedVersionId: true,
        status: true,
      },
    });

    if (!entry) {
      throw new NotFoundException("Content entry was not found in this tenant");
    }

    return entry;
  }

  private async loadContentTypeWithFields(actorUserId: string, tenantId: string, contentTypeId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const contentType = await this.prisma.contentType.findFirst({
      where: {
        id: contentTypeId,
        tenantId,
        status: ContentTypeStatus.ACTIVE,
      },
      select: {
        id: true,
        websiteId: true,
        fields: {
          where: {
            status: ContentFieldStatus.ACTIVE,
          },
          orderBy: {
            position: "asc",
          },
          select: contentFieldSelect,
        },
      },
    });

    if (!contentType) {
      throw new NotFoundException("Content type was not found in this tenant");
    }

    return contentType;
  }

  private async validateEntryData(
    actorUserId: string,
    tenantId: string,
    websiteId: string,
    fields: Array<{ slug: string; name: string; type: ContentFieldType; required: boolean; configuration: Prisma.JsonValue | null }>,
    value: unknown,
  ): Promise<Prisma.InputJsonValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("data must be an object");
    }

    const input = value as Record<string, unknown>;
    const fieldBySlug = new Map(fields.map((field) => [field.slug, field]));
    const output: Record<string, Prisma.InputJsonValue> = {};

    for (const key of Object.keys(input)) {
      if (!fieldBySlug.has(key)) {
        throw new BadRequestException(`Unknown field: ${key}`);
      }
    }

    for (const field of fields) {
      const raw = input[field.slug];
      if (isEmpty(raw)) {
        if (field.required) {
          throw new BadRequestException(`${field.name} is required`);
        }
        continue;
      }

      output[field.slug] = await this.validateFieldValue(actorUserId, tenantId, websiteId, field, raw);
    }

    const serialized = JSON.stringify(output);
    if (serialized.length > maxEntryDataBytes) {
      throw new BadRequestException("Entry data is too large");
    }

    return output;
  }

  private async validateFieldValue(
    actorUserId: string,
    tenantId: string,
    websiteId: string,
    field: { name: string; type: ContentFieldType },
    value: unknown,
  ): Promise<Prisma.InputJsonValue> {
    if (field.type === ContentFieldType.TEXT || field.type === ContentFieldType.RICH_TEXT) {
      if (typeof value !== "string") {
        throw new BadRequestException(`${field.name} must be text`);
      }
      return value;
    }

    if (field.type === ContentFieldType.NUMBER) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new BadRequestException(`${field.name} must be a number`);
      }
      return value;
    }

    if (field.type === ContentFieldType.BOOLEAN) {
      if (typeof value !== "boolean") {
        throw new BadRequestException(`${field.name} must be true or false`);
      }
      return value;
    }

    if (field.type === ContentFieldType.DATE) {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new BadRequestException(`${field.name} must be a valid date`);
      }
      return value;
    }

    if (field.type === ContentFieldType.URL) {
      if (typeof value !== "string") {
        throw new BadRequestException(`${field.name} must be a URL`);
      }
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Invalid URL protocol");
        }
      } catch {
        throw new BadRequestException(`${field.name} must be a valid URL`);
      }
      return value;
    }

    if (field.type === ContentFieldType.IMAGE) {
      if (typeof value !== "string") {
        throw new BadRequestException(`${field.name} must reference a media item`);
      }
      await this.access.assertMediaAccess(actorUserId, tenantId, value);
      const media = await this.prisma.media.findFirst({
        where: {
          id: value,
          tenantId,
          status: MediaStatus.READY,
          mimeType: {
            startsWith: "image/",
          },
          OR: [{ websiteId }, { websiteId: null }],
        },
        select: {
          id: true,
        },
      });
      if (!media) {
        throw new BadRequestException(`${field.name} must reference an image in this tenant`);
      }
      return value;
    }

    throw new BadRequestException(`${field.name} has an unsupported field type`);
  }
}

export const contentFieldSelect = {
  id: true,
  contentTypeId: true,
  name: true,
  slug: true,
  type: true,
  required: true,
  position: true,
  configuration: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContentFieldSelect;

export const contentTypeListSelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      fields: true,
      entries: true,
    },
  },
} satisfies Prisma.ContentTypeSelect;

export const contentTypeDetailSelect = {
  ...contentTypeListSelect,
  fields: {
    where: {
      status: ContentFieldStatus.ACTIVE,
    },
    orderBy: {
      position: "asc",
    },
    select: contentFieldSelect,
  },
} satisfies Prisma.ContentTypeSelect;

export const contentEntryListSelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  contentTypeId: true,
  status: true,
  data: true,
  draftVersionId: true,
  publishedVersionId: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContentEntrySelect;

export const contentEntryDetailSelect = {
  ...contentEntryListSelect,
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
} satisfies Prisma.ContentEntrySelect;

export const contentEntryVersionSelect = {
  id: true,
  entryId: true,
  versionNumber: true,
  status: true,
  data: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.ContentEntryVersionSelect;

export const contentEntryVersionHistorySelect = {
  id: true,
  entryId: true,
  versionNumber: true,
  status: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.ContentEntryVersionSelect;

function parseFieldDefinition(input: { name: unknown; slug: unknown; type: unknown; required?: unknown }) {
  return {
    name: requiredString(input.name, "name"),
    slug: requiredSlug(input.slug),
    type: parseFieldType(input.type),
    required: input.required === undefined ? false : parseBoolean(input.required, "required"),
  };
}

function parseFieldType(value: unknown): ContentFieldType {
  const normalized = requiredString(value, "type").trim().toUpperCase().replace(/-/g, "_");
  if (!fieldTypes.has(normalized)) {
    throw new BadRequestException("type is not a supported CMS field type");
  }
  return normalized as ContentFieldType;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${field} must be a boolean`);
  }
  return value;
}

function parseConfiguration(value: unknown, type: ContentFieldType): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("configuration must be an object");
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > maxConfigurationBytes) {
    throw new BadRequestException("configuration is too large");
  }
  if (type === ContentFieldType.URL || type === ContentFieldType.IMAGE || type === ContentFieldType.BOOLEAN) {
    return value as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

function parseZeroBasedInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${field} must be zero or a positive integer`);
  }
  return value;
}

function parseOptionalEntryStatus(value: unknown): ContentEntryStatus | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const normalized = requiredString(value, "status").toUpperCase();
  if (
    normalized !== ContentEntryStatus.DRAFT &&
    normalized !== ContentEntryStatus.PUBLISHED &&
    normalized !== ContentEntryStatus.ARCHIVED
  ) {
    throw new BadRequestException("status is invalid");
  }
  return normalized;
}

function parsePagination(
  limit: unknown,
  cursor: unknown,
  max: number,
  fallback: number,
): { limit: number; take: number; cursor?: string } {
  const parsedLimit =
    limit === undefined
      ? fallback
      : Number.parseInt(typeof limit === "string" ? limit : String(limit), 10);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > max) {
    throw new BadRequestException(`limit must be between 1 and ${max}`);
  }
  const parsedCursor = cursor === undefined ? undefined : requiredString(cursor, "cursor");
  return {
    limit: parsedLimit,
    take: parsedLimit + 1,
    ...(parsedCursor ? { cursor: parsedCursor } : {}),
  };
}

function pageResult<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return {
    data,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function mapUniqueError(error: unknown, message: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(message);
  }
  return error instanceof Error ? error : new Error("Unexpected database error");
}
