ALTER TABLE "BlogCategory"
  ADD COLUMN "image" TEXT,
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "seo" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "status" "PageStatus" NOT NULL DEFAULT 'PUBLISHED';

CREATE INDEX "BlogCategory_tenantId_status_idx" ON "BlogCategory"("tenantId", "status");
