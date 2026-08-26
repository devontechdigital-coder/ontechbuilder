export interface PublicSiteSeoResponse {
  websiteId: string;
  published: boolean;
  searchEngineVisible: boolean;
  robotsTxtEnabled: boolean;
  robotsTxtContent: string;
  sitemapEnabled: boolean;
  paths: Array<{ path: string; updatedAt: string }>;
}

/** Shared by /robots.txt and /sitemap.xml — see WebsitesService.resolvePublicSiteSeo on the API side. */
export async function fetchPublicSiteSeo(host: string): Promise<PublicSiteSeoResponse | null> {
  if (!host) return null;
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiBaseUrl}/public/sites/seo?host=${encodeURIComponent(host)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as PublicSiteSeoResponse;
  } catch {
    return null;
  }
}
