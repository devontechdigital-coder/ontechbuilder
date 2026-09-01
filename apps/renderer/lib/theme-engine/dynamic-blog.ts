/**
 * Server-side counterpart to apps/web/features/websites/customizer/dynamic-blog.ts — replaces a
 * "Blog grid" section's manually-authored Post blocks with this website's REAL published posts
 * when its own "Posts to show" setting is "dynamic" (see ontech-theme-zip's
 * sections/BlogGrid/schema.ts). Runs on the theme's customizerSettings BEFORE build-tree.tsx ever
 * resolves it into section groups — same pipeline stage, and same "recursively walk any settings
 * shape" approach, as this file's neighbour shortcodes.ts.
 */

interface PublicBlogPost {
  id: string;
  title: string;
  href: string;
  date: string;
  tag: string | null;
}

interface DynamicBlogGridSection {
  schemaId: string;
  settings: Record<string, unknown>;
  blocks: unknown[];
}

function isDynamicBlogGridSection(value: unknown): value is DynamicBlogGridSection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaId === "blog-grid" && Array.isArray(candidate.blocks) && !!candidate.settings && typeof candidate.settings === "object" && (candidate.settings as Record<string, unknown>).postSource === "dynamic";
}

function formatPostDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function postsToBlocks(posts: PublicBlogPost[]) {
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

async function fetchDynamicPosts(internalApiBaseUrl: string, websiteId: string, sectionSettings: Record<string, unknown>, cache: Map<string, unknown[]>): Promise<unknown[]> {
  const categoryMode = sectionSettings.categoryMode === "specific" ? "specific" : "all";
  const categoryIds = categoryMode === "specific" && Array.isArray(sectionSettings.categoryIds) ? (sectionSettings.categoryIds as unknown[]).map(String) : [];
  const postLimit = typeof sectionSettings.postLimit === "number" ? sectionSettings.postLimit : 6;
  const cacheKey = `${websiteId}|${categoryMode === "specific" ? categoryIds.slice().sort().join(",") : "all"}|${postLimit}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const query = new URLSearchParams({ websiteId, limit: String(postLimit) });
    if (categoryMode === "specific" && categoryIds.length) query.set("categoryIds", categoryIds.join(","));
    const response = await fetch(`${internalApiBaseUrl}/public/sites/blog-posts?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const posts = (await response.json()) as PublicBlogPost[];
    const blocks = postsToBlocks(posts);
    cache.set(cacheKey, blocks);
    return blocks;
  } catch {
    return [];
  }
}

/** Recursively walks the theme's customizer settings tree, swapping in real posts for any "dynamic" Blog grid section it finds (in any page, header, or footer group). */
export async function injectDynamicBlogPosts(value: unknown, internalApiBaseUrl: string, websiteId: string, cache: Map<string, unknown[]> = new Map()): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => injectDynamicBlogPosts(item, internalApiBaseUrl, websiteId, cache)));
  }
  if (value && typeof value === "object") {
    if (isDynamicBlogGridSection(value)) {
      const blocks = await fetchDynamicPosts(internalApiBaseUrl, websiteId, value.settings, cache);
      return { ...value, blocks };
    }
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, val]) => [key, await injectDynamicBlogPosts(val, internalApiBaseUrl, websiteId, cache)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}
