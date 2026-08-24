CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'OPEN', 'QUALIFIED', 'MEETING_BOOKED', 'FOLLOW_UP', 'CLOSED');

ALTER TABLE "FormSubmission" ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "FormSubmission" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "FormSubmission_tenantId_status_idx" ON "FormSubmission"("tenantId", "status");
