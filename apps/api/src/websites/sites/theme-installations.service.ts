import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ThemeChangeType, ThemeStatus } from "../../core/database/database.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";
import {
  asFileMap,
  buildFileManifest,
  buildUploadedThemeDefinition,
  changeTypeForFile,
  getThemeDefinition,
  listThemeDefinitions,
  validateThemeManifest,
  validateThemeFileContent,
  validateThemeFilePath,
} from "./theme-platform.js";

interface BaseInput {
  actorUserId: string;
  tenantId: string;
  websiteId: string;
}

interface InstallationInput extends BaseInput {
  installationId: string;
}

@Injectable()
export class ThemeInstallationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async catalog(input: { actorUserId: string; tenantId: string }) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    return listThemeDefinitions();
  }

  async list(input: BaseInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    return this.prisma.themeInstallation.findMany({
      where: { tenantId: input.tenantId, websiteId: input.websiteId },
      orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
      select: installationSelect,
    });
  }

  async create(input: BaseInput & { name?: unknown; themeId?: unknown; sourceInstallationId?: unknown }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const definition = getThemeDefinition(input.themeId);
    const sourceInstallationId = optionalString(input.sourceInstallationId);
    const sourceDraft = sourceInstallationId
      ? await this.prisma.themeDraft.findFirst({
          where: { tenantId: input.tenantId, installationId: sourceInstallationId },
          orderBy: { updatedAt: "desc" },
          select: { files: true, manifest: true, settings: true },
        })
      : null;

    if (sourceInstallationId && !sourceDraft) {
      throw new NotFoundException("Source theme was not found");
    }

    const name = optionalString(input.name) ?? (sourceDraft ? `${definition.name} copy` : definition.name);
    const files = sourceDraft ? asFileMap(sourceDraft.files) : definition.files;
    const manifest = (sourceDraft?.manifest ?? definition.manifest) as Prisma.InputJsonValue;
    const settings = (sourceDraft?.settings ?? definition.settings) as Prisma.InputJsonValue;

    const themePackage = await this.ensureThemePackage(input.tenantId, definition.id);

    return this.prisma.$transaction(async (tx) => {
      const installation = await tx.themeInstallation.create({
        data: {
          tenantId: input.tenantId,
          websiteId: input.websiteId,
          themePackageId: themePackage.id,
          name,
          description: sourceDraft ? "Duplicated from an existing website theme." : definition.description,
          status: ThemeStatus.DRAFT,
          settings,
        },
        select: { id: true },
      });

      const draft = await tx.themeDraft.create({
        data: {
          tenantId: input.tenantId,
          installationId: installation.id,
          revision: 1,
          manifest,
          settings,
          files,
          fileManifest: buildFileManifest(files),
          updatedBy: input.actorUserId,
        },
        select: { id: true },
      });

      await tx.themeInstallation.update({
        where: { id: installation.id },
        data: { currentDraftId: draft.id },
      });

      await tx.themeRevision.create({
        data: {
          tenantId: input.tenantId,
          installationId: installation.id,
          draftId: draft.id,
          actorUserId: input.actorUserId,
          changeType: sourceDraft ? ThemeChangeType.THEME_DUPLICATED : ThemeChangeType.THEME_CREATED,
          message: sourceDraft ? "Theme duplicated" : "Starter theme created",
          changedFilesCount: Object.keys(files).length,
        },
      });

      return tx.themeInstallation.findFirstOrThrow({
        where: { id: installation.id, tenantId: input.tenantId, websiteId: input.websiteId },
        select: installationSelect,
      });
    });
  }

  async upload(input: BaseInput & { name?: unknown; file?: { buffer?: Buffer; originalname?: string } }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const buffer = input.file?.buffer;
    if (!buffer) {
      throw new BadRequestException("Theme ZIP file is required");
    }
    const fallbackName = optionalString(input.name) ?? input.file?.originalname?.replace(/\.zip$/i, "");
    const definition = buildUploadedThemeDefinition(buffer, fallbackName);
    const name = optionalString(input.name) ?? definition.name;
    const files = definition.files;
    const manifest = definition.manifest as Prisma.InputJsonValue;
    const settings = definition.settings as Prisma.InputJsonValue;

    const themePackage = await this.prisma.themePackage.create({
      data: {
        tenantId: input.tenantId,
        source: "UPLOADED",
        name: definition.name,
        description: definition.description,
        author: definition.author,
        category: definition.category,
        tags: definition.tags as Prisma.InputJsonValue,
        manifest,
        latestVersion: definition.version,
        engineVersion: definition.engineVersion,
      },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const installation = await tx.themeInstallation.create({
        data: {
          tenantId: input.tenantId,
          websiteId: input.websiteId,
          themePackageId: themePackage.id,
          name,
          description: definition.description,
          status: ThemeStatus.DRAFT,
          settings,
          metadata: { uploadedFileName: input.file?.originalname ?? null },
        },
        select: { id: true },
      });

      const draft = await tx.themeDraft.create({
        data: {
          tenantId: input.tenantId,
          installationId: installation.id,
          revision: 1,
          manifest,
          settings,
          files,
          fileManifest: buildFileManifest(files),
          updatedBy: input.actorUserId,
        },
        select: { id: true },
      });

      await tx.themeInstallation.update({
        where: { id: installation.id },
        data: { currentDraftId: draft.id },
      });

      await tx.themeRevision.create({
        data: {
          tenantId: input.tenantId,
          installationId: installation.id,
          draftId: draft.id,
          actorUserId: input.actorUserId,
          changeType: ThemeChangeType.THEME_CREATED,
          message: `Theme ZIP uploaded (${Object.keys(files).length} files)`,
          changedFilesCount: Object.keys(files).length,
        },
      });

      return tx.themeInstallation.findFirstOrThrow({
        where: { id: installation.id, tenantId: input.tenantId, websiteId: input.websiteId },
        select: installationSelect,
      });
    });
  }

  async getDraft(input: InstallationInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const installation = await this.ensureInstallation(input);
    if (!installation.currentDraftId) {
      throw new NotFoundException("Theme draft was not found");
    }

    return this.prisma.themeDraft.findFirstOrThrow({
      where: { id: installation.currentDraftId, tenantId: input.tenantId, installationId: input.installationId },
      select: draftSelect,
    });
  }

  async saveSettings(input: InstallationInput & { settings: unknown; expectedRevision?: unknown }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const draft = await this.getDraft(input);
    assertRevision(draft.revision, input.expectedRevision);
    const settings = isRecord(input.settings) ? input.settings : {};

    const updated = await this.prisma.themeDraft.update({
      where: { id: draft.id },
      data: {
        settings: settings as Prisma.InputJsonValue,
        revision: { increment: 1 },
        updatedBy: input.actorUserId,
      },
      select: draftSelect,
    });

    await this.prisma.themeInstallation.update({
      where: { id: input.installationId },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    await this.recordRevision(input, ThemeChangeType.SETTINGS_UPDATED, "Theme settings updated", updated.id, 0);
    return updated;
  }

  async getFile(input: InstallationInput & { path: unknown }) {
    const draft = await this.getDraft(input);
    const path = validateThemeFilePath(input.path);
    const files = asFileMap(draft.files);

    if (!(path in files)) {
      throw new NotFoundException("Theme file was not found");
    }

    return { path, content: files[path], revision: draft.revision };
  }

  async saveFile(input: InstallationInput & { path: unknown; content: unknown; expectedRevision?: unknown }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const draft = await this.getDraft(input);
    assertRevision(draft.revision, input.expectedRevision);
    const path = validateThemeFilePath(input.path);
    const content = validateThemeFileContent(path, input.content);
    const files = asFileMap(draft.files);
    const existed = path in files;
    const nextFiles = { ...files, [path]: content };

    const updated = await this.prisma.themeDraft.update({
      where: { id: draft.id },
      data: {
        files: nextFiles,
        fileManifest: buildFileManifest(nextFiles),
        revision: { increment: 1 },
        updatedBy: input.actorUserId,
      },
      select: draftSelect,
    });

    await this.recordRevision(input, changeTypeForFile(existed), `${existed ? "Updated" : "Created"} ${path}`, updated.id, 1);
    return updated;
  }

  async deleteFile(input: InstallationInput & { path: unknown; expectedRevision?: unknown }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const draft = await this.getDraft(input);
    assertRevision(draft.revision, input.expectedRevision);
    const path = validateThemeFilePath(input.path);
    const files = asFileMap(draft.files);

    if (!(path in files)) {
      throw new NotFoundException("Theme file was not found");
    }

    delete files[path];
    const updated = await this.prisma.themeDraft.update({
      where: { id: draft.id },
      data: {
        files,
        fileManifest: buildFileManifest(files),
        revision: { increment: 1 },
        updatedBy: input.actorUserId,
      },
      select: draftSelect,
    });

    await this.recordRevision(input, ThemeChangeType.FILE_DELETED, `Deleted ${path}`, updated.id, 1);
    return updated;
  }

  async publish(input: InstallationInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const installation = await this.ensureInstallation(input);
    const draft = await this.getDraft(input);
    const files = asFileMap(draft.files);

    if (!Object.keys(files).length) {
      throw new BadRequestException("Theme draft must include files before publishing");
    }
    validateThemeManifest(draft.manifest);
    for (const [path, content] of Object.entries(files)) {
      const safePath = validateThemeFilePath(path);
      validateThemeFileContent(safePath, content);
    }
    assertThemeHasRequiredFiles(files);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.themeVersion.findFirst({
        where: { tenantId: input.tenantId, installationId: input.installationId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const version = await tx.themeVersion.create({
        data: {
          tenantId: input.tenantId,
          installationId: input.installationId,
          versionNumber,
          status: ThemeStatus.PUBLISHED,
          manifest: draft.manifest as Prisma.InputJsonValue,
          settings: draft.settings as Prisma.InputJsonValue,
          fileManifest: draft.fileManifest as Prisma.InputJsonValue,
          files,
          storageKey: `themes/${input.tenantId}/${input.installationId}/versions/${versionNumber}`,
          message: `Published version ${versionNumber}`,
          createdBy: input.actorUserId,
        },
        select: { id: true },
      });

      await tx.themeInstallation.updateMany({
        where: { tenantId: input.tenantId, websiteId: input.websiteId, status: ThemeStatus.PUBLISHED },
        data: { status: ThemeStatus.DRAFT },
      });

      await tx.themeInstallation.update({
        where: { id: input.installationId },
        data: {
          activeVersionId: version.id,
          status: ThemeStatus.PUBLISHED,
          settings: draft.settings as Prisma.InputJsonValue,
        },
      });

      await tx.themePublishRecord.create({
        data: {
          tenantId: input.tenantId,
          installationId: input.installationId,
          versionId: version.id,
          previousVersionId: installation.activeVersionId,
          publishedBy: input.actorUserId,
        },
      });

      await tx.themeRevision.create({
        data: {
          tenantId: input.tenantId,
          installationId: input.installationId,
          draftId: draft.id,
          versionId: version.id,
          actorUserId: input.actorUserId,
          changeType: ThemeChangeType.THEME_PUBLISHED,
          message: `Published version ${versionNumber}`,
          changedFilesCount: Object.keys(files).length,
        },
      });

      return tx.themeInstallation.findFirstOrThrow({
        where: { id: input.installationId, tenantId: input.tenantId, websiteId: input.websiteId },
        select: installationSelect,
      });
    });
  }

  async listVersions(input: InstallationInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    await this.ensureInstallation(input);
    return this.prisma.themeVersion.findMany({
      where: { tenantId: input.tenantId, installationId: input.installationId },
      orderBy: { versionNumber: "desc" },
      select: versionSelect,
    });
  }

  async listHistory(input: InstallationInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    await this.ensureInstallation(input);
    return this.prisma.themeRevision.findMany({
      where: { tenantId: input.tenantId, installationId: input.installationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: revisionSelect,
    });
  }

  async restore(input: InstallationInput & { versionId: string }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    await this.ensureInstallation(input);
    const version = await this.prisma.themeVersion.findFirstOrThrow({
      where: { id: input.versionId, tenantId: input.tenantId, installationId: input.installationId },
      select: {
        id: true,
        manifest: true,
        settings: true,
        fileManifest: true,
        files: true,
        versionNumber: true,
      },
    });
    const restoredFiles = asFileMap(version.files);

    const draft = await this.prisma.themeDraft.create({
      data: {
        tenantId: input.tenantId,
        installationId: input.installationId,
        baseVersionId: version.id,
        revision: 1,
        manifest: version.manifest as Prisma.InputJsonValue,
        settings: version.settings as Prisma.InputJsonValue,
        fileManifest: version.fileManifest as Prisma.InputJsonValue,
        files: restoredFiles,
        updatedBy: input.actorUserId,
      },
      select: draftSelect,
    });

    await this.prisma.themeInstallation.update({
      where: { id: input.installationId },
      data: {
        currentDraftId: draft.id,
        settings: version.settings as Prisma.InputJsonValue,
      },
    });
    await this.recordRevision(input, ThemeChangeType.VERSION_RESTORED, `Restored version ${version.versionNumber}`, draft.id, 0);
    return draft;
  }

  async delete(input: InstallationInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const installation = await this.ensureInstallation(input);

    if (installation.status === ThemeStatus.PUBLISHED) {
      throw new ConflictException("Published theme cannot be deleted. Publish another theme first.");
    }

    await this.prisma.themeInstallation.delete({ where: { id: input.installationId } });
    return { id: input.installationId, deleted: true };
  }

  private async ensureThemePackage(tenantId: string, themeId: string) {
    const definition = getThemeDefinition(themeId);
    const existing = await this.prisma.themePackage.findFirst({
      where: { tenantId, source: "BUILT_IN", name: definition.name },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.themePackage.create({
      data: {
        tenantId,
        source: "BUILT_IN",
        name: definition.name,
        description: definition.description,
        author: definition.author,
        category: definition.category,
        tags: definition.tags as Prisma.InputJsonValue,
        manifest: definition.manifest as Prisma.InputJsonValue,
        latestVersion: definition.version,
        engineVersion: definition.engineVersion,
      },
      select: { id: true },
    });
  }

  private async ensureInstallation(input: InstallationInput) {
    return this.prisma.themeInstallation.findFirstOrThrow({
      where: { id: input.installationId, tenantId: input.tenantId, websiteId: input.websiteId },
      select: { id: true, activeVersionId: true, currentDraftId: true, status: true },
    });
  }

  private async recordRevision(
    input: InstallationInput,
    changeType: ThemeChangeType,
    message: string,
    draftId: string,
    changedFilesCount: number,
  ) {
    await this.prisma.themeRevision.create({
      data: {
        tenantId: input.tenantId,
        installationId: input.installationId,
        draftId,
        actorUserId: input.actorUserId,
        changeType,
        message,
        changedFilesCount,
      },
    });
  }
}

const installationSelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  themePackageId: true,
  activeVersionId: true,
  currentDraftId: true,
  name: true,
  description: true,
  status: true,
  settings: true,
  metadata: true,
  thumbnailKey: true,
  createdAt: true,
  updatedAt: true,
  themePackage: {
    select: {
      name: true,
      source: true,
      category: true,
      engineVersion: true,
    },
  },
  activeVersion: {
    select: {
      id: true,
      versionNumber: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      drafts: true,
      versions: true,
      revisions: true,
    },
  },
} satisfies Prisma.ThemeInstallationSelect;

const draftSelect = {
  id: true,
  tenantId: true,
  installationId: true,
  baseVersionId: true,
  revision: true,
  manifest: true,
  settings: true,
  fileManifest: true,
  files: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ThemeDraftSelect;

const versionSelect = {
  id: true,
  tenantId: true,
  installationId: true,
  versionNumber: true,
  status: true,
  manifest: true,
  settings: true,
  fileManifest: true,
  storageKey: true,
  checksum: true,
  message: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.ThemeVersionSelect;

const revisionSelect = {
  id: true,
  tenantId: true,
  installationId: true,
  draftId: true,
  versionId: true,
  actorUserId: true,
  changeType: true,
  message: true,
  changedFilesCount: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.ThemeRevisionSelect;

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function assertRevision(currentRevision: number, expectedRevision: unknown) {
  if (expectedRevision === undefined || expectedRevision === null) {
    return;
  }
  const parsed = Number(expectedRevision);
  if (!Number.isInteger(parsed) || parsed !== currentRevision) {
    throw new ConflictException("Theme draft has changed. Reload and try again.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertThemeHasRequiredFiles(files: Record<string, string>) {
  const paths = Object.keys(files);
  const requiredExact = ["theme.config.ts"];
  const requiredDirectories = ["config/", "layout/", "templates/", "sections/", "components/", "assets/", "locales/"];

  for (const path of requiredExact) {
    if (!paths.includes(path)) {
      throw new BadRequestException(`Theme is missing ${path}`);
    }
  }

  for (const directory of requiredDirectories) {
    if (!paths.some((path) => path.startsWith(directory))) {
      throw new BadRequestException(`Theme is missing ${directory}`);
    }
  }
}
