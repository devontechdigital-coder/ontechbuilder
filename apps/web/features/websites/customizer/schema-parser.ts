import type { ThemeDraftSummary, ThemeInstallationSummary } from "../types";
import type { BlockSchema, SectionSchema, SelectOption, TemplateSectionScope, ThemeSetting } from "./types";

export function isAsterTheme(theme: ThemeInstallationSummary | null, draft: ThemeDraftSummary | null) {
  const haystack = `${theme?.name ?? ""} ${theme?.themePackage?.name ?? ""} ${String(draft?.manifest?.id ?? "")}`.toLowerCase();
  return haystack.includes("aster");
}

/**
 * Aster's own templates/*.tsx (see aster-theme-zip) mirror this exactly:
 * index.tsx ships a full default section list, page.tsx starts empty but
 * still supports the section system, and search.tsx/404.tsx are fully
 * hardcoded with no section system at all.
 */
const ASTER_TEMPLATE_SCOPES: Record<string, TemplateSectionScope> = {
  index: { supportsSections: true, defaultSectionIds: ["hero", "service-highlights", "benefits-grid", "process-steps", "testimonials", "image-cta"] },
  page: { supportsSections: true, defaultSectionIds: [] },
  search: { supportsSections: false, defaultSectionIds: [] },
  "404": { supportsSections: false, defaultSectionIds: [] },
};

export function getAsterTemplateScope(templateId: string): TemplateSectionScope {
  return ASTER_TEMPLATE_SCOPES[templateId] ?? { supportsSections: true, defaultSectionIds: [] };
}

export function isCoporaTheme(theme: ThemeInstallationSummary | null, draft: ThemeDraftSummary | null) {
  const haystack = `${theme?.name ?? ""} ${theme?.themePackage?.name ?? ""} ${String(draft?.manifest?.id ?? "")}`.toLowerCase();
  return haystack.includes("copora");
}

const COPORA_TEMPLATE_SCOPES: Record<string, TemplateSectionScope> = {
  index: {
    supportsSections: true,
    defaultSectionIds: [
      "hero",
      "logo-cloud",
      "service-cards",
      "stats-row",
      "split-content",
      "process-dark",
      "featured-case-study",
      "case-study-list",
      "testimonial-showcase",
      "blog-grid",
      "cta-banner",
    ],
  },
  about: { supportsSections: true, defaultSectionIds: ["page-intro", "stats-row", "split-content", "mission-vision", "team-grid", "cta-banner"] },
  "case-studies": { supportsSections: true, defaultSectionIds: ["case-study-grid"] },
  blog: { supportsSections: true, defaultSectionIds: ["page-intro", "blog-grid"] },
  contact: { supportsSections: true, defaultSectionIds: ["contact-form", "location-card", "cta-banner"] },
  page: { supportsSections: true, defaultSectionIds: [] },
  search: { supportsSections: false, defaultSectionIds: [] },
  "404": { supportsSections: false, defaultSectionIds: [] },
};

export function getCoporaTemplateScope(templateId: string): TemplateSectionScope {
  return COPORA_TEMPLATE_SCOPES[templateId] ?? { supportsSections: true, defaultSectionIds: [] };
}

export function getDraftSettingsSchema(draft: ThemeDraftSummary | null) {
  const schema = draft?.manifest?.settingsSchema;
  return Array.isArray(schema) ? schema.filter(isThemeSettingDefinition) : [];
}

const GLOBAL_SETTINGS_PATH = "config/settings.schema.ts";

export function getFileSettingsSchema(draft: ThemeDraftSummary | null) {
  const source = draft?.files?.[GLOBAL_SETTINGS_PATH];
  const files = draft?.files;
  if (!source || !files) return [];
  return parseThemeSettings(getGlobalSettingsSource(source), { files, path: GLOBAL_SETTINGS_PATH });
}

/**
 * Scopes parsing to just the `groups: [...]` array of the file's exported settings-schema object.
 * This file commonly also exports shared option constants and per-section helper functions (e.g. a
 * `baseSectionSettings()` composed into individual sections' own schemas) for section schema.ts files
 * to import — scanning the whole file would misread those as additional global settings, sometimes
 * colliding in `id` with an unrelated field actually declared inside `groups`.
 */
