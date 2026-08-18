ALTER TYPE "WebsiteStatus" RENAME VALUE 'ACTIVE' TO 'PUBLISHED';

CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISABLED');

ALTER TABLE "Domain"
  ADD COLUMN "normalizedHostname" TEXT,
  ADD COLUMN "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verificationToken" TEXT;

UPDATE "Domain"
SET
  "normalizedHostname" = lower(regexp_replace(trim(trailing '.' from "hostname"), '^https?://', '')),
  "verificationToken" = md5(random()::text || clock_timestamp()::text || "id"::text);

ALTER TABLE "Domain"
  ALTER COLUMN "normalizedHostname" SET NOT NULL,
  ALTER COLUMN "verificationToken" SET NOT NULL;

DROP INDEX "Domain_hostname_key";

CREATE UNIQUE INDEX "Domain_normalizedHostname_key" ON "Domain"("normalizedHostname");
CREATE INDEX "Domain_websiteId_isPrimary_idx" ON "Domain"("websiteId", "isPrimary");
CREATE INDEX "Domain_tenantId_status_idx" ON "Domain"("tenantId", "status");
