/**
 * Vendored subset of apps/web/features/websites/customizer/state.ts — only
 * the pure section-storage helpers the live renderer needs (section-group
 * resolution + the schema-signature check that keeps stored content from
 * silently falling back to template defaults). Editor-only concerns
 * (drag/reorder, block nesting, the page switcher) are intentionally left
 * out. Keep this in sync by hand if the source file's storage shape changes.
 */
import type { SectionGroupKey, SectionGroups, SectionInstance, SectionSchema, ThemeDraftSummary, TemplateSectionScope } from "./types";

export function sectionGroupKey(schema: SectionSchema): SectionGroupKey {
  if (schema.category === "Header") return "header";
  if (schema.category === "Footer") return "footer";
  return "template";
}

export function groupSchemas(schemas: SectionSchema[], group: SectionGroupKey) {
  return schemas.filter((schema) => sectionGroupKey(schema) === group);
}

function groupStoragePath(group: SectionGroupKey, pageKey: string) {
  return group === "template" ? `customizer.pages.${pageKey}.sections` : `customizer.global.${group}.sections`;
}

function groupSignaturePath(group: SectionGroupKey, pageKey: string) {
  return group === "template" ? `customizer.pages.${pageKey}.schemaSignature` : `customizer.global.${group}.schemaSignature`;
}

export function getSectionSchemaSignature(schemas: SectionSchema[]) {
  return schemas
    .map((schema) => `${schema.id}:${schema.settings.map((setting) => setting.id).join(",")}:${(schema.blocks ?? []).map((block) => block.type).join(",")}`)
    .join("|");
}

const LEGACY_RENDERER_FALLBACKS: Array<{ key: string; value: unknown }> = [
  { key: "heading", value: "Latest resources" },
];

function createBlocks(schema: SectionSchema) {
  const blockSchema = schema.blocks?.[0];
  return (schema.defaultBlocks ?? []).map((block, index) => ({
    id: `${block.type}-default-${index}`,
    type: block.type,
    name: schema.blocks?.find((item) => item.type === block.type)?.name ?? blockSchema?.name ?? "Block",
    ...(block.depth ? { depth: block.depth } : {}),
    settings: block.settings,
  }));
}

function createSectionInstance(schema: SectionSchema, id?: string): SectionInstance {
  return {
    id: id ?? `${schema.id}-default`,
    schemaId: schema.id,
    name: schema.name,
    enabled: true,
    settings: Object.fromEntries(schema.settings.map((setting) => [setting.id, setting.default ?? ""])),
    blocks: createBlocks(schema),
  };
}

function hydrateSectionInstance(section: SectionInstance, schemas: SectionSchema[]): SectionInstance {
  const schema = schemas.find((item) => item.id === section.schemaId);
  if (!schema) return section;
  const defaults = Object.fromEntries(schema.settings.map((setting) => [setting.id, setting.default ?? ""]));
  const settings = { ...defaults, ...section.settings };
  for (const { key, value } of LEGACY_RENDERER_FALLBACKS) {
    if (settings[key] === value && defaults[key] !== undefined && defaults[key] !== value) {
      settings[key] = defaults[key];
    }
  }
  return {
    ...section,
    name: section.name || schema.name,
    settings,
    blocks: Array.isArray(section.blocks) ? section.blocks : createBlocks(schema),
  };
}

function isSectionInstance(value: unknown): value is SectionInstance {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { schemaId?: unknown }).schemaId === "string";
}

export function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function getGroupSections(
  settings: Record<string, unknown>,
  group: SectionGroupKey,
  pageKey: string,
  allSchemas: SectionSchema[],
  templateScope?: TemplateSectionScope,
): SectionInstance[] {
  const schemas = groupSchemas(allSchemas, group);
  const signature = getSectionSchemaSignature(schemas);
  const stored = getNestedValue(settings, groupStoragePath(group, pageKey));
  const storedSignature = getNestedValue(settings, groupSignaturePath(group, pageKey));
  const schemaIds = new Set(schemas.map((schema) => schema.id));
  if (storedSignature === signature && Array.isArray(stored) && stored.every(isSectionInstance) && stored.every((section) => schemaIds.has(section.schemaId))) {
    return stored.map((section) => hydrateSectionInstance(section, schemas));
  }
  // Fresh page: the Template group defaults to what this page's actual template ships with,
  // not every template-scoped section the theme happens to define.
  if (group === "template" && templateScope) {
    return templateScope.defaultSectionIds
      .map((id) => schemas.find((schema) => schema.id === id))
      .filter((schema): schema is SectionSchema => Boolean(schema))
      .map((schema) => createSectionInstance(schema, schema.id));
  }
  return schemas.map((schema) => createSectionInstance(schema, schema.id));
}

export function getAllGroupSections(
  settings: Record<string, unknown>,
  pageKey: string,
  schemas: SectionSchema[],
  templateScope?: TemplateSectionScope,
): SectionGroups {
  return {
    header: getGroupSections(settings, "header", pageKey, schemas),
    template: getGroupSections(settings, "template", pageKey, schemas, templateScope),
    footer: getGroupSections(settings, "footer", pageKey, schemas),
  };
}

/** Generic, file-based section scope: reads templates/{id}.tsx straight out of the theme's own uploaded files. */
export function getTemplateSectionScope(draft: ThemeDraftSummary | null, templateId: string): TemplateSectionScope {
  const source = draft?.files?.[`templates/${templateId}.tsx`];
  if (!source) return { supportsSections: true, defaultSectionIds: [] };
  const supportsSections = /RenderSections/.test(source);
  const defaultSectionIds: string[] = [];
  const seen = new Set<string>();
  for (const match of source.matchAll(/\btype:\s*["']([a-zA-Z0-9_-]+)["']/g)) {
    const id = match[1];
    if (id && !seen.has(id)) {
      seen.add(id);
      defaultSectionIds.push(id);
    }
  }
  return { supportsSections, defaultSectionIds };
}

export function isHomeTemplateId(id: string) {
  return id === "index" || id === "home";
}
