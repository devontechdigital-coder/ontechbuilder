import { AnalyticsWorkspace } from "../../../../features/websites/analytics-workspace";

export default function WebsiteAnalyticsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <AnalyticsWorkspace params={params} />;
}
