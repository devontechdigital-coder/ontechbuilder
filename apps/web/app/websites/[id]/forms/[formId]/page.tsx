import { FormBuilderPage } from "../../../../../features/websites/form-builder-page";

export default function WebsiteFormBuilderRoute({ params }: { params: Promise<{ id: string; formId: string }> }) {
  return <FormBuilderPage params={params} />;
}
