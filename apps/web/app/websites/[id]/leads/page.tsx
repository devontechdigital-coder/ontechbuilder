import { LeadsWorkspace } from "../../../../features/websites/leads-workspace";

export default function WebsiteLeadsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <LeadsWorkspace params={params} />;
}
