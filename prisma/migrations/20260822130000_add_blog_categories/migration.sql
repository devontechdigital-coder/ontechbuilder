CREATE TABLE "BlogCategory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BlogCategory" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "Page" ADD COLUMN "blogCategoryId" UUID;

CREATE UNIQUE INDEX "BlogCategory_id_tenantId_key" ON "BlogCategory"("id", "tenantId");
CREATE UNIQUE INDEX "BlogCategory_websiteId_slug_key" ON "BlogCategory"("websiteId", "slug");
CREATE INDEX "BlogCategory_tenantId_websiteId_idx" ON "BlogCategory"("tenantId", "websiteId");
CREATE INDEX "Page_blogCategoryId_idx" ON "Page"("blogCategoryId");

ALTER TABLE "BlogCategory" ADD CONSTRAINT "BlogCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlogCategory" ADD CONSTRAINT "BlogCategory_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_blogCategoryId_fkey" FOREIGN KEY ("blogCategoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
