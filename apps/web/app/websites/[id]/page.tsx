import { WebsiteWorkspace } from "../../../features/websites/website-workspace";

export default function WebsitePagesRoute({ params }: { params: Promise<{ id: string }> }) {
  return <WebsiteWorkspace params={params} section="pages" />;
}
