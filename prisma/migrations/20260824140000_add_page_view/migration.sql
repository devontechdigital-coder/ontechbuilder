CREATE TABLE "PageView" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "pageId" UUID,
    "sessionId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "deviceType" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageView_tenantId_websiteId_createdAt_idx" ON "PageView"("tenantId", "websiteId", "createdAt");
CREATE INDEX "PageView_websiteId_sessionId_idx" ON "PageView"("websiteId", "sessionId");
CREATE INDEX "PageView_websiteId_createdAt_idx" ON "PageView"("websiteId", "createdAt");

ALTER TABLE "PageView" ADD CONSTRAINT "PageView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
