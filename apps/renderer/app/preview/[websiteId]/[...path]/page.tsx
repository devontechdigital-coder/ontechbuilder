import { previewPageMetadata, renderPreviewPage } from "../../../public-renderer";

async function resolveParams({ params }: { params: Promise<{ websiteId: string; path?: string[] }> }) {
  const resolvedParams = await params;
  return { websiteId: resolvedParams.websiteId, path: `/${resolvedParams.path?.join("/") ?? ""}` };
}

export async function generateMetadata(props: { params: Promise<{ websiteId: string; path?: string[] }> }) {
  const { websiteId, path } = await resolveParams(props);
  return previewPageMetadata(websiteId, path);
}

export default async function PreviewPathPage(props: { params: Promise<{ websiteId: string; path?: string[] }> }) {
  const { websiteId, path } = await resolveParams(props);
  return renderPreviewPage(websiteId, path);
}
