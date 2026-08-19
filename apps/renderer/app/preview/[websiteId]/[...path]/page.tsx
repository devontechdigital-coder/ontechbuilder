import { renderPreviewPage } from "../../../public-renderer";

export default async function PreviewPathPage({
  params,
}: {
  params: Promise<{ websiteId: string; path?: string[] }>;
}) {
  const resolvedParams = await params;
  const path = `/${resolvedParams.path?.join("/") ?? ""}`;

  return renderPreviewPage(resolvedParams.websiteId, path);
}
