/**
 * Vendored, verbatim, from apps/web/features/websites/customizer/types.ts.
 * Kept in sync by hand — see render.ts for why this app carries its own
 * copy instead of importing across apps.
 */

export type SelectOption = string | { value: string; label: string };

export type ThemeSetting = {
  id: string;
  type: string;
  label: string;
  group: string;
  default?: unknown;
  info?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: SelectOption[];
};

export type BlockSchema = {
  type: string;
  name: string;
  settings: ThemeSetting[];
  /** Which tab a host's "Add block" picker groups this type under — see ontech-theme-zip's config/settings.schema.ts BlockSchema.group. Omitted (or "default") means this section's own purpose-built block type; "custom" means it's one of a shared reusable block library. */
  group?: "default" | "custom";
};

/** Where a section lives in the outline — mirrors Shopify's Header / Template / Footer split. */
export type SectionGroupKey = "header" | "template" | "footer";

export type SectionSchema = {
  id: string;
  name: string;
  category: string;
  settings: ThemeSetting[];
  blocks?: BlockSchema[];
  maxBlocks?: number;
  defaultBlocks?: Array<{ type: string; settings: Record<string, unknown>; depth?: number }>;
  /** Blocks in this section form a drag-to-nest hierarchy (nav menus) rather than a flat list. */
  nestableBlockTypes?: string[];
};

export type SectionBlock = {
  id: string;
  type: string;
  name: string;
  /** Nesting level for hierarchical blocks; 0 = top level. Absent means flat/top level. */
  depth?: number;
  settings: Record<string, unknown>;
};

export type SectionInstance = {
  id: string;
  schemaId: string;
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  blocks: SectionBlock[];
};

export type SectionGroups = {
  header: SectionInstance[];
  template: SectionInstance[];
  footer: SectionInstance[];
};

/** Which template-group sections apply to the page currently being rendered. */
export type TemplateSectionScope = {
  /** Whether this page's underlying template renders a customizable section list at all (e.g. search/404 pages usually don't). */
  supportsSections: boolean;
  /** Section schema ids this template ships with by default, in the theme's own order. */
  defaultSectionIds: string[];
};

/** Minimal stand-ins for apps/web's ThemeInstallationSummary/ThemeDraftSummary — only the fields schema-parser.ts/theme-renderer.ts actually read. */
export type ThemeDraftSummary = {
  manifest?: {
    id?: unknown;
    templateDefinitions?: unknown;
    sectionSchemas?: unknown;
    settingsSchema?: unknown;
  } | null;
  files?: Record<string, string>;
};

export type ThemeInstallationSummary = {
  name?: string | null;
  themePackage?: { name?: string | null } | null;
};
