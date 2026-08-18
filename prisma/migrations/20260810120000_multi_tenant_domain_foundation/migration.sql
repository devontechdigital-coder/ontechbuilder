CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
CREATE TYPE "WebsiteStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'FAILED', 'ARCHIVED');

ALTER TABLE "User" RENAME COLUMN "name" TO "displayName";

ALTER TABLE "OrganizationMember"
  ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TenantMember"
  ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Tenant"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TenantStatus"
  USING UPPER("status")::"TenantStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "OrganizationMember"
  ALTER COLUMN "role" TYPE "MembershipRole"
  USING UPPER("role")::"MembershipRole";

ALTER TABLE "TenantMember"
  ALTER COLUMN "role" TYPE "MembershipRole"
  USING UPPER("role")::"MembershipRole";

ALTER TABLE "Site" RENAME TO "Website";
ALTER TABLE "Website" RENAME CONSTRAINT "Site_pkey" TO "Website_pkey";
ALTER INDEX "Site_tenantId_slug_key" RENAME TO "Website_tenantId_slug_key";
ALTER INDEX "Site_tenantId_idx" RENAME TO "Website_tenantId_idx";
ALTER TABLE "Website" RENAME CONSTRAINT "Site_tenantId_fkey" TO "Website_tenantId_fkey";

ALTER TABLE "Website"
  ADD COLUMN "status" "WebsiteStatus" NOT NULL DEFAULT 'DRAFT';

CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX "TenantMember_tenantId_status_idx" ON "TenantMember"("tenantId", "status");
CREATE UNIQUE INDEX "Website_id_tenantId_key" ON "Website"("id", "tenantId");
CREATE INDEX "Website_tenantId_status_idx" ON "Website"("tenantId", "status");

CREATE TABLE "Domain" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "hostname" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");
CREATE UNIQUE INDEX "Domain_websiteId_primary_key" ON "Domain"("websiteId") WHERE "isPrimary" = true;
CREATE INDEX "Domain_tenantId_websiteId_idx" ON "Domain"("tenantId", "websiteId");
CREATE INDEX "Domain_tenantId_verificationStatus_idx" ON "Domain"("tenantId", "verificationStatus");

ALTER TABLE "Domain"
  ADD CONSTRAINT "Domain_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Domain"
  ADD CONSTRAINT "Domain_websiteId_fkey"
  FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Domain"
  ADD CONSTRAINT "Domain_websiteId_tenantId_fkey"
  FOREIGN KEY ("websiteId", "tenantId") REFERENCES "Website"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media"
  ADD COLUMN "websiteId" UUID,
  ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD';

CREATE INDEX "Media_tenantId_status_idx" ON "Media"("tenantId", "status");
CREATE INDEX "Media_tenantId_websiteId_idx" ON "Media"("tenantId", "websiteId");

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_websiteId_fkey"
  FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_websiteId_tenantId_fkey"
  FOREIGN KEY ("websiteId", "tenantId") REFERENCES "Website"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Media_tenantId_mimeType_idx";
