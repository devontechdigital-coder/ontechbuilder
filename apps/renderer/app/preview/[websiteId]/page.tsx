import { renderPreviewPage } from "../../public-renderer";

export default async function PreviewHomePage({ params }: { params: Promise<{ websiteId: string }> }) {
  const resolvedParams = await params;

  return renderPreviewPage(resolvedParams.websiteId, "/");
}
