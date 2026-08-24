import { LiveViewWorkspace } from "../../../../../features/websites/live-view-workspace";

export default function WebsiteLiveViewRoute({ params }: { params: Promise<{ id: string }> }) {
  return <LiveViewWorkspace params={params} />;
}
