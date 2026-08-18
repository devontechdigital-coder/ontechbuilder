CREATE TABLE "WebsiteTheme" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "websiteId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "tokens" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsiteTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteTheme_active_theme_key" ON "WebsiteTheme"("websiteId") WHERE "isActive" = true;
CREATE INDEX "WebsiteTheme_websiteId_idx" ON "WebsiteTheme"("websiteId");

ALTER TABLE "WebsiteTheme"
  ADD CONSTRAINT "WebsiteTheme_websiteId_fkey"
  FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
