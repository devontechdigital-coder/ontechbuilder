import { ThemeFramePage } from "../../../../../../features/websites/theme-frame-page";

export default function WebsiteThemeFrameRoute({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  return <ThemeFramePage params={params} />;
}
