CREATE TYPE "MediaAccess" AS ENUM ('PRIVATE', 'PUBLIC');

ALTER TABLE "Media" DROP COLUMN IF EXISTS "status";

ALTER TABLE "Media"
  ADD COLUMN "createdBy" UUID,
  ADD COLUMN "filename" TEXT,
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "bucket" TEXT,
  ADD COLUMN "access" "MediaAccess" NOT NULL DEFAULT 'PRIVATE';

UPDATE "Media"
SET
  "filename" = regexp_replace(lower("originalFilename"), '[^a-z0-9._-]+', '-', 'g'),
  "storageProvider" = 'gcs',
  "bucket" = 'unknown'
WHERE "filename" IS NULL OR "storageProvider" IS NULL OR "bucket" IS NULL;

DELETE FROM "Media" WHERE "createdBy" IS NULL;

ALTER TABLE "Media"
  ALTER COLUMN "createdBy" SET NOT NULL,
  ALTER COLUMN "filename" SET NOT NULL,
  ALTER COLUMN "storageProvider" SET NOT NULL,
  ALTER COLUMN "bucket" SET NOT NULL,
  ALTER COLUMN "sizeBytes" TYPE BIGINT;

ALTER TABLE "Media"
  ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'READY';

DROP INDEX IF EXISTS "Media_tenantId_status_idx";
CREATE INDEX IF NOT EXISTS "Media_tenantId_mimeType_idx" ON "Media"("tenantId", "mimeType");
CREATE INDEX IF NOT EXISTS "Media_createdBy_createdAt_idx" ON "Media"("createdBy", "createdAt");

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
