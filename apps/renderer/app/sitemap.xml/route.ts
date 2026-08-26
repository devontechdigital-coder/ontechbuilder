import { headers } from "next/headers";
import { fetchPublicSiteSeo } from "../../lib/public-site-seo";

/** Same host resolution as /robots.txt and every rendered page — see fetchPublicSiteSeo. */
export async function GET() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const seo = await fetchPublicSiteSeo(host);

  // No sitemap for a domain that doesn't resolve, isn't published, or has the toggle off — a
  // sitemap advertising nothing real would only confuse crawlers.
  if (!seo || !seo.published || !seo.sitemapEnabled || !host) {
    return new Response("Not found", { status: 404 });
  }

  const urls = seo.paths
    .map((entry) => {
      const loc = `https://${host}${entry.path}`;
      const lastmod = new Date(entry.updatedAt).toISOString();
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}
