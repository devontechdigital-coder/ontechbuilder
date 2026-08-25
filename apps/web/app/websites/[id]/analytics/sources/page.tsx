import { Suspense } from "react";
import { LoadingState } from "../../../../../components/ui/display";
import { AnalyticsListWorkspace } from "../../../../../features/websites/analytics-list-workspace";

export default function WebsiteAnalyticsSourcesRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState label="Loading analytics" />}>
      <AnalyticsListWorkspace params={params} kind="sources" />
    </Suspense>
  );
}
