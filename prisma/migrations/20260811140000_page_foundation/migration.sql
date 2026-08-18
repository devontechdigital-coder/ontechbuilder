CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "PageVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Page" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "parentId" UUID,
  "draftVersionId" UUID,
  "publishedVersionId" UUID,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PageVersion" (
  "id" UUID NOT NULL,
  "pageId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "PageVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "content" JSONB NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PageVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Website" ADD COLUMN "homePageId" UUID;

CREATE UNIQUE INDEX "Page_id_tenantId_key" ON "Page"("id", "tenantId");
CREATE UNIQUE INDEX "Page_id_websiteId_key" ON "Page"("id", "websiteId");
CREATE UNIQUE INDEX "Page_websiteId_slug_key" ON "Page"("websiteId", "slug");
CREATE INDEX "Page_tenantId_websiteId_idx" ON "Page"("tenantId", "websiteId");
CREATE INDEX "Page_tenantId_status_idx" ON "Page"("tenantId", "status");
CREATE INDEX "Page_websiteId_parentId_idx" ON "Page"("websiteId", "parentId");
CREATE INDEX "Page_draftVersionId_idx" ON "Page"("draftVersionId");
CREATE INDEX "Page_publishedVersionId_idx" ON "Page"("publishedVersionId");

CREATE UNIQUE INDEX "PageVersion_pageId_versionNumber_key" ON "PageVersion"("pageId", "versionNumber");
CREATE UNIQUE INDEX "PageVersion_one_published_per_page_key"
  ON "PageVersion"("pageId")
  WHERE "status" = 'PUBLISHED';
CREATE INDEX "PageVersion_pageId_status_idx" ON "PageVersion"("pageId", "status");
CREATE INDEX "PageVersion_createdBy_createdAt_idx" ON "PageVersion"("createdBy", "createdAt");

CREATE INDEX "Website_homePageId_idx" ON "Website"("homePageId");

ALTER TABLE "Page"
  ADD CONSTRAINT "Page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Page_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PageVersion"
  ADD CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PageVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Page"
  ADD CONSTRAINT "Page_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "PageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Page_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Website"
  ADD CONSTRAINT "Website_homePageId_fkey" FOREIGN KEY ("homePageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
