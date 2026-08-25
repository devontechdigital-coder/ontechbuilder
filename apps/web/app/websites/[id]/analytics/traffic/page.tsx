import { Suspense } from "react";
import { LoadingState } from "../../../../../components/ui/display";
import { AnalyticsTrafficWorkspace } from "../../../../../features/websites/analytics-traffic-workspace";

export default function WebsiteAnalyticsTrafficRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState label="Loading analytics" />}>
      <AnalyticsTrafficWorkspace params={params} />
    </Suspense>
  );
}
