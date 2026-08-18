import { notFound } from "next/navigation";
import { DocsShell } from "../../../features/docs/docs-shell";
import { DOC_CONTENT } from "../../../features/docs/registry";
import { DOC_TOPICS } from "../../../features/docs/topics";

export function generateStaticParams() {
  return DOC_TOPICS.map((topic) => ({ slug: topic.slug }));
}

export default async function DocsTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const Content = DOC_CONTENT[slug];
  if (!Content) notFound();

  return (
    <DocsShell activeSlug={slug}>
      <Content />
    </DocsShell>
  );
}