function getGlobalSettingsSource(source: string): string {
  const match = source.match(/groups:\s*\[/);
  if (!match || match.index === undefined) return source;
  const bracketStart = match.index + match[0].length - 1;
  const bracketEnd = findMatchingBracket(source, bracketStart, "[", "]");
  return source.slice(bracketStart, bracketEnd + 1);
}

/**
 * Some themes put header/footer schemas under their own `partials/` directory rather than
 * `sections/` (with `components/sectionRegistry.tsx` split into a separate `partialRegistry.tsx`
 * too — see resolveThemeEngineRegistries in theme-engine/build-bundle.ts for the render side of
 * this). A theme offering multiple header/footer designs (e.g. per-vertical variants) also names
 * each variant's schema file after the component (`HeaderDentora.schema.ts`) instead of the plain
 * `schema.ts` a section with only one design uses — both conventions are schema files, so both match.
 */
function isSectionSchemaPath(path: string): boolean {
  if (!path.startsWith("sections/") && !path.startsWith("partials/")) return false;
  const basename = path.split("/").pop() ?? "";
  return basename === "schema.ts" || basename.endsWith(".schema.ts");
}

export function getFileSectionSchemas(draft: ThemeDraftSummary | null): SectionSchema[] {
  const files = draft?.files ?? {};
  const sectionEntries = Object.entries(files)
    .filter(([path]) => isSectionSchemaPath(path))
    .map(([path, source]) => parseSectionSchemaFile(path, source, files));
  return sortSectionsByThemeTemplate(sortSectionsByThemeConfig(sectionEntries, files["theme.config.ts"]), files["templates/index.tsx"]);
}

export function getDraftSectionSchemas(draft: ThemeDraftSummary | null): SectionSchema[] {
  const schemas = draft?.manifest?.sectionSchemas;
  if (!Array.isArray(schemas)) return [];
  return schemas
    .filter((schema): schema is SectionSchema => {
      return (
        typeof schema === "object" &&
        schema !== null &&
        typeof (schema as { id?: unknown }).id === "string" &&
        typeof (schema as { name?: unknown }).name === "string" &&
        Array.isArray((schema as { settings?: unknown }).settings)
      );
    })
    .map((schema) => ({ ...schema, category: schema.category ?? "Sections", blocks: schema.blocks ?? [] }));
}

function parseSectionSchemaFile(path: string, source: string, files: Record<string, string>): SectionSchema {
  const folderName = path.split("/")[1] ?? "section";
  const rootSource = getRootSectionSource(source);
  const id = matchStringProperty(rootSource, "id") ?? matchStringProperty(rootSource, "type") ?? kebabCase(folderName);
  const settingsBlock = getArrayBlock(source, "settings");
  const blocksBlock = getArrayBlock(source, "blocks");
  const maxBlocks = matchNumberProperty(source, "maxBlocks");
  const defaultBlocks = parseDefaultBlocks(source);
  const ctx: ResolveContext = { files, path };
  return {
    id,
    name: matchStringProperty(rootSource, "name") ?? titleCase(id),
    category: matchStringProperty(rootSource, "category") ?? "Sections",
    settings: parseThemeSettings(settingsBlock, ctx),
    blocks: parseThemeBlocks(blocksBlock, ctx),
    ...(maxBlocks !== undefined ? { maxBlocks } : {}),
    ...(defaultBlocks.length ? { defaultBlocks } : {}),
  };
}

function getRootSectionSource(source: string) {
  const settingsIndex = source.indexOf("settings:");
  const blocksIndex = source.indexOf("blocks:");
  const cutPoints = [settingsIndex, blocksIndex].filter((index) => index >= 0);
  return cutPoints.length ? source.slice(0, Math.min(...cutPoints)) : source;
}

/** Lets option lists reference a constant/helper defined elsewhere in the theme (see resolveOptionsIdentifier below). */
export type ResolveContext = { files: Record<string, string>; path: string };

export function parseThemeSettings(source: string | undefined, ctx?: ResolveContext): ThemeSetting[] {
  if (!source) return [];
  const direct = getObjectLiterals(source)
    // A helper like `function baseSectionSettings() { return [ {id:"tone",...}, {id:"containerWidth",...} ] }`
    // is itself one big `{...}` chunk whose first nested field happens to satisfy the id/type/label
    // check below, so it would otherwise be picked up as a duplicate of that field's own chunk.
    .filter((chunk) => !/^\{\s*return\b/.test(chunk))
    .filter((chunk) => !chunk.includes("settings:") && matchStringProperty(chunk, "id") && matchStringProperty(chunk, "type") && matchStringProperty(chunk, "label"))
    .map((chunk) => {
      const setting: ThemeSetting = {
        id: matchStringProperty(chunk, "id") ?? "",
        type: normalizeSettingType(matchStringProperty(chunk, "type") ?? "text"),
        label: matchStringProperty(chunk, "label") ?? "Setting",
        group: inferGroupNearSetting(source, chunk) ?? "Settings",
      };
      const defaultValue = matchDefaultProperty(chunk);
      const min = matchNumberProperty(chunk, "min");
      const max = matchNumberProperty(chunk, "max");
      const step = matchNumberProperty(chunk, "step");
      const unit = matchStringProperty(chunk, "unit");
      const placeholder = matchStringProperty(chunk, "placeholder");
      const info = matchStringProperty(chunk, "info");
      const options = parseSettingOptions(chunk, ctx);
      if (defaultValue !== undefined) setting.default = defaultValue;
      if (min !== undefined) setting.min = min;
      if (max !== undefined) setting.max = max;
      if (step !== undefined) setting.step = step;
      if (unit) setting.unit = unit;
      if (placeholder) setting.placeholder = placeholder;
      if (info) setting.info = info;
      if (options.length) setting.options = options;
      return setting;
    });
  if (!ctx) return direct;
  // `...baseSectionSettings()` — a spread of a shared helper's return value — carries no literal
  // `{...}` for the scan above to find, so most real-world sections (this theme spreads it into 29
  // of its 35) would otherwise show none of their Style/Spacing/Advanced fields at all. Explicit
  // fields win on an id collision (rare, but a section could deliberately override one).
  const spread = resolveSpreadSettings(source, ctx);
  const seenIds = new Set(direct.map((setting) => setting.id));
  return [...direct, ...spread.filter((setting) => !seenIds.has(setting.id))];
}

function resolveSpreadSettings(source: string, ctx: ResolveContext): ThemeSetting[] {
  const results: ThemeSetting[] = [];
  for (const match of source.matchAll(/\.\.\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const identifier = match[1];
    if (!identifier) continue;
    const block = findExportedFunctionArrayBlock(identifier, ctx.path, ctx.files);
    if (block) results.push(...parseThemeSettings(block, ctx));
  }
  return results;
}

function parseThemeBlocks(source: string | undefined, ctx?: ResolveContext): BlockSchema[] {
  if (!source) return [];
  return getObjectLiterals(source)
    .filter((chunk) => matchStringProperty(chunk, "type") && matchStringProperty(chunk, "name") && chunk.includes("settings"))
    .map((chunk) => ({
      type: matchStringProperty(chunk, "type") ?? "block",
      name: matchStringProperty(chunk, "name") ?? "Block",
      settings: parseThemeSettings(getArrayBlock(chunk, "settings"), ctx).map((setting) => ({ ...setting, group: "Block" })),
    }));
}

function sortSectionsByThemeConfig(sections: SectionSchema[], config: string | undefined) {
  const order = parseThemeSectionOrder(config);
  if (!order.length) return sections;
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...sections].sort((first, second) => (orderMap.get(first.id) ?? 999) - (orderMap.get(second.id) ?? 999));
}

function sortSectionsByThemeTemplate(sections: SectionSchema[], template: string | undefined) {
  const order = parseTemplateSectionOrder(template, sections);
  if (!order.length) return sections;
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...sections].sort((first, second) => (orderMap.get(first.id) ?? 999) - (orderMap.get(second.id) ?? 999));
}

function parseThemeSectionOrder(source: string | undefined) {
  if (!source) return [];
  const block = source.match(/sections:\s*\{([\s\S]*?)\}\s*,/)?.[1] ?? "";
  return [...block.matchAll(/["']?([A-Za-z0-9_-]+)["']?\s*:/g)].map((match) => match[1] ?? "");
}

function parseTemplateSectionOrder(source: string | undefined, sections: SectionSchema[]) {
  if (!source) return [];
  return sections
    .map((section) => ({
      id: section.id,
      index: source.indexOf(componentName(section.name)),
    }))
    .filter((item) => item.index >= 0)
    .sort((first, second) => first.index - second.index)
    .map((item) => item.id);
}

function parseDefaultBlocks(source: string): Array<{ type: string; settings: Record<string, unknown> }> {
  const block = getArrayBlock(source, "defaultBlocks");
  if (!block) return [];
  // getObjectLiterals also walks into each entry's own nested `settings: {...}` object, surfacing it as
  // its own chunk. Real entries always pair a `type` with a `settings` object, so filtering on both keeps
  // only the outer `{ type, settings }` entries and drops those nested duplicates.
  return getObjectLiterals(block)
    .filter((chunk) => matchStringProperty(chunk, "type") && chunk.includes("settings:"))
    .map((chunk) => ({
      type: matchStringProperty(chunk, "type") ?? "block",
      settings: parseSettingsObject(getObjectBlock(chunk, "settings")),
    }));
}

function parseSettingsObject(source: string | undefined) {
  if (!source) return {};
  return Object.fromEntries(
    [...source.matchAll(/([A-Za-z0-9_]+):\s*(true|false|[0-9.]+|["']([\s\S]*?)["'])/g)].map((match) => {
      const value = match[2] ?? "";
      if (value === "true") return [match[1] ?? "", true];
      if (value === "false") return [match[1] ?? "", false];
      if (/^[0-9.]+$/.test(value)) return [match[1] ?? "", Number(value)];
      return [match[1] ?? "", value.replace(/^["']|["']$/g, "")];
    }),
  );
}

function getArrayBlock(source: string, key: string) {
  const keyIndex = source.indexOf(`${key}:`);
  if (keyIndex < 0) return undefined;
  const start = source.indexOf("[", keyIndex);
  if (start < 0) return undefined;
  const end = findMatchingBracket(source, start, "[", "]");
  return source.slice(start + 1, end);
}

function getObjectBlock(source: string, key: string) {
  const keyIndex = source.indexOf(`${key}:`);
  if (keyIndex < 0) return undefined;
  const start = source.indexOf("{", keyIndex);
  if (start < 0) return undefined;
  const end = findMatchingBracket(source, start, "{", "}");
  return source.slice(start + 1, end);
}

/** Only the outermost `{...}` objects — nested ones (e.g. a block's `settings: {...}`) are part of their parent chunk, not separate entries. */
function getObjectLiterals(source: string) {
  const chunks: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{") continue;
    const end = findMatchingBracket(source, index, "{", "}");
    if (end > index) {
      chunks.push(source.slice(index, end + 1));
    }
  }
  return chunks;
}

function findMatchingBracket(source: string, start: number, open: string, close: string) {
  let depth = 0;
  let quote: string | null = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }
    // Apostrophes in ordinary prose ("editor's", "doesn't") inside // and /* */
    // comments would otherwise be misread as opening a string literal, which
    // desyncs quote-tracking for the rest of the source. Comments carry no
    // brackets that matter to the caller, so skip them outright.
    if (char === "/" && next === "/") {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd;
      continue;
    }
    if (char === "/" && next === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 1;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return index;
  }
  return source.length - 1;
}

/**
 * Reads one quoted string starting exactly at `start` (which must be a quote char), stopping at
 * the first *unescaped instance of that same quote character* rather than either quote type. A
 * naive `["'](...)["']` pattern truncates the instant a double-quoted string contains an embedded
 * apostrophe — exactly what CSS font stacks like `"'Outfit', system-ui, sans-serif"` and ordinary
 * prose like `"company's full potential"` do throughout a real theme's schema.ts files.
 */
function matchQuotedValue(source: string, start: number): string | undefined {
  const quote = source[start];
  if (quote !== "\"" && quote !== "'" && quote !== "`") return undefined;
  let result = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      result += source[index + 1];
      index += 1;
      continue;
    }
    if (char === quote) return result;
    result += char;
  }
  return undefined;
}

function matchStringProperty(source: string, key: string) {
  const keyMatch = source.match(new RegExp(`${key}:\\s*`));
  if (!keyMatch || keyMatch.index === undefined) return undefined;
  return matchQuotedValue(source, keyMatch.index + keyMatch[0].length);
}

function matchNumberProperty(source: string, key: string) {
  const value = source.match(new RegExp(`${key}:\\s*([0-9.]+)`))?.[1];
  return value === undefined ? undefined : Number(value);
}

function matchDefaultProperty(source: string) {
  const keyMatch = source.match(/default:\s*/);
  if (!keyMatch || keyMatch.index === undefined) return undefined;
  const start = keyMatch.index + keyMatch[0].length;
  const rest = source.slice(start);
  if (/^true\b/.test(rest)) return true;
  if (/^false\b/.test(rest)) return false;
  const numberMatch = rest.match(/^[0-9.]+/);
  if (numberMatch) return Number(numberMatch[0]);
  return matchQuotedValue(source, start);
}

/**
 * `options:` in a real theme's schema.ts is as often a reference as a literal array — a shared
 * constant imported from elsewhere (`options: aspectOptions`), or a call to a small helper that
 * builds the list (`options: variantOptions([...])`, the convention this theme's five-design-per-
 * section system runs on — see config/settings.schema.ts). Grabbing the first "[" after "options:"
 * (the old behavior) either finds nothing for the former, or for the latter finds the raw label
 * array and treats each label AS the stored value, so every design picker offers the right labels
 * with the wrong underlying values (the real components only recognise "v1".."v5") — selecting a
 * different design then silently does nothing. Both are handled explicitly below before falling
 * back to that literal-array behavior for whatever this doesn't recognize.
 */
function parseSettingOptions(chunk: string, ctx?: ResolveContext): SelectOption[] {
  const keyMatch = chunk.match(/options:\s*/);
  if (!keyMatch || keyMatch.index === undefined) return [];
  const valueStart = keyMatch.index + keyMatch[0].length;

  const variantCall = chunk.slice(valueStart).match(/^variantOptions\s*\(/);
  if (variantCall) {
    const parenStart = valueStart + variantCall[0].length - 1;
    const parenEnd = findMatchingBracket(chunk, parenStart, "(", ")");
    const labels = [...chunk.slice(parenStart, parenEnd + 1).matchAll(/["']([^"']+)["']/g)].map((match) => match[1] ?? "");
    return labels.map((label, index) => ({ value: `v${index + 1}`, label: `${index + 1} — ${label}` }));
  }

  const bareIdentifier = chunk.slice(valueStart).match(/^([A-Za-z_$][\w$]*)\s*[,}\n]/);
  if (bareIdentifier?.[1] && ctx) {
    const resolved = resolveOptionsIdentifier(bareIdentifier[1], ctx.path, ctx.files);
    if (resolved.length) return resolved;
  }

  const block = getArrayBlock(chunk, "options");
  if (!block) return [];
  return parseOptionsArrayBlock(block);
}

function parseOptionsArrayBlock(block: string): SelectOption[] {
  const objectOptions = getObjectLiterals(block)
    .map((chunk) => {
      const value = matchStringProperty(chunk, "value");
      const label = matchStringProperty(chunk, "label");
      return value !== undefined && label !== undefined ? { value, label } : undefined;
    })
    .filter((option): option is { value: string; label: string } => Boolean(option));
  if (objectOptions.length) return objectOptions;
  return [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1] ?? "");
}

/** Resolves `./relative` import specifiers against the importing file's own path, the same way a bundler would. */
function resolveRelativeImportPath(fromPath: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const fromDir = fromPath.split("/").slice(0, -1).join("/");
  const joined = fromDir ? `${fromDir}/${spec}` : spec;
  const stack: string[] = [];
  for (const part of joined.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function resolveFilePath(base: string, files: Record<string, string>): string | undefined {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (files[candidate] !== undefined) return candidate;
  }
  return undefined;
}

/**
 * Finds `identifier`'s own exported array literal, following one level of "this constant is just
 * a shared source re-projected" indirection (`export const fontSelectOptions = FONT_OPTIONS.map(...)`)
 * and one level of cross-file import, so a shared options constant defined in a different file than
 * the section/setting that references it still resolves. Depth-limited against import cycles.
 */
/** If `identifier` isn't defined in `source`'s own file, follows that file's own import of it to the file that does. */
function followIdentifierImport(identifier: string, path: string, files: Record<string, string>): string | undefined {
  const source = files[path];
  if (!source) return undefined;
  const importMatch = source.match(new RegExp(`import\\s*\\{([^}]*\\b${identifier}\\b[^}]*)\\}\\s*from\\s*["']([^"']+)["']`));
  const importedFrom = importMatch?.[2];
  if (!importedFrom) return undefined;
  const resolvedBase = resolveRelativeImportPath(path, importedFrom);
  return resolvedBase ? resolveFilePath(resolvedBase, files) : undefined;
}

function findExportedArrayBlock(identifier: string, path: string, files: Record<string, string>, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  const source = files[path];
  if (!source) return undefined;

  // "export" is optional: a constant only ever used within the file that defines it (e.g. a local
  // headingFontOptions/bodyFontOptions helper) has no reason to be exported at all.
  const directMatch = source.match(new RegExp(`(?:export\\s+)?const\\s+${identifier}\\b[^=]*=\\s*\\[`));
  if (directMatch?.index !== undefined) {
    const bracketStart = directMatch.index + directMatch[0].length - 1;
    const end = findMatchingBracket(source, bracketStart, "[", "]");
    return source.slice(bracketStart + 1, end);
  }

  const mapMatch = source.match(new RegExp(`(?:export\\s+)?const\\s+${identifier}\\b[^=]*=\\s*([A-Za-z_$][\\w$]*)\\s*\\.map\\s*\\(`));
  if (mapMatch?.[1]) return findExportedArrayBlock(mapMatch[1], path, files, depth + 1);

  const importedPath = followIdentifierImport(identifier, path, files);
  return importedPath ? findExportedArrayBlock(identifier, importedPath, files, depth + 1) : undefined;
}

/**
 * Resolves `...baseSectionSettings()`-style spreads: a helper function (not a plain constant)
 * that `return`s an array of setting fields. Mirrors findExportedArrayBlock's const/import
 * resolution, but reads the function body's `return [...]` instead of a `= [...]` initializer.
 */
function findExportedFunctionArrayBlock(identifier: string, path: string, files: Record<string, string>, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  const source = files[path];
  if (!source) return undefined;

  const fnMatch = source.match(new RegExp(`(?:export\\s+)?function\\s+${identifier}\\s*\\([^)]*\\)[^{]*\\{`));
  if (fnMatch?.index !== undefined) {
    const bodyStart = fnMatch.index + fnMatch[0].length - 1;
    const bodyEnd = findMatchingBracket(source, bodyStart, "{", "}");
    const body = source.slice(bodyStart, bodyEnd + 1);
    const returnMatch = body.match(/return\s*\[/);
    if (returnMatch?.index !== undefined) {
      const bracketStart = returnMatch.index + returnMatch[0].length - 1;
      const bracketEnd = findMatchingBracket(body, bracketStart, "[", "]");
      return body.slice(bracketStart + 1, bracketEnd);
    }
  }

  const importedPath = followIdentifierImport(identifier, path, files);
  return importedPath ? findExportedFunctionArrayBlock(identifier, importedPath, files, depth + 1) : undefined;
}

function resolveOptionsIdentifier(identifier: string, path: string, files: Record<string, string>): SelectOption[] {
  const block = findExportedArrayBlock(identifier, path, files);
  return block ? parseOptionsArrayBlock(block) : [];
}

function inferGroupNearSetting(source: string, chunk: string) {
  const index = source.indexOf(chunk);
  if (index < 0) return undefined;
  const before = source.slice(0, index);
  // Unanchored, this previously matched the FIRST "header:" in the whole file every time (a
  // regex match isn't required to start at the end of the string), so every setting landed in
  // whichever group happened to come first. Take the last (nearest-preceding) header instead.
  const headers = [...before.matchAll(/header:\s*["']([^"']+)["']/g)];
  return headers.length ? headers[headers.length - 1]?.[1] : undefined;
}

function normalizeSettingType(type: string) {
  return type === "checkbox" ? "boolean" : type;
}

function kebabCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

export function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function componentName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function isThemeSettingDefinition(value: unknown): value is ThemeSetting {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { type?: unknown }).type === "string" &&
    typeof (value as { label?: unknown }).label === "string"
  );
}

const option = (value: string, label: string) => ({ value, label });
const field = (group: string, setting: Omit<ThemeSetting, "group">): ThemeSetting => ({ group, ...setting });

export const ASTER_GLOBAL_SETTINGS: ThemeSetting[] = [
  field("Global", { type: "color", id: "colorPrimary", label: "Primary color", default: "#C89B3C" }),
  field("Global", { type: "color", id: "colorSecondary", label: "Secondary color", default: "#8FA396" }),
  field("Global", { type: "color", id: "colorBackground", label: "Background color", default: "#F6F1E7" }),
  field("Global", { type: "color", id: "colorSurface", label: "Surface color", default: "#FFFFFF" }),
  field("Global", { type: "color", id: "colorDark", label: "Dark section color", default: "#1F2C27" }),
  field("Global", { type: "color", id: "colorText", label: "Text color", default: "#1F2C27" }),
  field("Global", {
    type: "select",
    id: "containerWidth",
    label: "Container width",
    options: [option("narrow", "Narrow"), option("default", "Default"), option("wide", "Wide"), option("full", "Full width")],
    default: "default",
  }),
  field("Global", { type: "range", id: "sectionSpacing", label: "Section spacing", min: 32, max: 160, step: 8, unit: "px", default: 96 }),
  field("Typography", { type: "font", id: "headingFont", label: "Heading font", default: "'Playfair Display', Georgia, serif" }),
  field("Typography", { type: "font", id: "bodyFont", label: "Body font", default: "'Inter', sans-serif" }),
  field("Buttons", { type: "select", id: "buttonStyle", label: "Button style", options: [option("solid", "Solid"), option("outline", "Outline")], default: "solid" }),
  field("Buttons", { type: "range", id: "buttonRadius", label: "Button radius", min: 0, max: 40, step: 2, unit: "px", default: 999 }),
  field("Floating actions", { type: "checkbox", id: "showCallButton", label: "Show floating Call Now button", default: true }),
  field("Floating actions", { type: "text", id: "phoneNumber", label: "Phone number", default: "+91 9319524258" }),
];

export const ASTER_SECTIONS: SectionSchema[] = [
  {
    id: "announcement-bar",
    name: "Announcement bar",
    category: "Header",
    settings: [
      field("Behavior", { type: "checkbox", id: "dismissible", label: "Allow visitors to dismiss", default: true }),
      field("Behavior", { type: "range", id: "autoRotateSeconds", label: "Rotate every", min: 0, max: 15, step: 1, unit: "s", default: 5 }),
    ],
    blocks: [{ type: "message", name: "Message", settings: [field("Content", { type: "text", id: "text", label: "Message text", default: "Complete Clinic Setup - Design, Equipment, Licensing & Support" })] }],
    maxBlocks: 5,
    defaultBlocks: [{ type: "message", settings: { text: "Complete Clinic Setup - Design, Equipment, Licensing & Support" } }],
  },
  {
    id: "header",
    name: "Header",
    category: "Header",
    settings: [
      field("Brand", { type: "image", id: "logoImage", label: "Logo image" }),
      field("Brand", { type: "text", id: "logoText", label: "Wordmark text", default: "DermaSetup" }),
      field("Behavior", { type: "checkbox", id: "showSearch", label: "Show search icon", default: true }),
      field("Behavior", { type: "checkbox", id: "sticky", label: "Stick to top", default: true }),
    ],
    blocks: [{ type: "nav_link", name: "Navigation link", settings: [field("Link", { type: "text", id: "label", label: "Label", default: "Menu item" }), field("Link", { type: "url", id: "href", label: "Link", default: "#" })] }],
    maxBlocks: 8,
    defaultBlocks: ["Package", "Products", "Services", "Who We Serve", "About", "Contact"].map((label) => ({ type: "nav_link", settings: { label, href: "#" } })),
  },
  {
    id: "hero",
    name: "Hero",
    category: "Hero",
    settings: [
      field("Content", { type: "select", id: "layout", label: "Layout", options: [option("split", "Split"), option("overlay", "Full-bleed overlay")], default: "split" }),
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Complete Dermatology" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Clinic Setup" }),
      field("Content", { type: "text", id: "headingEmphasis", label: "Heading emphasis", default: "Modern Care. Healthy Skin. Lasting Confidence." }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "" }),
      field("Buttons", { type: "text", id: "primaryButtonLabel", label: "Primary button label", default: "Call Now" }),
      field("Buttons", { type: "url", id: "primaryButtonLink", label: "Primary button link", default: "tel:+919319524258" }),
      field("Media", { type: "image", id: "image", label: "Image" }),
      field("Media", { type: "select", id: "imagePosition", label: "Image position", options: [option("right", "Right"), option("left", "Left")], default: "right" }),
      field("Layout", { type: "select", id: "alignment", label: "Content alignment", options: [option("left", "Left"), option("center", "Center")], default: "left" }),
      field("Style", { type: "color", id: "backgroundColor", label: "Background color", default: "" }),
    ],
    blocks: [{ type: "trust_item", name: "Trust badge", settings: [field("Content", { type: "text", id: "text", label: "Text", default: "MCI-compliant setup guidance" })] }],
    maxBlocks: 6,
  },
  {
    id: "service-highlights",
    name: "Service highlights",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "What We Handle" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Everything your practice needs, in one place" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "Five end-to-end services coordinated by one consultant." }),
      field("Layout", { type: "select", id: "columns", label: "Columns", options: [option("2", "2"), option("3", "3"), option("4", "4")], default: "4" }),
      field("Cards", { type: "checkbox", id: "showLinks", label: "Show Learn more links", default: false }),
    ],
    blocks: [{ type: "highlight", name: "Highlight", settings: [field("Card", { type: "icon", id: "icon", label: "Icon" }), field("Card", { type: "text", id: "title", label: "Title", default: "Space & Interior Design" }), field("Card", { type: "textarea", id: "description", label: "Description", default: "" }), field("Card", { type: "text", id: "linkLabel", label: "Link label", default: "Learn more" })] }],
    maxBlocks: 8,
    defaultBlocks: ["Space & Interior Design", "Equipment Procurement", "Branding & Identity", "Strategy"].map((title) => ({ type: "highlight", settings: { title, description: "Editable service highlight content." } })),
  },
  {
    id: "benefits-grid",
    name: "Benefits grid",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Why Aster" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "What benefits do you get with our" }),
      field("Content", { type: "text", id: "headingEmphasis", label: "Heading emphasis", default: "new clinic setup?" }),
      field("Cards", { type: "select", id: "cardStyle", label: "Card style", options: [option("light", "Light surface"), option("dark", "Dark surface")], default: "light" }),
    ],
    blocks: [{ type: "benefit", name: "Benefit", settings: [field("Card", { type: "icon", id: "icon", label: "Icon" }), field("Card", { type: "text", id: "title", label: "Title", default: "Flexible Customization" }), field("Card", { type: "textarea", id: "description", label: "Description", default: "" })] }],
    maxBlocks: 6,
    defaultBlocks: ["Flexible Customization", "Setup Consultation", "Continuous Support", "Installation Support", "Post-Installation Care"].map((title) => ({ type: "benefit", settings: { title, description: "Editable benefit description." } })),
  },
  {
    id: "process-steps",
    name: "Process steps",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "The Process" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "From call to clinic in 30 days" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "A clear phased process." }),
    ],
    blocks: [{ type: "step", name: "Step", settings: [field("Step", { type: "text", id: "number", label: "Number label", default: "01" }), field("Step", { type: "text", id: "title", label: "Title", default: "Discovery & Scope" }), field("Step", { type: "textarea", id: "description", label: "Description", default: "" })] }],
    maxBlocks: 6,
    defaultBlocks: ["Discovery & Scope", "Design & Approvals", "Build, Launch & Grow"].map((title, index) => ({ type: "step", settings: { number: String(index + 1).padStart(2, "0"), title, description: "Editable process step." } })),
  },
  {
    id: "testimonials",
    name: "Testimonials",
    category: "Social proof",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Dermatologists We've Helped" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Trusted by doctors who had never done this before." }),
      field("Layout", { type: "select", id: "visibleCount", label: "Cards visible", options: [option("1", "1"), option("2", "2"), option("3", "3")], default: "3" }),
    ],
    blocks: [{ type: "testimonial", name: "Testimonial", settings: [field("Person", { type: "text", id: "name", label: "Name", default: "Dr. Rohan Iyer" }), field("Person", { type: "text", id: "role", label: "Role / location", default: "Clinical Dermatologist, Bengaluru" }), field("Quote", { type: "textarea", id: "quote", label: "Quote", default: "" }), field("Quote", { type: "range", id: "rating", label: "Star rating", min: 1, max: 5, step: 1, default: 5 })] }],
    maxBlocks: 12,
    defaultBlocks: ["Dr. Rohan Iyer", "Dr. Shruti Kapoor", "Dr. Priya Mehta"].map((name) => ({ type: "testimonial", settings: { name, role: "Dermatologist", quote: "Editable testimonial quote.", rating: 5 } })),
  },
  {
    id: "image-cta",
    name: "Image call-to-action",
    category: "Call to action",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Ready to get" }),
      field("Content", { type: "text", id: "headingEmphasis", label: "Heading emphasis", default: "started?" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "Book a free consultation." }),
      field("Button", { type: "text", id: "buttonLabel", label: "Button label", default: "View Packages" }),
      field("Button", { type: "url", id: "buttonHref", label: "Button link", default: "#packages" }),
      field("Media", { type: "image", id: "image", label: "Image" }),
      field("Media", { type: "select", id: "imagePosition", label: "Image position", options: [option("left", "Left"), option("right", "Right")], default: "left" }),
    ],
  },
  {
    id: "footer",
    name: "Footer",
    category: "Footer",
    settings: [
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Let's get in touch" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "Sign up for our newsletter and receive 10% off your first order" }),
      field("Newsletter", { type: "checkbox", id: "showNewsletter", label: "Show newsletter form", default: true }),
      field("Newsletter", { type: "text", id: "newsletterPlaceholder", label: "Email placeholder", default: "Enter your email" }),
      field("Contact", { type: "textarea", id: "address", label: "Address", default: "A-213, Sector-3, Vaishali" }),
      field("Contact", { type: "text", id: "phone", label: "Phone number", default: "+91 9319524258" }),
      field("Style", { type: "select", id: "style", label: "Style", options: [option("dark", "Dark"), option("light", "Light")], default: "dark" }),
    ],
    blocks: [{ type: "link_column", name: "Link column", settings: [field("Column", { type: "text", id: "heading", label: "Column heading", default: "Quick links" }), field("Column", { type: "textarea", id: "linksJson", label: "Links", default: "Services|#\nAbout|#\nContact|#" })] }],
    maxBlocks: 10,
    defaultBlocks: [{ type: "link_column", settings: { heading: "Quick link", linksJson: "Services|#services\nAbout|#about\nContact|#contact" } }],
  },
];

