/**
 * Vendored, verbatim (aside from these import lines), from
 * apps/web/features/websites/customizer/theme-renderer.ts. Keep in sync
 * by hand — see render.ts for why this app carries its own copy instead
 * of importing across apps.
 */
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
import type { SectionSchema, TemplateSectionScope, ThemeDraftSummary, ThemeInstallationSummary, ThemeSetting } from "./types";

export type ThemeRendererResolution = {
  globalSchema: ThemeSetting[];
  sectionSchemas: SectionSchema[];
  getTemplateScope: (templateId: string) => TemplateSectionScope;
};

/**
 * A real uploaded theme's own files always win when it has section schemas to parse from them —
 * that's the merchant's actual content. The curated Aster/Copora data below is a hand-matched
 * fallback for installs that carry no uploaded files of their own to parse (nothing else to go
 * on), matched by name as a last resort only. It must never come first: matching by a name
 * substring ("aster", "copora") means any real uploaded theme that happens to share that name —
 * or is a newer, larger evolution of the same theme, as this platform has already seen happen —
 * would otherwise have its actual content silently replaced by this old, incomplete snapshot.
 */
export function resolveThemeRenderer(theme: ThemeInstallationSummary | null, draft: ThemeDraftSummary | null): ThemeRendererResolution {
  const uploadedSectionSchemas = getFileSectionSchemas(draft);
  if (uploadedSectionSchemas.length) {
    const uploadedGlobalSchema = getFileSettingsSchema(draft);
    return {
      globalSchema: uploadedGlobalSchema.length ? uploadedGlobalSchema : getDraftSettingsSchema(draft),
      sectionSchemas: uploadedSectionSchemas,
      getTemplateScope: (templateId: string) => getTemplateSectionScope(draft, templateId),
    };
  }

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

  return {
    globalSchema: getDraftSettingsSchema(draft),
    sectionSchemas: getDraftSectionSchemas(draft),
    getTemplateScope: (templateId: string) => getTemplateSectionScope(draft, templateId),
  };
}
