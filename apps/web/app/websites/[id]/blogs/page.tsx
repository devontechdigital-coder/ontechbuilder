import { WebsiteWorkspace } from "../../../../features/websites/website-workspace";

export default function WebsiteBlogsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <WebsiteWorkspace params={params} section="blogs" />;
}
