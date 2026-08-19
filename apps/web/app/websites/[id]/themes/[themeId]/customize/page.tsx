import { ThemeCustomizerPage } from "../../../../../../features/websites/theme-customizer-page";

export default async function WebsiteThemeCustomizeRoute({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  const { id, themeId } = await params;
  return <ThemeCustomizerPage websiteId={id} themeId={themeId} />;
}
