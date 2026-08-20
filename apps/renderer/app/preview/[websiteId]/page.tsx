import { previewPageMetadata, renderPreviewPage } from "../../public-renderer";

export async function generateMetadata({ params }: { params: Promise<{ websiteId: string }> }) {
  const resolvedParams = await params;
  return previewPageMetadata(resolvedParams.websiteId, "/");
}

export default async function PreviewHomePage({ params }: { params: Promise<{ websiteId: string }> }) {
  const resolvedParams = await params;

  return renderPreviewPage(resolvedParams.websiteId, "/");
}
