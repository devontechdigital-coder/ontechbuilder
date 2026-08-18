import { WebsiteWorkspace } from "../../../../features/websites/website-workspace";

export default function WebsiteThemesRoute({ params }: { params: Promise<{ id: string }> }) {
  return <WebsiteWorkspace params={params} section="themes" />;
}
