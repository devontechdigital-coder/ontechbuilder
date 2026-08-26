-- Favicon, injected head/body/footer code, and SEO visibility/robots.txt/sitemap toggles for a website.
ALTER TABLE "Website"
  ADD COLUMN "faviconUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "headCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bodyCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "footerCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "searchEngineVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "robotsTxtEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "robotsTxtContent" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sitemapEnabled" BOOLEAN NOT NULL DEFAULT true;
