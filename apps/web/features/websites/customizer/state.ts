import type { PageSummary, ThemeDraftSummary } from "../types";
import { titleCase } from "./schema-parser";
import type {
  BlockSchema,
  CustomizerPageOption,
  SectionBlock,
  SectionGroupKey,
  SectionGroups,
  SectionInstance,
  SectionSchema,
  TemplateSectionScope,
  ThemeSetting,
} from "./types";

/** Which outline group a section belongs to — Header/Footer sections are shared across every page. */
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

/**
 * Includes block types, not just setting ids: changing a section's block
 * model (e.g. replacing nav_menu with nestable nav_link) has to invalidate
 * anything already stored, or old blocks of a type the schema no longer
 * defines would survive as unrenderable orphans.
 */
export function getSectionSchemaSignature(schemas: SectionSchema[]) {
  return schemas
    .map((schema) => `${schema.id}:${schema.settings.map((setting) => setting.id).join(",")}:${(schema.blocks ?? []).map((block) => block.type).join(",")}`)
    .join("|");
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

export function setGroupSections(
  settings: Record<string, unknown>,
  group: SectionGroupKey,
  pageKey: string,
  sections: SectionInstance[],
  allSchemas: SectionSchema[],
): Record<string, unknown> {
  const signature = getSectionSchemaSignature(groupSchemas(allSchemas, group));
  return setNestedValue(
    setNestedValue(settings, groupStoragePath(group, pageKey), sections),
    groupSignaturePath(group, pageKey),
    signature,
  );
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

/** Which theme template id a page falls back to when it isn't a direct template entry itself. */
export function resolvePageTemplateId(page: CustomizerPageOption | null): string {
  if (!page) return "index";
  if (page.source === "template") return page.id.replace(/^template-/, "");
  return page.slug === "home" || page.slug === "" ? "index" : "page";
}

/**
 * Generic, file-based counterpart to getAsterTemplateScope — reads
 * templates/{id}.tsx straight out of the uploaded theme so any theme (not
 * just Aster) gets a scoped default section list and an accurate read on
 * whether that template supports custom sections at all.
 */
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

export function findSectionGroup(groups: SectionGroups, sectionId: string): SectionGroupKey | null {
  if (groups.header.some((section) => section.id === sectionId)) return "header";
  if (groups.template.some((section) => section.id === sectionId)) return "template";
  if (groups.footer.some((section) => section.id === sectionId)) return "footer";
  return null;
}

/**
 * `id` defaults to a fresh random suffix (genuinely new instance — "add
 * section", "duplicate section"). Pass a stable id when generating a page's
 * not-yet-persisted default sections (see getGroupSections below): those get
 * regenerated on every call until the first edit persists them, so a random
 * id there would mismatch between the ids currently on screen and the ids a
 * subsequent updateGroup() re-derives internally, silently dropping the edit.
 */
export function createSectionInstance(schema: SectionSchema, id?: string): SectionInstance {
  return {
    id: id ?? `${schema.id}-${createId()}`,
    schemaId: schema.id,
    name: schema.name,
    enabled: true,
    settings: Object.fromEntries(schema.settings.map((setting) => [setting.id, setting.default ?? ""])),
    blocks: createBlocks(schema),
  };
}

export function hydrateSectionInstance(section: SectionInstance, schemas: SectionSchema[]): SectionInstance {
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

export function insertSectionAfter(sections: SectionInstance[], section: SectionInstance, afterSectionId?: string) {
  if (afterSectionId === "__start") return [section, ...sections];
  if (!afterSectionId) return [...sections, section];
  const index = sections.findIndex((item) => item.id === afterSectionId);
  if (index < 0) return [...sections, section];
  const next = [...sections];
  next.splice(index + 1, 0, section);
  return next;
}

export function duplicateSectionInstance(section: SectionInstance): SectionInstance {
  return {
    ...structuredClone(section),
    id: `${section.schemaId}-${createId()}`,
    name: `${section.name} copy`,
    blocks: section.blocks.map(duplicateBlock),
  };
}

/**
 * Deterministic (index-based, not random) ids: this seeds a not-yet-persisted
 * section's default blocks, and — same reasoning as createSectionInstance
 * above — those get regenerated on every call until the first edit persists
 * them, so random ids here would mismatch between what's on screen and what
 * a subsequent updateGroup() re-derives internally, dropping the edit.
 */
export function createBlocks(schema: SectionSchema) {
  const blockSchema = schema.blocks?.[0];
  return (schema.defaultBlocks ?? []).map((block, index) => ({
    id: `${block.type}-default-${index}`,
    type: block.type,
    name: schema.blocks?.find((item) => item.type === block.type)?.name ?? blockSchema?.name ?? "Block",
    ...(block.depth ? { depth: block.depth } : {}),
    settings: block.settings,
  }));
}

export function createBlock(schema: BlockSchema): SectionBlock {
  return { id: `${schema.type}-${createId()}`, type: schema.type, name: schema.name, settings: Object.fromEntries(schema.settings.map((setting) => [setting.id, setting.default ?? ""])) };
}

/** Deepest allowed nav nesting: 0/1/2 == three visible menu levels. */
export const MAX_BLOCK_DEPTH = 2;

export function isNestableBlock(schema: SectionSchema | undefined, block: SectionBlock | undefined) {
  if (!schema || !block) return false;
  return (schema.nestableBlockTypes ?? []).includes(block.type);
}

/**
 * Keeps a drag-to-nest list structurally valid: the first item is always top
 * level, and no item may sit more than one level deeper than the item above
 * it (which would create a hole in the hierarchy with no parent to attach
 * to). Non-nestable blocks are pinned flat. Applied after every move so a
 * drop can never persist an impossible tree.
 */
export function normalizeBlockDepths(blocks: SectionBlock[], schema: SectionSchema | undefined): SectionBlock[] {
  let previousDepth = -1;
  return blocks.map((block) => {
    if (!isNestableBlock(schema, block)) {
      previousDepth = 0;
      return block.depth ? { ...block, depth: 0 } : block;
    }
    const requested = Math.max(0, Math.min(block.depth ?? 0, MAX_BLOCK_DEPTH));
    const depth = Math.min(requested, previousDepth + 1);
    previousDepth = depth;
    return depth === (block.depth ?? 0) ? block : { ...block, depth };
  });
}

/** Moves a block and (optionally) re-parents it to a new nesting depth, carrying its own subtree along. */
export function moveBlockWithDepth(
  blocks: SectionBlock[],
  from: number,
  to: number,
  depth: number | undefined,
  schema: SectionSchema | undefined,
): SectionBlock[] {
  const moving = blocks[from];
  if (!moving) return blocks;

  // A nested block owns everything indented below it — dragging a parent must
  // take its children with it, or they would silently re-parent to whatever
  // ends up above them.
  const movingDepth = moving.depth ?? 0;
  let subtreeEnd = from + 1;
  if (isNestableBlock(schema, moving)) {
    while (subtreeEnd < blocks.length && isNestableBlock(schema, blocks[subtreeEnd]) && (blocks[subtreeEnd]?.depth ?? 0) > movingDepth) {
      subtreeEnd += 1;
    }
  }

  const subtree = blocks.slice(from, subtreeEnd);
  const rest = [...blocks.slice(0, from), ...blocks.slice(subtreeEnd)];
  const insertAt = to > from ? Math.max(0, to - subtree.length + 1) : to;
  const shift = depth === undefined ? 0 : depth - movingDepth;
  const shifted = shift === 0 ? subtree : subtree.map((block) => ({ ...block, depth: Math.max(0, (block.depth ?? 0) + shift) }));

  return normalizeBlockDepths([...rest.slice(0, insertAt), ...shifted, ...rest.slice(insertAt)], schema);
}

export function duplicateBlock(block: SectionBlock): SectionBlock {
  return { ...structuredClone(block), id: `${block.type}-${createId()}` };
}

export function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function insertItem<T>(items: T[], index: number, item: T) {
  const next = [...items];
  next.splice(index, 0, item);
  return next;
}

export function createId() {
  return Math.random().toString(36).slice(2, 9);
}

function isSectionInstance(value: unknown): value is SectionInstance {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { schemaId?: unknown }).schemaId === "string";
}

export function groupSettings(schema: ThemeSetting[]) {
  const groups = schema.reduce<Record<string, ThemeSetting[]>>((accumulator, control) => {
    const group = control.group || "Settings";
    accumulator[group] = [...(accumulator[group] ?? []), control];
    return accumulator;
  }, {});
  return Object.entries(groups);
}

export function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function setNestedValue(source: Record<string, unknown>, path: string, value: unknown) {
  const clone: Record<string, unknown> = structuredClone(source);
  const parts = path.split(".");
  let cursor = clone;
  parts.slice(0, -1).forEach((part) => {
    const next = cursor[part];
    if (typeof next !== "object" || next === null || Array.isArray(next)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  });
  cursor[parts[parts.length - 1] ?? path] = value;
  return clone;
}

type TemplateDefinition = { id: string; name: string };

/**
 * The page switcher shows every real CMS page PLUS one entry per template the
 * theme defines (search, 404, generic "page", ...) so templates that don't
 * have matching content yet can still be opened and customized — mirrors how
 * Shopify's editor always lists all of a theme's template types.
 */
export function getCustomizerPageOptions(pages: PageSummary[], draft: ThemeDraftSummary | null): CustomizerPageOption[] {
  const pageEntries: CustomizerPageOption[] = pages
    .slice()
    .sort((first, second) => {
      if (first.slug === "home") return -1;
      if (second.slug === "home") return 1;
      return first.title.localeCompare(second.title);
    })
    .map((page) => ({ id: page.id, label: page.title, slug: page.slug, status: page.status, source: "page" }));

  const hasHomePage = pageEntries.some((page) => page.slug === "home" || page.slug === "");
  const templateEntries: CustomizerPageOption[] = getTemplateDefinitions(draft)
    .filter((template) => !(isHomeTemplateId(template.id) && hasHomePage))
    .map((template) => ({
      id: `template-${template.id}`,
      label: isHomeTemplateId(template.id) ? "Home page" : `${template.name} template`,
      slug: isHomeTemplateId(template.id) ? "" : template.id,
      status: "THEME",
      source: "template",
    }));

  const combined = [...pageEntries, ...templateEntries];
  return combined.length ? combined : [{ id: "template-home", label: "Home page", slug: "", status: "THEME", source: "template" }];
}

function isHomeTemplateId(id: string) {
  return id === "index" || id === "home";
}

function getTemplateDefinitions(draft: ThemeDraftSummary | null): TemplateDefinition[] {
  const fromManifest = draft?.manifest?.templateDefinitions;
  if (Array.isArray(fromManifest)) {
    const parsed = fromManifest.filter(isTemplateDefinition);
    if (parsed.length) return parsed;
  }
  return parseTemplatesFromConfigSource(draft?.files?.["theme.config.ts"]);
}

function isTemplateDefinition(value: unknown): value is TemplateDefinition {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { name?: unknown }).name === "string";
}

function parseTemplatesFromConfigSource(source: string | undefined): TemplateDefinition[] {
  if (!source) return [];
  const block = source.match(/templates:\s*\{([\s\S]*?)\}\s*,/)?.[1] ?? "";
  return [...block.matchAll(/["']?([A-Za-z0-9_-]+)["']?\s*:\s*["']([^"']+)["']/g)].map((match) => {
    const id = match[1] ?? "";
    return { id, name: isHomeTemplateId(id) ? "Home" : titleCase(id) };
  });
}

const LEGACY_RENDERER_FALLBACKS = [
  { key: "heading", value: "Latest resources" },
  { key: "heading", value: "Ready to launch?" },
  { key: "heading", value: "Everything teams need" },
  { key: "buttonText", value: "Publish now" },
];
