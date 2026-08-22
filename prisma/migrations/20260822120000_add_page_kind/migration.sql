CREATE TYPE "PageKind" AS ENUM ('PAGE', 'BLOG');

ALTER TABLE "Page" ADD COLUMN "kind" "PageKind" NOT NULL DEFAULT 'PAGE';

CREATE INDEX "Page_tenantId_websiteId_kind_idx" ON "Page"("tenantId", "websiteId", "kind");
