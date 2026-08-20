import { publicPageMetadata, renderPublicPage } from "../public-renderer";

async function resolvePath({ params }: { params: Promise<{ path?: string[] }> }) {
  const resolvedParams = await params;
  return `/${resolvedParams.path?.join("/") ?? ""}`;
}

export async function generateMetadata(props: { params: Promise<{ path?: string[] }> }) {
  return publicPageMetadata(await resolvePath(props));
}

export default async function PublicPathPage(props: { params: Promise<{ path?: string[] }> }) {
  return renderPublicPage(await resolvePath(props));
}
