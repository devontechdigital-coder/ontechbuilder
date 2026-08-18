import { ThemePreviewPage } from "../../../../../../features/websites/theme-preview-page";

export default function WebsiteThemePreviewRoute({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  return <ThemePreviewPage params={params} />;
}
