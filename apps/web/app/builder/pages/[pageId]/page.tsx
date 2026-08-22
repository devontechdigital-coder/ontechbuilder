"use client";

import { use } from "react";
import { BuilderPageResolver } from "../../../../features/websites/builder-page-resolver";

interface BuilderPageProps {
  params: Promise<{ pageId: string }>;
}

/**
 * A page has no editor of its own — it's edited through its website's theme customizer, the same
 * surface used at /websites/:id/themes/:themeId/customize. All the actual resolve-and-launch logic
 * lives in BuilderPageResolver, shared with /builder/blog/[blogId] (a blog post is a Page record
 * too), so a change there applies to both routes automatically.
 */
export default function BuilderPage({ params }: BuilderPageProps) {
  const { pageId } = use(params);
  return <BuilderPageResolver pageId={pageId} />;
}
