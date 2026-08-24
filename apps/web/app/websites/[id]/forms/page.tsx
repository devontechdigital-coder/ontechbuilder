import { FormsWorkspace } from "../../../../features/websites/forms-workspace";

export default function WebsiteFormsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <FormsWorkspace params={params} />;
}
