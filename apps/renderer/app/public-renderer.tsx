import { headers } from "next/headers";

interface PublicSiteResponse {
  hostname: string;
  website: {
    name: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  };
  page: {
    title: string;
    slug: string;
    content: unknown;
  } | null;
}

export async function renderPublicPage(path: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const site = await resolveSite(host, path);

  if (!site) {
    return <StatusPage title="Site not connected" description="This domain is verified, but no published website is available for this host yet." />;
  }

  if (site.website.status !== "PUBLISHED") {
    return <StatusPage title={site.website.name} description="This website is connected, but it is not published yet." />;
  }

  return (
    <main className="public-site">
      <section className="hero">
        <p className="eyebrow">{site.hostname}</p>
        <h1>{site.page?.title ?? site.website.name}</h1>
        <p>{extractSummary(site.page?.content) ?? "This website is live."}</p>
      </section>
    </main>
  );
}

export async function renderPreviewPage(websiteId: string, path: string) {
  const site = await resolvePreviewSite(websiteId, path);

  if (!site) {
    return <StatusPage title="Preview not found" description="This portal preview URL does not match an active website." />;
  }

  return (
    <main className="public-site">
      <section className="hero">
        <p className="eyebrow">Portal preview</p>
        <h1>{site.page?.title ?? site.website.name}</h1>
        <p>{extractSummary(site.page?.content) ?? "This website preview is ready."}</p>
      </section>
    </main>
  );
}

async function resolveSite(host: string, path: string): Promise<PublicSiteResponse | null> {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(
    `${apiBaseUrl}/public/sites/resolve?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<PublicSiteResponse>;
}

async function resolvePreviewSite(websiteId: string, path: string): Promise<PublicSiteResponse | null> {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(
    `${apiBaseUrl}/public/sites/preview/${encodeURIComponent(websiteId)}?path=${encodeURIComponent(path)}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<PublicSiteResponse>;
}

function StatusPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="shell">
      <section className="status">
        <p className="eyebrow">Website</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  );
}

function extractSummary(content: unknown): string | null {
  if (!content || typeof content !== "object") {
    return null;
  }

  const record = content as Record<string, unknown>;
  const candidates = [record.summary, record.description, record.excerpt, record.body, record.content];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}
