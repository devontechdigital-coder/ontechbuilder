import { apiRequest } from "../../../lib/api";
import type { SectionGroups, SectionBlock, SectionInstance } from "./types";

/**
 * Client-side counterpart to apps/renderer/lib/theme-engine/dynamic-blog.ts — replaces a "Blog
 * grid" section's manually-authored Post blocks with this website's REAL published posts when its
 * own "Posts to show" setting is "dynamic" (see ontech-theme-zip's sections/BlogGrid/schema.ts),
 * for the CUSTOMIZER'S own live iframe preview, so what a merchant sees while editing matches what
 * the public site actually renders. Deliberately duplicated rather than imported across apps —
 * same tradeoff as every other vendored theme-engine file in this codebase, and the same pattern
 * ./shortcodes.ts already uses for `[form id="..."]` tokens.
 */

interface PublicBlogPost {
  id: string;
  title: string;
  href: string;
  date: string;
  tag: string | null;
}

function formatPostDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function postsToBlocks(posts: PublicBlogPost[]): SectionBlock[] {
  return posts.map((post) => ({
    id: `dynamic-post-${post.id}`,
    type: "post",
    name: "Post",
    settings: {
      title: post.title,
      linkHref: post.href,
      date: formatPostDate(post.date),
      ...(post.tag ? { tag: post.tag } : {}),
    },
  }));
}

async function fetchDynamicPosts(websiteId: string, section: SectionInstance, cache: Map<string, SectionBlock[]>): Promise<SectionBlock[]> {
  const categoryMode = section.settings.categoryMode === "specific" ? "specific" : "all";
  const categoryIds = categoryMode === "specific" && Array.isArray(section.settings.categoryIds) ? (section.settings.categoryIds as unknown[]).map(String) : [];
  const postLimit = typeof section.settings.postLimit === "number" ? section.settings.postLimit : 6;
  const cacheKey = `${websiteId}|${categoryMode === "specific" ? categoryIds.slice().sort().join(",") : "all"}|${postLimit}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const query = new URLSearchParams({ websiteId, limit: String(postLimit) });
    if (categoryMode === "specific" && categoryIds.length) query.set("categoryIds", categoryIds.join(","));
    const posts = await apiRequest<PublicBlogPost[]>(`/public/sites/blog-posts?${query.toString()}`);
    const blocks = postsToBlocks(posts);
    cache.set(cacheKey, blocks);
    return blocks;
  } catch {
    return [];
  }
}

function isDynamicBlogGrid(section: SectionInstance): boolean {
  return section.schemaId === "blog-grid" && section.settings.postSource === "dynamic";
}

async function resolveSection(websiteId: string, section: SectionInstance, cache: Map<string, SectionBlock[]>): Promise<SectionInstance> {
  if (!isDynamicBlogGrid(section)) return section;
  return { ...section, blocks: await fetchDynamicPosts(websiteId, section, cache) };
}

/** Walks every section in every group, swapping in real posts for any "dynamic" Blog grid section. */
export async function injectDynamicBlogPosts(groups: SectionGroups, websiteId: string, cache: Map<string, SectionBlock[]>): Promise<SectionGroups> {
  const hasDynamicSection = [...groups.header, ...groups.template, ...groups.footer].some(isDynamicBlogGrid);
  if (!hasDynamicSection) return groups;

  const [header, template, footer] = await Promise.all([
    Promise.all(groups.header.map((section) => resolveSection(websiteId, section, cache))),
    Promise.all(groups.template.map((section) => resolveSection(websiteId, section, cache))),
    Promise.all(groups.footer.map((section) => resolveSection(websiteId, section, cache))),
  ]);
  return { header, template, footer };
}