export const COPORA_GLOBAL_SETTINGS: ThemeSetting[] = [
  field("Color palette", { type: "color", id: "colorPrimary", label: "Primary (accent) color", default: "#3A1B63" }),
  field("Color palette", { type: "color", id: "colorSecondary", label: "Secondary (highlight) color", default: "#C9A24D" }),
  field("Color palette", { type: "color", id: "colorBackground", label: "Page background", default: "#FFFFFF" }),
  field("Color palette", { type: "color", id: "colorSurface", label: "Card / surface background", default: "#F4F3F1" }),
  field("Color palette", { type: "color", id: "colorSurfaceAlt", label: "Alternate section background", default: "#FBF9F5" }),
  field("Color palette", { type: "color", id: "colorDark", label: "Dark section background", default: "#0B0B0D" }),
  field("Color palette", { type: "color", id: "colorText", label: "Body text color", default: "#111113" }),
  field("Color palette", { type: "color", id: "colorHeading", label: "Heading (title) text color", default: "#111113" }),
  field("Color palette", { type: "color", id: "colorMutedText", label: "Muted / secondary text color", default: "#6B6B70" }),
  field("Color palette", { type: "color", id: "colorBorder", label: "Border color", default: "#E7E5E1" }),
  field("Layout", {
    type: "select",
    id: "containerWidth",
    label: "Container width",
    options: [option("narrow", "Narrow"), option("default", "Default"), option("wide", "Wide"), option("full", "Full width")],
    default: "default",
  }),
  field("Layout", { type: "range", id: "sectionSpacing", label: "Section vertical spacing", min: 32, max: 160, step: 8, unit: "px", default: 104 }),
  field("Layout", { type: "range", id: "borderRadius", label: "Corner radius", min: 0, max: 32, step: 2, unit: "px", default: 14 }),
  field("Typography", {
    type: "select",
    id: "headingFont",
    label: "Heading font",
    options: [
      option("'Sora', 'Inter', sans-serif", "Sora"),
      option("'Space Grotesk', 'Inter', sans-serif", "Space Grotesk"),
      option("'Manrope', 'Inter', sans-serif", "Manrope"),
      option("'Plus Jakarta Sans', 'Inter', sans-serif", "Plus Jakarta Sans"),
      option("'Poppins', 'Inter', sans-serif", "Poppins"),
      option("'Playfair Display', Georgia, serif", "Playfair Display"),
      option("'Inter', -apple-system, sans-serif", "Inter"),
    ],
    default: "'Sora', 'Inter', sans-serif",
  }),
  field("Typography", {
    type: "select",
    id: "bodyFont",
    label: "Body font",
    options: [
      option("'Inter', -apple-system, sans-serif", "Inter"),
      option("'Manrope', -apple-system, sans-serif", "Manrope"),
      option("'Plus Jakarta Sans', -apple-system, sans-serif", "Plus Jakarta Sans"),
      option("'IBM Plex Sans', -apple-system, sans-serif", "IBM Plex Sans"),
      option("Georgia, 'Times New Roman', serif", "Georgia"),
    ],
    default: "'Inter', -apple-system, sans-serif",
  }),
  field("Typography", {
    type: "select",
    id: "headingWeight",
    label: "Heading (title) font weight",
    options: [option("500", "Medium"), option("600", "Semibold"), option("700", "Bold"), option("800", "Extrabold")],
    default: "700",
  }),
  field("Typography", {
    type: "select",
    id: "bodyFontWeight",
    label: "Body font weight",
    options: [option("400", "Regular"), option("500", "Medium"), option("600", "Semibold")],
    default: "400",
  }),
  field("Typography", { type: "range", id: "baseFontSize", label: "Body font size", min: 14, max: 20, step: 1, unit: "px", default: 16 }),
  field("Typography", {
    type: "range",
    id: "headingFontSize",
    label: "Heading (title) font size",
    min: 26,
    max: 60,
    step: 1,
    unit: "px",
    default: 42,
    info: "H1/H3 scale from this using the theme's heading scale ratio.",
  }),
  field("Buttons", { type: "select", id: "buttonStyle", label: "Button style", options: [option("solid", "Solid"), option("outline", "Outline")], default: "solid" }),
  field("Buttons", { type: "range", id: "buttonRadius", label: "Button corner radius", min: 0, max: 40, step: 2, unit: "px", default: 999 }),
  field("Header", { type: "checkbox", id: "stickyHeader", label: "Sticky header on scroll", default: true }),
  field("Header", { type: "checkbox", id: "transparentOnHero", label: "Transparent header over the hero", default: false }),
  field("Header", { type: "checkbox", id: "enableMegaMenu", label: "Enable submenus on nav items", default: true }),
  field("Footer", { type: "select", id: "footerStyle", label: "Footer style", options: [option("dark", "Dark"), option("light", "Light")], default: "dark" }),
  field("Footer", { type: "checkbox", id: "showNewsletter", label: "Show newsletter signup", default: true }),
  field("Footer", { type: "checkbox", id: "showRecentWorks", label: "Show recent works thumbnail grid", default: true }),
  field("Browser tab", { type: "image", id: "favicon", label: "Favicon", info: "Shown in browser tabs and bookmarks. A square image, 32×32px or larger, works best." }),
];

