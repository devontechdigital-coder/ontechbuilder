import { renderPublicPage } from "../public-renderer";

export default async function PublicPathPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const resolvedParams = await params;
  const path = `/${resolvedParams.path?.join("/") ?? ""}`;

  return renderPublicPage(path);
}
