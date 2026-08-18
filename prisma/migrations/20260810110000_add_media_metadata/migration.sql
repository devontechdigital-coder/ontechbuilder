CREATE TABLE "Media" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Media_tenantId_storageKey_key" ON "Media"("tenantId", "storageKey");
CREATE INDEX "Media_tenantId_createdAt_idx" ON "Media"("tenantId", "createdAt");
CREATE INDEX "Media_tenantId_mimeType_idx" ON "Media"("tenantId", "mimeType");

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

