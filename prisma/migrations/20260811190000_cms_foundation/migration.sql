CREATE TYPE "ContentTypeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "ContentFieldStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "ContentFieldType" AS ENUM ('TEXT', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'IMAGE', 'URL');

CREATE TYPE "ContentEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "ContentEntryVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "ContentType" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ContentTypeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentField" (
  "id" UUID NOT NULL,
  "contentTypeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "ContentFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  "configuration" JSONB,
  "status" "ContentFieldStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentEntry" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "contentTypeId" UUID NOT NULL,
  "draftVersionId" UUID,
  "publishedVersionId" UUID,
  "status" "ContentEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL,
  "createdBy" UUID NOT NULL,
  "updatedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentEntryVersion" (
  "id" UUID NOT NULL,
  "entryId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "ContentEntryVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContentEntryVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentType_id_tenantId_key" ON "ContentType"("id", "tenantId");
CREATE UNIQUE INDEX "ContentType_id_websiteId_key" ON "ContentType"("id", "websiteId");
CREATE UNIQUE INDEX "ContentType_websiteId_slug_key" ON "ContentType"("websiteId", "slug");
CREATE INDEX "ContentType_tenantId_websiteId_idx" ON "ContentType"("tenantId", "websiteId");
CREATE INDEX "ContentType_tenantId_status_idx" ON "ContentType"("tenantId", "status");
CREATE INDEX "ContentType_websiteId_status_idx" ON "ContentType"("websiteId", "status");

CREATE UNIQUE INDEX "ContentField_contentTypeId_slug_key" ON "ContentField"("contentTypeId", "slug");
CREATE UNIQUE INDEX "ContentField_contentTypeId_position_key" ON "ContentField"("contentTypeId", "position");
CREATE INDEX "ContentField_contentTypeId_status_idx" ON "ContentField"("contentTypeId", "status");

CREATE UNIQUE INDEX "ContentEntry_id_tenantId_key" ON "ContentEntry"("id", "tenantId");
CREATE UNIQUE INDEX "ContentEntry_id_contentTypeId_key" ON "ContentEntry"("id", "contentTypeId");
CREATE INDEX "ContentEntry_tenantId_websiteId_idx" ON "ContentEntry"("tenantId", "websiteId");
CREATE INDEX "ContentEntry_tenantId_status_idx" ON "ContentEntry"("tenantId", "status");
CREATE INDEX "ContentEntry_contentTypeId_status_idx" ON "ContentEntry"("contentTypeId", "status");
CREATE INDEX "ContentEntry_draftVersionId_idx" ON "ContentEntry"("draftVersionId");
CREATE INDEX "ContentEntry_publishedVersionId_idx" ON "ContentEntry"("publishedVersionId");
CREATE INDEX "ContentEntry_updatedAt_idx" ON "ContentEntry"("updatedAt");

CREATE UNIQUE INDEX "ContentEntryVersion_entryId_versionNumber_key" ON "ContentEntryVersion"("entryId", "versionNumber");
CREATE UNIQUE INDEX "ContentEntryVersion_one_published_per_entry_key"
  ON "ContentEntryVersion"("entryId")
  WHERE "status" = 'PUBLISHED';
CREATE INDEX "ContentEntryVersion_entryId_status_idx" ON "ContentEntryVersion"("entryId", "status");
CREATE INDEX "ContentEntryVersion_createdBy_createdAt_idx" ON "ContentEntryVersion"("createdBy", "createdAt");

ALTER TABLE "ContentType"
  ADD CONSTRAINT "ContentType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentType_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentField"
  ADD CONSTRAINT "ContentField_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentEntry"
  ADD CONSTRAINT "ContentEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentEntry_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentEntry_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentEntry_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentEntryVersion"
  ADD CONSTRAINT "ContentEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentEntryVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentEntry"
  ADD CONSTRAINT "ContentEntry_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "ContentEntryVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentEntry_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "ContentEntryVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
