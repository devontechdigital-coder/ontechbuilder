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

export type CustomizerPageOption = {
  id: string;
  label: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "THEME";
  source: "page" | "template";
};

export type Viewport = "desktop" | "tablet" | "mobile";

/** The single item currently shown in the split inspector pane. */
export type SelectedItem =
  | { kind: "theme" }
  | { kind: "section"; sectionId: string }
  | { kind: "block"; sectionId: string; blockId: string };

export type SectionGroups = {
  header: SectionInstance[];
  template: SectionInstance[];
  footer: SectionInstance[];
};

/** Which template-group sections apply to the page currently being edited. */
export type TemplateSectionScope = {
  /** Whether this page's underlying template renders a customizable section list at all (e.g. search/404 pages usually don't). */
  supportsSections: boolean;
  /** Section schema ids this template ships with by default, in the theme's own order. */
  defaultSectionIds: string[];
};
