import { ThemeCustomizerPage } from "../../../../../../features/websites/theme-customizer-page";

export default function WebsiteThemeCustomizeRoute({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  return <ThemeCustomizerPage params={params} />;
}