/**
 * Copora (see copora-theme-zip) — a much larger, bespoke agency theme.
 * Transcribed straight from each section's schema.ts file so the editor's
 * fields exactly match what the real theme ships, in the same order
 * templates/index.tsx actually lays them out.
 */
export const COPORA_SECTIONS: SectionSchema[] = [
  {
    id: "header",
    name: "Header",
    category: "Header",
    settings: [
      field("Brand", { type: "image", id: "logoImage", label: "Logo image (desktop)", info: "Leave empty to use the text wordmark below." }),
      field("Brand", { type: "image", id: "mobileLogoImage", label: "Logo image (mobile)", info: "Optional — falls back to the desktop logo (or wordmark) when empty." }),
      field("Brand", { type: "text", id: "logoText", label: "Wordmark text", default: "Copora" }),
      field("Contact", { type: "text", id: "phone", label: "Phone number", default: "+123 456 7891" }),
      field("Contact", { type: "text", id: "ctaLabel", label: "CTA button label", default: "Contact now" }),
      field("Contact", { type: "url", id: "ctaHref", label: "CTA button link", default: "#contact" }),
      field("Layout", {
        type: "select",
        id: "layout",
        label: "Header layout",
        options: [option("classic", "Classic (logo left, nav center, actions right)"), option("centered", "Centered (logo center, nav split around it)")],
        default: "classic",
      }),
      field("Layout", {
        type: "select",
        id: "mobileMenuStyle",
        label: "Mobile menu style",
        options: [option("inline", "Inline dropdown (below header)"), option("overlay", "Full-screen overlay")],
        default: "inline",
      }),
      field("Behavior", { type: "checkbox", id: "sticky", label: "Stick to top on scroll", default: true }),
      field("Behavior", { type: "checkbox", id: "transparentOnHero", label: "Transparent over the hero section", default: false }),
      field("Behavior", { type: "checkbox", id: "showBorder", label: "Show bottom border", default: true }),
      field("Style", { type: "color", id: "backgroundColor", label: "Background color override", info: "Leave empty to use the theme's global colors." }),
      field("Style", { type: "color", id: "textColor", label: "Text color override", info: "Leave empty to use the theme's global colors." }),
    ],
    // The real theme has no depth/nesting concept for nav — a plain "nav_link" is a top-level
    // link with no submenu, and "nav_menu" carries its own dropdown as a single "Label|/url"
    // per line textarea (blank-line-separated "## Heading" groups for the mega style). This
    // must mirror sections/Header/schema.ts's block contract exactly, or Header.tsx silently
    // renders every block as a flat top-level link and multi-level menus never appear.
    blocks: [
      { type: "nav_link", name: "Nav link", settings: [field("Link", { type: "text", id: "label", label: "Label", default: "Menu item" }), field("Link", { type: "url", id: "href", label: "Link", default: "#" })] },
      {
        type: "nav_menu",
        name: "Nav item with submenu",
        settings: [
          field("Link", { type: "text", id: "label", label: "Label", default: "Pages" }),
          field("Submenu", {
            type: "select",
            id: "style",
            label: "Submenu style",
            options: [option("simple", "Simple dropdown"), option("mega", "Full mega menu (columns + featured panel)")],
            default: "simple",
          }),
          field("Submenu", {
            type: "textarea",
            id: "columnsText",
            label: "Submenu links",
            info: 'Simple dropdown: one "Label|/url" per line. Mega menu: group with "## Heading" lines, blank line between groups.',
            default: "Overview|/",
          }),
          field("Featured panel (mega style only)", { type: "image", id: "featuredImage", label: "Featured panel image" }),
          field("Featured panel (mega style only)", { type: "text", id: "featuredTitle", label: "Featured panel title", default: "" }),
          field("Featured panel (mega style only)", { type: "textarea", id: "featuredDescription", label: "Featured panel description", default: "" }),
          field("Featured panel (mega style only)", { type: "text", id: "featuredLinkLabel", label: "Featured panel link label", default: "" }),
          field("Featured panel (mega style only)", { type: "url", id: "featuredLinkHref", label: "Featured panel link URL", default: "" }),
        ],
      },
    ],
    maxBlocks: 8,
    defaultBlocks: [
      { type: "nav_link", settings: { label: "Home", href: "/" } },
      { type: "nav_menu", settings: { label: "About", style: "simple", columnsText: "Our Story|/about#story\nMission & Vision|/about#mission\nOur Team|/about#team" } },
      { type: "nav_menu", settings: { label: "Case Studies", style: "simple", columnsText: "All Case Studies|/case-studies\nFeatured|/case-studies#featured\nBy Industry|/case-studies#industry" } },
      { type: "nav_menu", settings: { label: "Blog", style: "simple", columnsText: "All Posts|/blog\nGrowth|/blog?tag=growth\nStrategy|/blog?tag=strategy\nMarketing|/blog?tag=marketing" } },
      {
        type: "nav_menu",
        settings: {
          label: "Pages",
          style: "mega",
          columnsText:
            "## Pages\nHome|/\nAbout|/about\nService Detail|/services\nBlog|/blog\nBlog Details|/blog/post\n\n## Other Pages\nCase Studies|/case-studies\nContact|/contact\nError 404|/404\nPassword Protected|/protected\nSupport|/support",
          featuredTitle: "Book a free consultation",
          featuredDescription: "Talk to our consultants about your growth strategy.",
          featuredLinkLabel: "Get in touch",
          featuredLinkHref: "/contact",
        },
      },
    ],
  },
  {
    id: "hero",
    name: "Hero",
    category: "Hero",
    settings: [
      field("Content", { type: "text", id: "eyebrowBadge", label: "Eyebrow badge", default: "Firm of the Year 2025" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Driving business growth through expert strategy" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "Unlock your company's full potential with expert guidance, tailored solutions, and proven results from our seasoned consultants." }),
      field("Buttons", { type: "text", id: "primaryButtonLabel", label: "Primary button label", default: "See all case studies" }),
      field("Buttons", { type: "url", id: "primaryButtonHref", label: "Primary button link", default: "/case-studies" }),
      field("Media", { type: "image", id: "image", label: "Main image" }),
      field("Media", { type: "image", id: "secondaryImage", label: "Secondary image" }),
      field("Media", { type: "text", id: "secondaryImageBadge", label: "Secondary image badge text", default: "Build a business growth" }),
      field("Testimonial overlay", { type: "textarea", id: "testimonialQuote", label: "Testimonial quote", default: "The consultants helped us shape a sustainable strategy that emphasized performance, retention, and employee well-being." }),
      field("Testimonial overlay", { type: "text", id: "testimonialName", label: "Testimonial name", default: "Sofia Grant" }),
      field("Testimonial overlay", { type: "text", id: "testimonialRole", label: "Testimonial role", default: "Director of Strategy" }),
      field("Testimonial overlay", { type: "image", id: "testimonialAvatar", label: "Testimonial avatar" }),
      field("Trust row", { type: "text", id: "trustLabel", label: "Trust row label", default: "Based in" }),
    ],
    blocks: [{ type: "trust_logo", name: "Trust logo", settings: [field("Content", { type: "image", id: "image", label: "Logo image" })] }],
    maxBlocks: 8,
  },
  {
    id: "logo-cloud",
    name: "Logo cloud",
    category: "Social proof",
    settings: [field("Content", { type: "text", id: "heading", label: "Heading", default: "Companies who rely on our expertise" })],
    blocks: [{ type: "logo", name: "Logo", settings: [field("Content", { type: "image", id: "image", label: "Logo image" })] }],
    maxBlocks: 8,
  },
  {
    id: "service-cards",
    name: "Service cards",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "What we offer" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Our core consulting services" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "We provide tailored consulting solutions to help businesses overcome challenges, seize opportunities, and achieve sustainable growth." }),
      field("Layout", { type: "select", id: "columns", label: "Columns", options: [option("2", "2"), option("3", "3"), option("4", "4")], default: "4" }),
    ],
    blocks: [{ type: "service", name: "Service", settings: [field("Card", { type: "text", id: "title", label: "Title", default: "Business strategy" }), field("Card", { type: "image", id: "image", label: "Image" })] }],
    maxBlocks: 8,
    defaultBlocks: ["Business strategy", "Process optimization", "Financial advisory", "Marketing Research"].map((title) => ({ type: "service", settings: { title } })),
  },
  {
    id: "stats-row",
    name: "Stats row",
    category: "Content",
    settings: [],
    blocks: [
      {
        type: "stat",
        name: "Stat tile",
        settings: [
          field("Card", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Business transformed" }),
          field("Card", { type: "text", id: "value", label: "Value", default: "260+" }),
          field("Card", { type: "textarea", id: "description", label: "Description", default: "Helping companies grow and perform better." }),
          field("Card", { type: "select", id: "tone", label: "Tone", options: [option("surface", "Light surface"), option("dark", "Dark")], default: "surface" }),
        ],
      },
      {
        type: "cta",
        name: "CTA tile",
        settings: [
          field("Card", { type: "text", id: "heading", label: "Heading", default: "24/7 support to keep your business moving forward" }),
          field("Card", { type: "text", id: "buttonLabel", label: "Button label", default: "Get in touch" }),
          field("Card", { type: "url", id: "buttonHref", label: "Button link", default: "/contact" }),
        ],
      },
    ],
    maxBlocks: 3,
    defaultBlocks: [
      { type: "stat", settings: { eyebrow: "Business transformed", value: "260+", description: "Helping companies grow and perform better.", tone: "surface" } },
      { type: "stat", settings: { eyebrow: "Client satisfaction rate", value: "95%", description: "Trusted and recommended by our clients.", tone: "dark" } },
      { type: "stat", settings: { eyebrow: "Revenue growth generated", value: "$150M", description: "Delivering measurable financial impact.", tone: "surface" } },
    ],
  },
  {
    id: "split-content",
    name: "Image + text split",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "About Copora" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Driven by insight. Focused on results" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "We provide tailored consulting solutions to help businesses overcome challenges, seize opportunities, and achieve sustainable growth." }),
      field("Buttons", { type: "text", id: "buttonLabel", label: "Button label", default: "More about us" }),
      field("Buttons", { type: "url", id: "buttonHref", label: "Button link", default: "/about" }),
      field("Media", { type: "image", id: "image", label: "Main image" }),
      field("Media", { type: "select", id: "imagePosition", label: "Image position", options: [option("right", "Right"), option("left", "Left")], default: "right" }),
      field("Media", { type: "image", id: "secondaryImage", label: "Secondary image (optional)" }),
      field("Signature", { type: "text", id: "signatureName", label: "Signature name (optional)", default: "" }),
      field("Signature", { type: "text", id: "signatureRole", label: "Signature role (optional)", default: "" }),
    ],
  },
  {
    id: "process-dark",
    name: "Process (dark)",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "How we work" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Smart steps to business growth" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "We follow a strategic four-step approach designed to drive measurable results." }),
      field("Media", { type: "image", id: "image", label: "Image" }),
      field("Teaser", { type: "text", id: "teaserText", label: "Teaser text", default: "Want to know what's possible?" }),
      field("Teaser", { type: "text", id: "teaserLinkLabel", label: "Teaser link label", default: "Get in touch now" }),
      field("Teaser", { type: "url", id: "teaserLinkHref", label: "Teaser link URL", default: "/contact" }),
    ],
    blocks: [{ type: "step", name: "Step", settings: [field("Step", { type: "text", id: "number", label: "Number label", default: "01" }), field("Step", { type: "text", id: "title", label: "Title", default: "Discovery" }), field("Step", { type: "textarea", id: "description", label: "Description", default: "" })] }],
    maxBlocks: 6,
    defaultBlocks: [
      { type: "step", settings: { number: "01", title: "Discovery", description: "We begin by listening closely to your challenges and goals." } },
      { type: "step", settings: { number: "02", title: "Strategy", description: "We translate insight into a clear, actionable roadmap." } },
      { type: "step", settings: { number: "03", title: "Execution", description: "Our consultants work alongside your team to implement the plan." } },
      { type: "step", settings: { number: "04", title: "Optimization", description: "We measure outcomes continuously and refine the approach." } },
    ],
  },
  {
    id: "featured-case-study",
    name: "Featured case study",
    category: "Case studies",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Our case studies" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Futured case study" }),
      field("Media", { type: "image", id: "image", label: "Image" }),
      field("Card", { type: "text", id: "tag", label: "Tag", default: "Financial" }),
      field("Card", { type: "text", id: "title", label: "Title", default: "Market entry strategy for a fintech startup" }),
      field("Card", { type: "text", id: "linkLabel", label: "Link label", default: "View case study" }),
      field("Card", { type: "url", id: "linkHref", label: "Link URL", default: "/case-studies/fintech-market-entry" }),
    ],
  },
  {
    id: "case-study-list",
    name: "Case study list",
    category: "Case studies",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Recent case studies" }),
      field("Footer", { type: "text", id: "footerLinkLabel", label: "Footer link label", default: "Let's work together" }),
      field("Footer", { type: "url", id: "footerLinkHref", label: "Footer link URL", default: "/contact" }),
    ],
    blocks: [
      {
        type: "case_study",
        name: "Case study row",
        settings: [
          field("Row", { type: "text", id: "tag", label: "Tag", default: "Retail" }),
          field("Row", { type: "text", id: "title", label: "Title", default: "International expansion strategy for a retail brand" }),
          field("Row", { type: "textarea", id: "excerpt", label: "Excerpt (shown when expanded)", default: "" }),
          field("Row", { type: "text", id: "linkLabel", label: "Link label", default: "View case study" }),
          field("Row", { type: "url", id: "linkHref", label: "Link URL", default: "#" }),
          field("Row", { type: "checkbox", id: "highlighted", label: "Highlight this row", default: false }),
        ],
      },
    ],
    maxBlocks: 8,
    defaultBlocks: [
      { type: "case_study", settings: { tag: "Healthcare", title: "Digital transformation for a healthcare provider", excerpt: "A phased rollout of digital patient services across a multi-site provider network.", highlighted: true } },
      { type: "case_study", settings: { tag: "Retail", title: "International expansion strategy for a retail brand", excerpt: "Market-entry research and go-to-market planning across three new regions." } },
      { type: "case_study", settings: { tag: "Website Design", title: "Corporate website for a green energy company", excerpt: "A full brand and website relaunch aligned to a new sustainability positioning." } },
      { type: "case_study", settings: { tag: "SaaS Product", title: "Product redesign for a SaaS analytics platform", excerpt: "An end-to-end UX overhaul that lifted activation and reduced churn.", highlighted: true } },
    ],
  },
  {
    id: "case-study-grid",
    name: "Case study grid",
    category: "Case studies",
    settings: [
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Our case studies" }),
      field("Layout", { type: "select", id: "columns", label: "Columns", options: [option("2", "2"), option("3", "3")], default: "3" }),
    ],
    blocks: [
      {
        type: "case_study_card",
        name: "Case study card",
        settings: [
          field("Card", { type: "image", id: "image", label: "Image" }),
          field("Card", { type: "text", id: "tag", label: "Tag", default: "Growth" }),
          field("Card", { type: "text", id: "date", label: "Date", default: "June 20, 2025" }),
          field("Card", { type: "text", id: "title", label: "Title", default: "Case study title" }),
          field("Card", { type: "url", id: "linkHref", label: "Link URL", default: "#" }),
        ],
      },
    ],
    maxBlocks: 12,
    defaultBlocks: [
      { type: "case_study_card", settings: { tag: "Growth", date: "June 20, 2025", title: "Why your company needs a strategic roadmap in 2025" } },
      { type: "case_study_card", settings: { tag: "Strategy", date: "June 20, 2025", title: "From goals to KPIs: turning vision into measurable success" } },
      { type: "case_study_card", settings: { tag: "Marketing", date: "June 20, 2025", title: "5 growth strategies every modern business should know" } },
      { type: "case_study_card", settings: { tag: "Growth", date: "June 20, 2025", title: "Digital transformation for service-based businesses" } },
      { type: "case_study_card", settings: { tag: "Strategy", date: "June 20, 2025", title: "Customer experience: turning satisfaction into loyalty" } },
      { type: "case_study_card", settings: { tag: "Marketing", date: "June 20, 2025", title: "A/B testing the modern homepage" } },
    ],
  },
  {
    id: "testimonial-showcase",
    name: "Testimonial showcase",
    category: "Social proof",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Testimonials" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Proven impact, shared experiences" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "From startups to enterprises, our clients share how our strategic consulting helped them achieve lasting success." }),
      field("Rating", { type: "text", id: "ratingValue", label: "Rating value", default: "4.5" }),
      field("Rating", { type: "text", id: "reviewCount", label: "Review count", default: "450+" }),
    ],
    blocks: [
      { type: "testimonial", name: "Testimonial", settings: [field("Quote", { type: "textarea", id: "quote", label: "Quote", default: "Our company was growing fast, but our culture couldn't keep pace." }), field("Person", { type: "text", id: "name", label: "Name", default: "Amanda Lewis" }), field("Person", { type: "text", id: "role", label: "Role", default: "Director of Strategy" }), field("Person", { type: "image", id: "avatar", label: "Avatar" })] },
      { type: "gallery_image", name: "Gallery image", settings: [field("Content", { type: "image", id: "image", label: "Image" })] },
    ],
    maxBlocks: 10,
    defaultBlocks: [
      { type: "testimonial", settings: { quote: "Our company was growing fast, but our culture couldn't keep pace.", name: "Amanda Lewis", role: "Director of Strategy" } },
      { type: "gallery_image", settings: {} },
      { type: "gallery_image", settings: {} },
      { type: "gallery_image", settings: {} },
    ],
  },
  {
    id: "team-grid",
    name: "Team grid",
    category: "Content",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Our team" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Our team of problem solvers" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "Our diverse team of experienced consultants, analysts, and industry specialists work together to deliver real results." }),
    ],
    blocks: [{ type: "member", name: "Team member", settings: [field("Card", { type: "image", id: "photo", label: "Photo" }), field("Card", { type: "text", id: "name", label: "Name", default: "Team member" }), field("Card", { type: "text", id: "role", label: "Role", default: "Consultant" })] }],
    maxBlocks: 12,
    defaultBlocks: [
      { type: "member", settings: { name: "Rachel Kim", role: "Chief Strategy Officer" } },
      { type: "member", settings: { name: "Hannah Brooks", role: "Chief Strategy Officer" } },
      { type: "member", settings: { name: "Amira Chen", role: "Operations Consultant" } },
      { type: "member", settings: { name: "David Hassan", role: "Business Analyst" } },
      { type: "member", settings: { name: "Elena Novak", role: "Market Research Lead" } },
    ],
  },
  {
    id: "mission-vision",
    name: "Mission & vision",
    category: "Content",
    settings: [
      field("Mission", { type: "text", id: "missionTitle", label: "Mission title", default: "Our Mission" }),
      field("Mission", { type: "textarea", id: "missionDescription", label: "Mission description", default: "To empower businesses of all sizes to unlock their full potential through strategic insight, tailored consulting, and measurable results." }),
      field("Vision", { type: "text", id: "visionTitle", label: "Vision title", default: "Our Vision" }),
      field("Vision", { type: "image", id: "visionImage", label: "Vision image" }),
    ],
    blocks: [{ type: "bullet", name: "Vision bullet", settings: [field("Content", { type: "text", id: "text", label: "Text", default: "Global impact" })] }],
    maxBlocks: 6,
    defaultBlocks: ["Global impact", "Innovative thinking", "Empowering growth"].map((text) => ({ type: "bullet", settings: { text } })),
  },
  {
    id: "blog-grid",
    name: "Blog grid",
    category: "Blog",
    settings: [
      field("Content", { type: "text", id: "eyebrow", label: "Eyebrow", default: "Our blog" }),
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Insights & Ideas" }),
      field("Footer", { type: "text", id: "seeAllLabel", label: '"See all" button label', default: "See all blog" }),
      field("Footer", { type: "url", id: "seeAllHref", label: '"See all" button link', default: "/blog" }),
      field("Layout", { type: "select", id: "columns", label: "Columns", options: [option("2", "2"), option("3", "3")], default: "2" }),
    ],
    blocks: [{ type: "post", name: "Post", settings: [field("Card", { type: "image", id: "image", label: "Image" }), field("Card", { type: "text", id: "tag", label: "Tag", default: "Growth" }), field("Card", { type: "text", id: "date", label: "Date", default: "June 20, 2025" }), field("Card", { type: "text", id: "title", label: "Title", default: "Post title" }), field("Card", { type: "url", id: "linkHref", label: "Link URL", default: "#" })] }],
    maxBlocks: 6,
    defaultBlocks: [
      { type: "post", settings: { tag: "Growth", date: "June 20, 2025", title: "5 growth strategies every modern business should know" } },
      { type: "post", settings: { tag: "Strategy", date: "June 20, 2025", title: "From goals to KPIs: turning vision into measurable success" } },
    ],
  },
  {
    id: "contact-form",
    name: "Contact form",
    category: "Forms",
    settings: [
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Have a business challenge? We're ready to help" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "Whether you're ready to scale, solve a business challenge, or explore a partnership - we're here to help." }),
      field("Form", { type: "text", id: "submitLabel", label: "Submit button label", default: "Submit" }),
      field("Media", { type: "image", id: "image", label: "Image" }),
    ],
    blocks: [{ type: "service_option", name: "Service option", settings: [field("Content", { type: "text", id: "label", label: "Label", default: "Business strategy" })] }],
    maxBlocks: 8,
    defaultBlocks: ["Business strategy", "Process optimization", "Financial advisory", "Marketing research"].map((label) => ({ type: "service_option", settings: { label } })),
  },
  {
    id: "location-card",
    name: "Location card",
    category: "Content",
    settings: [
      field("Content", { type: "image", id: "image", label: "Image" }),
      field("Content", { type: "text", id: "title", label: "Title", default: "Business consulting agency Copora" }),
      field("Content", { type: "textarea", id: "address", label: "Address", default: "Chicago HQ Estica Cop.\nMacomb, MI 48042" }),
      field("Content", { type: "text", id: "email", label: "Email", default: "contact@copora.com" }),
    ],
  },
  {
    id: "cta-banner",
    name: "CTA banner",
    category: "Call to action",
    settings: [
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Let's build something that moves your business forward" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "" }),
      field("Content", { type: "text", id: "avatarLabel", label: "Avatar label", default: "Talk to our experts" }),
      field("Media", { type: "image", id: "image", label: "Image" }),
      field("Buttons", { type: "text", id: "buttonLabel", label: "Button label", default: "Get started now" }),
      field("Buttons", { type: "url", id: "buttonHref", label: "Button link", default: "/contact" }),
    ],
    blocks: [{ type: "avatar", name: "Avatar", settings: [field("Content", { type: "image", id: "image", label: "Photo" })] }],
    maxBlocks: 6,
    defaultBlocks: [{ type: "avatar", settings: {} }, { type: "avatar", settings: {} }, { type: "avatar", settings: {} }],
  },
  {
    id: "page-intro",
    name: "Page intro",
    category: "Hero",
    settings: [
      field("Content", { type: "text", id: "heading", label: "Heading", default: "Building better businesses with smart strategy" }),
      field("Content", { type: "textarea", id: "description", label: "Description", default: "We're a forward-thinking consulting agency helping businesses grow smarter, scale faster, and lead with clarity." }),
      field("Media", { type: "image", id: "image", label: "Banner image" }),
      field("Media", { type: "select", id: "imageAspectRatio", label: "Banner aspect ratio", options: [option("16:9", "16:9"), option("3:2", "3:2"), option("4:3", "4:3")], default: "16:9" }),
    ],
  },
  {
    id: "footer",
    name: "Footer",
    category: "Footer",
    settings: [
      field("Brand", { type: "text", id: "logoText", label: "Wordmark text", default: "Copora" }),
      field("Contact", { type: "text", id: "contactLabel", label: "Contact label", default: "Say hello to us!" }),
      field("Contact", { type: "text", id: "email", label: "Email", default: "hello@example.com" }),
      field("Contact", { type: "text", id: "phone", label: "Phone number", default: "+123 456 7890" }),
      field("Newsletter", { type: "checkbox", id: "showNewsletter", label: "Show newsletter form", default: true }),
      field("Newsletter", { type: "text", id: "newsletterHeading", label: "Newsletter heading", default: "Stay informed." }),
      field("Newsletter", { type: "text", id: "newsletterPlaceholder", label: "Email field placeholder", default: "Enter email address" }),
      field("Recent works", { type: "checkbox", id: "showRecentWorks", label: "Show recent works grid", default: true }),
      field("Recent works", { type: "text", id: "recentWorksHeading", label: "Recent works heading", default: "Recent works" }),
      field("Style", { type: "text", id: "credit", label: "Credit line", default: "Developed by Aster Theme Studio" }),
      field("Style", { type: "select", id: "style", label: "Style", options: [option("dark", "Dark"), option("light", "Light")], default: "dark" }),
    ],
    // Mirrors sections/Footer/schema.ts's block contract: a "link_column" carries
    // its own links as ONE "Label|/url" per line in a textarea, where a line
    // indented 2+ spaces nests under the link directly above it (see
    // parseNestedLinks in the theme's blockHelpers) — not the platform's
    // depth-nested block hierarchy used elsewhere.
    blocks: [
      {
        type: "link_column",
        name: "Link column",
        settings: [
          field("Column", { type: "text", id: "heading", label: "Column heading", default: "Pages" }),
          field("Column", {
            type: "textarea",
            id: "linksJson",
            label: "Links",
            info: 'One "Label|/url" per line. Indent a line with 2+ spaces to nest it as a submenu item under the link above it.',
            default: "Home|/\nAbout|/about\nBlog|/blog",
          }),
        ],
      },
      { type: "social_link", name: "Social link", settings: [field("Content", { type: "icon", id: "icon", label: "Icon" }), field("Content", { type: "url", id: "href", label: "URL", default: "#" }), field("Content", { type: "text", id: "label", label: "Accessible label", default: "Follow us" })] },
      { type: "recent_work", name: "Recent work image", settings: [field("Content", { type: "image", id: "image", label: "Image" })] },
    ],
    maxBlocks: 16,
    defaultBlocks: [
      { type: "link_column", settings: { heading: "Company", linksJson: "About|/about\n  Our Story|/about#story\n  Our Team|/about#team\nCase Studies|/case-studies\nBlog|/blog" } },
      { type: "link_column", settings: { heading: "Services", linksJson: "Business Strategy|/services/strategy\nProcess Optimization|/services/process\nFinancial Advisory|/services/financial\nMarketing Research|/services/marketing" } },
      { type: "link_column", settings: { heading: "Support", linksJson: "Contact|/contact\n  General Enquiries|/contact?topic=general\n  Partnerships|/contact?topic=partnership\nError 404|/404\nPassword Protected|/protected" } },
      { type: "social_link", settings: { icon: "facebook", href: "#", label: "Facebook" } },
      { type: "social_link", settings: { icon: "instagram", href: "#", label: "Instagram" } },
      { type: "social_link", settings: { icon: "linkedin", href: "#", label: "LinkedIn" } },
    ],
  },
];
