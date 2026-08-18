import { ThemeCodeEditorPage } from "../../../../../../features/websites/theme-code-editor-page";

export default function WebsiteThemeCodeRoute({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  return <ThemeCodeEditorPage params={params} />;
}
