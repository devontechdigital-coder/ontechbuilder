import { cache } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolvePageTemplateId } from "../lib/theme-engine/resolve-template";
import type { RenderedThemePage, RenderThemePageInput } from "../lib/theme-engine/render";

interface PublicSiteResponse {
  hostname: string;
  website: {
    id: string;
    name: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  };
  page: {
    id: string;
    title: string;
    slug: string;
    seo: unknown;
    templateId: string | null;
    content: unknown;
  } | null;
  /** The published theme's real source + the merchant's customizer settings — present once a theme has actually been published for this website. */
  themeEngine: {
    files: Record<string, string>;
    settings: Record<string, unknown>;
    manifest: unknown;
  } | null;
}

export async function renderPublicPage(path: string) {
  const site = await fetchPublicSite(path);
  return renderSite(site, { eyebrow: site?.hostname });
}

export async function publicPageMetadata(path: string): Promise<Metadata> {
  return siteMetadata(await fetchPublicSite(path));
}

export async function renderPreviewPage(websiteId: string, path: string) {
  const site = await fetchPreviewSite(websiteId, path);
  return renderSite(site, { eyebrow: "Portal preview" });
}

export async function previewPageMetadata(websiteId: string, path: string): Promise<Metadata> {
  return siteMetadata(await fetchPreviewSite(websiteId, path));
}

async function renderSite(site: PublicSiteResponse | null, options: { eyebrow?: string | undefined }) {
  if (!site) {
    return <StatusPage title="Site not connected" description="This domain is verified, but no published website is available for this host yet." />;
  }

  if (site.website.status !== "PUBLISHED") {
    return <StatusPage title={site.website.name} description="This website is connected, but it is not published yet." />;
  }

  if (site.page && site.themeEngine) {
    const themedMarkup = await renderThemedPage(site.page, site.themeEngine);
    if (themedMarkup) return themedMarkup;
  }

  if (!site.page) {
    if (site.themeEngine) {
      const themed404 = await renderThemedPage(notFoundPage, site.themeEngine);
      if (themed404) return themed404;
    }
    return <StatusPage title="Page not found" description="We couldn't find the page you were looking for." />;
  }

  return (
    <main className="public-site">
      <section className="hero">
        <p className="eyebrow">{options.eyebrow ?? site.hostname}</p>
        <h1>{site.page?.title ?? site.website.name}</h1>
        <p>{extractSummary(site.page?.content) ?? "This website is live."}</p>
      </section>
    </main>
  );
}

/** Synthetic page fed to the theme's own "404" template — themes register this template id the same way "index"/"page" work (see resolvePageTemplateId). */
const notFoundPage: NonNullable<PublicSiteResponse["page"]> = {
  id: "404",
  title: "Page not found",
  slug: "404",
  seo: null,
  templateId: "404",
  content: null,
};

/**
 * Real theme + section rendering. This calls the internal render-theme
 * Route Handler rather than importing lib/theme-engine/render.tsx
 * directly — that module uses react-dom/server and a class-component
 * error boundary, both of which Next's App Router rejects in a page's own
 * Server Component graph. Falls back to the plain title/summary stub on
 * any failure — a broken theme should never take the whole page down.
 */
async function renderThemedPage(page: NonNullable<PublicSiteResponse["page"]>, themeEngine: NonNullable<PublicSiteResponse["themeEngine"]>) {
  try {
    const templateId = resolvePageTemplateId({ slug: page.slug, templateId: page.templateId });
    const input: RenderThemePageInput = {
      files: themeEngine.files,
      storedManifest: themeEngine.manifest,
      customizerSettings: themeEngine.settings,
      templateId,
      pageKey: page.id,
    };
    // RENDERER_INTERNAL_URL is set explicitly in the render-one-service deployment
    // (this app's own port there is 4102-ish, not 3001) — process.env.PORT is a
    // second line of defense since that deployment sets it to the same value;
    // "3001" only applies to plain local dev (`next dev --port 3001`, no PORT env set).
    const rendererBaseUrl = process.env.RENDERER_INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`;
    const response = await fetch(`${rendererBaseUrl}/api/render-theme`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[renderer] theme render failed:", await response.text());
      return null;
    }
    const rendered = (await response.json()) as RenderedThemePage;
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: rendered.css }} />
        {/* Theme output is our own server-rendered React tree (renderToStaticMarkup), not raw user input — React already escaped every dynamic value during that render pass. */}
        <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
      </>
    );
  } catch (error) {
    console.error("[renderer] theme render failed:", error);
    return null;
  }
}

function siteMetadata(site: PublicSiteResponse | null): Metadata {
  if (!site) {
    return { title: "Site not connected" };
  }
  if (site.website.status !== "PUBLISHED") {
    return { title: site.website.name };
  }
  if (!site.page) {
    return { title: `Page not found – ${site.website.name}` };
  }
  const seo = (site.page?.seo ?? {}) as Record<string, unknown>;
  const metaTitle = typeof seo.metaTitle === "string" && seo.metaTitle.trim() ? seo.metaTitle : (site.page?.title ?? site.website.name);
  const metaDescription = typeof seo.metaDescription === "string" && seo.metaDescription.trim() ? seo.metaDescription : undefined;
  return {
    title: metaTitle,
    ...(metaDescription ? { description: metaDescription } : {}),
  };
}

/** Deduped per-request: generateMetadata and the page body both call this for the same path, and should only hit the API once. */
const fetchPublicSite = cache(async (path: string): Promise<PublicSiteResponse | null> => {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  return resolveSite(host, path);
});

const fetchPreviewSite = cache(async (websiteId: string, path: string): Promise<PublicSiteResponse | null> => {
  return resolvePreviewSite(websiteId, path);
});

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
