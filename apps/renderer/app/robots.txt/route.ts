import { headers } from "next/headers";
import { fetchPublicSiteSeo, type PublicSiteSeoResponse } from "../../lib/public-site-seo";

/**
 * Custom domains only — the admin host and preview URLs have no reason to be crawled, and this
 * app has no way to resolve a website for them anyway (same host lookup public-renderer.tsx uses
 * for every other page). A domain with nothing published, or one that doesn't resolve at all,
 * still gets a real robots.txt back (Disallow: /) rather than a 404 — a missing robots.txt is
 * conventionally read as "crawl everything," which is the wrong default for a site that isn't
 * actually live yet.
 */
export async function GET() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const seo = await fetchPublicSiteSeo(host);

  return new Response(buildRobotsTxt(seo, host), { headers: { "content-type": "text/plain; charset=utf-8" } });
}

function buildRobotsTxt(seo: PublicSiteSeoResponse | null, host: string): string {
  if (!seo || !seo.published) {
    return "User-agent: *\nDisallow: /\n";
  }

  if (seo.robotsTxtEnabled && seo.robotsTxtContent.trim()) {
    return seo.robotsTxtContent.endsWith("\n") ? seo.robotsTxtContent : `${seo.robotsTxtContent}\n`;
  }

  if (!seo.searchEngineVisible) {
    return "User-agent: *\nDisallow: /\n";
  }

  const lines = ["User-agent: *", "Allow: /"];
  if (seo.sitemapEnabled && host) {
    lines.push(`Sitemap: https://${host}/sitemap.xml`);
  }
  return `${lines.join("\n")}\n`;
}
