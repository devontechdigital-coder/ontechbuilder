import { WebsiteWorkspace } from "../../../../features/websites/website-workspace";

export default function WebsiteSettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <WebsiteWorkspace params={params} section="settings" />;
}
