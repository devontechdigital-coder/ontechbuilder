CREATE TYPE "ThemeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ThemeChangeType" AS ENUM (
  'SETTINGS_UPDATED',
  'FILE_UPDATED',
  'FILE_CREATED',
  'FILE_DELETED',
  'THEME_CREATED',
  'THEME_DUPLICATED',
  'VERSION_CREATED',
  'VERSION_RESTORED',
  'THEME_PUBLISHED',
  'THEME_RENAMED',
  'THEME_DELETED'
);

CREATE TABLE "ThemePackage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID,
  "source" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "author" TEXT,
  "category" TEXT,
  "tags" JSONB NOT NULL DEFAULT '[]',
  "thumbnailKey" TEXT,
  "manifest" JSONB NOT NULL,
  "latestVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThemePackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeInstallation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "themePackageId" UUID NOT NULL,
  "activeVersionId" UUID,
  "currentDraftId" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ThemeStatus" NOT NULL DEFAULT 'DRAFT',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "thumbnailKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThemeInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "ThemeStatus" NOT NULL DEFAULT 'DRAFT',
  "manifest" JSONB NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "fileManifest" JSONB NOT NULL DEFAULT '{}',
  "storageKey" TEXT,
  "checksum" TEXT,
  "message" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThemeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeDraft" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "baseVersionId" UUID,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "manifest" JSONB NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "fileManifest" JSONB NOT NULL DEFAULT '{}',
  "files" JSONB NOT NULL DEFAULT '{}',
  "storagePrefix" TEXT,
  "updatedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThemeDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "draftId" UUID,
  "versionId" UUID,
  "actorUserId" UUID NOT NULL,
  "changeType" "ThemeChangeType" NOT NULL,
  "message" TEXT,
  "changedFilesCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThemeRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemePublishRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "previousVersionId" UUID,
  "publishedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThemePublishRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ThemePackage_tenantId_idx" ON "ThemePackage"("tenantId");
CREATE INDEX "ThemePackage_source_idx" ON "ThemePackage"("source");
CREATE INDEX "ThemeInstallation_tenantId_websiteId_idx" ON "ThemeInstallation"("tenantId", "websiteId");
CREATE INDEX "ThemeInstallation_themePackageId_idx" ON "ThemeInstallation"("themePackageId");
CREATE INDEX "ThemeInstallation_status_idx" ON "ThemeInstallation"("status");
CREATE UNIQUE INDEX "ThemeInstallation_one_published_per_website_key" ON "ThemeInstallation"("websiteId") WHERE "status" = 'PUBLISHED';
CREATE UNIQUE INDEX "ThemeVersion_installationId_versionNumber_key" ON "ThemeVersion"("installationId", "versionNumber");
CREATE INDEX "ThemeVersion_tenantId_installationId_idx" ON "ThemeVersion"("tenantId", "installationId");
CREATE INDEX "ThemeVersion_status_idx" ON "ThemeVersion"("status");
CREATE INDEX "ThemeDraft_tenantId_installationId_idx" ON "ThemeDraft"("tenantId", "installationId");
CREATE INDEX "ThemeDraft_baseVersionId_idx" ON "ThemeDraft"("baseVersionId");
CREATE INDEX "ThemeRevision_tenantId_installationId_createdAt_idx" ON "ThemeRevision"("tenantId", "installationId", "createdAt");
CREATE INDEX "ThemeRevision_changeType_idx" ON "ThemeRevision"("changeType");
CREATE INDEX "ThemePublishRecord_tenantId_installationId_createdAt_idx" ON "ThemePublishRecord"("tenantId", "installationId", "createdAt");
CREATE INDEX "ThemePublishRecord_versionId_idx" ON "ThemePublishRecord"("versionId");

ALTER TABLE "ThemePackage" ADD CONSTRAINT "ThemePackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeInstallation" ADD CONSTRAINT "ThemeInstallation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeInstallation" ADD CONSTRAINT "ThemeInstallation_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeInstallation" ADD CONSTRAINT "ThemeInstallation_themePackageId_fkey" FOREIGN KEY ("themePackageId") REFERENCES "ThemePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemeInstallation" ADD CONSTRAINT "ThemeInstallation_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "ThemeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThemeInstallation" ADD CONSTRAINT "ThemeInstallation_currentDraftId_fkey" FOREIGN KEY ("currentDraftId") REFERENCES "ThemeDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThemeVersion" ADD CONSTRAINT "ThemeVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeVersion" ADD CONSTRAINT "ThemeVersion_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "ThemeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeVersion" ADD CONSTRAINT "ThemeVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemeDraft" ADD CONSTRAINT "ThemeDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeDraft" ADD CONSTRAINT "ThemeDraft_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "ThemeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeDraft" ADD CONSTRAINT "ThemeDraft_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "ThemeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThemeDraft" ADD CONSTRAINT "ThemeDraft_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemeRevision" ADD CONSTRAINT "ThemeRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeRevision" ADD CONSTRAINT "ThemeRevision_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "ThemeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeRevision" ADD CONSTRAINT "ThemeRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ThemeDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThemeRevision" ADD CONSTRAINT "ThemeRevision_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ThemeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThemeRevision" ADD CONSTRAINT "ThemeRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemePublishRecord" ADD CONSTRAINT "ThemePublishRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemePublishRecord" ADD CONSTRAINT "ThemePublishRecord_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "ThemeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemePublishRecord" ADD CONSTRAINT "ThemePublishRecord_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ThemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemePublishRecord" ADD CONSTRAINT "ThemePublishRecord_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
