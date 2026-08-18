import type { ThemeDraftSummary, ThemeInstallationSummary } from "../types";
import {
  ASTER_GLOBAL_SETTINGS,
  ASTER_SECTIONS,
  COPORA_GLOBAL_SETTINGS,
  COPORA_SECTIONS,
  getAsterTemplateScope,
  getCoporaTemplateScope,
  getDraftSectionSchemas,
  getDraftSettingsSchema,
  getFileSectionSchemas,
  getFileSettingsSchema,
  isAsterTheme,
  isCoporaTheme,
} from "./schema-parser";
import { getTemplateSectionScope } from "./state";
import type { SectionSchema, TemplateSectionScope, ThemeSetting } from "./types";

export type ThemeRendererResolution = {
  globalSchema: ThemeSetting[];
  sectionSchemas: SectionSchema[];
  getTemplateScope: (templateId: string) => TemplateSectionScope;
};

/**
 * Curated themes (Aster, Copora, ...) get hand-matched schemas + template
 * scopes so their editor and preview render pixel-true to the real package.
 * Anything else falls back to the generic path: parse the uploaded theme's
 * own files first, then its manifest, so it's still schema-driven rather
 * than a blank fallback — just without a human-verified layout per section.
 */
export function resolveThemeRenderer(theme: ThemeInstallationSummary | null, draft: ThemeDraftSummary | null): ThemeRendererResolution {
  if (isAsterTheme(theme, draft)) {
    return {
      globalSchema: ASTER_GLOBAL_SETTINGS,
      sectionSchemas: ASTER_SECTIONS,
      getTemplateScope: getAsterTemplateScope,
    };
  }

  if (isCoporaTheme(theme, draft)) {
    return {
      globalSchema: COPORA_GLOBAL_SETTINGS,
      sectionSchemas: COPORA_SECTIONS,
      getTemplateScope: getCoporaTemplateScope,
    };
  }

  const uploadedGlobalSchema = getFileSettingsSchema(draft);
  const uploadedSectionSchemas = getFileSectionSchemas(draft);
  return {
    globalSchema: uploadedGlobalSchema.length ? uploadedGlobalSchema : getDraftSettingsSchema(draft),
    sectionSchemas: uploadedSectionSchemas.length ? uploadedSectionSchemas : getDraftSectionSchemas(draft),
    getTemplateScope: (templateId: string) => getTemplateSectionScope(draft, templateId),
  };
}
