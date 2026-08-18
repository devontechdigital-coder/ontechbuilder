import { WebsiteWorkspace } from "../../../../features/websites/website-workspace";

export default function WebsiteDomainsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <WebsiteWorkspace params={params} section="domains" />;
}
