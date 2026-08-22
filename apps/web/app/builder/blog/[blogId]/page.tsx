"use client";

import { use } from "react";
import { BuilderPageResolver } from "../../../../features/websites/builder-page-resolver";

interface BuilderBlogPageProps {
  params: Promise<{ blogId: string }>;
}

/**
 * A blog post is stored as a Page record too (same shape, distinguished by blogCategoryId — see
 * website-workspace.tsx's shared pages/blogs table), so it's edited through the exact same
 * customizer as a regular page. All the actual resolve-and-launch logic lives in
 * BuilderPageResolver, shared with /builder/pages/[pageId], so a change there applies to both
 * routes automatically.
 */
export default function BuilderBlogPage({ params }: BuilderBlogPageProps) {
  const { blogId } = use(params);
  return <BuilderPageResolver pageId={blogId} />;
}
