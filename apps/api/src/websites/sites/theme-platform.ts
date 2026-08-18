import { BadRequestException } from "@nestjs/common";
import { inflateRawSync } from "node:zlib";
import { ThemeChangeType, ThemeStatus, type Prisma } from "../../core/database/database.js";

export const maxThemeFileBytes = 128_000;
export const maxThemeZipBytes = 5_000_000;
export const maxThemeZipFiles = 250;
const allowedDirectories = ["config", "layout", "templates", "sections", "components", "assets", "locales"];
const allowedExtensions = [".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md"];
const forbiddenText = [
  /\bnode:/i,
  /from\s+["']fs["']/i,
  /from\s+["']child_process["']/i,
  /from\s+["']process["']/i,
  /\bprocess\.env\b/i,
  /\beval\s*\(/i,
  /new\s+Function\s*\(/i,
  /import\s*\(/i,
];

export const starterManifest = {
  id: "starter",
  engineVersion: "1",
  themeVersion: "1.0.0",
  templates: ["index", "page", "404"],
  sections: ["header", "hero", "rich-text", "footer"],
  capabilities: { cms: true, ecommerce: false, blog: false },
  settingsSchemaVersion: "1",
};

export const starterSettingsSchema = [
  { id: "colors.primary", type: "color", label: "Primary", group: "Colors", default: "#111827" },
  { id: "colors.background", type: "color", label: "Background", group: "Colors", default: "#ffffff" },
  { id: "layout.container_width", type: "range", label: "Container width", group: "Layout", min: 960, max: 1600, step: 10, default: 1200 },
  { id: "buttons.radius", type: "select", label: "Button radius", group: "Buttons", options: ["sm", "md", "lg", "xl"], default: "md" },
];

export const starterFiles: Record<string, string> = {
  "theme.config.ts": `export const themeConfig = ${JSON.stringify({
    id: "starter",
    name: "Starter",
    version: "1.0.0",
    engineVersion: "1",
    description: "Safe starter theme package.",
    author: "StackBuilder",
    capabilities: starterManifest.capabilities,
  }, null, 2)};\n`,
  "config/settings.schema.ts": `export const settingsSchema = ${JSON.stringify(starterSettingsSchema, null, 2)};\n`,
  "config/settings.default.ts": `export const settingsDefault = ${JSON.stringify({ colors: { primary: "#111827", background: "#ffffff" }, layout: { container_width: 1200 }, buttons: { radius: "md" } }, null, 2)};\n`,
  "layout/ThemeLayout.tsx": "export function ThemeLayout({ children }: { children: React.ReactNode }) {\n  return <main>{children}</main>;\n}\n",
  "templates/index.tsx": "export const template = { name: 'Home', sections: ['header', 'hero', 'rich-text', 'footer'] };\n",
  "templates/page.tsx": "export const template = { name: 'Page', sections: ['header', 'rich-text', 'footer'] };\n",
  "templates/404.tsx": "export const template = { name: 'Not Found', sections: ['header', 'rich-text', 'footer'] };\n",
  "sections/Header/schema.ts": "export const schema = { type: 'header', name: 'Header', settings: [{ id: 'logoText', type: 'text', label: 'Logo text' }] };\n",
  "sections/Hero/schema.ts": "export const schema = { type: 'hero', name: 'Hero', settings: [{ id: 'heading', type: 'text', label: 'Heading' }, { id: 'subheading', type: 'textarea', label: 'Subheading' }, { id: 'image', type: 'image', label: 'Image' }] };\n",
  "sections/RichText/schema.ts": "export const schema = { type: 'rich-text', name: 'Rich text', settings: [{ id: 'content', type: 'textarea', label: 'Content' }] };\n",
  "sections/Footer/schema.ts": "export const schema = { type: 'footer', name: 'Footer', settings: [{ id: 'copyright', type: 'text', label: 'Copyright' }] };\n",
  "assets/theme.css": ":root { color-scheme: light; }\n",
  "locales/en.json": "{\n  \"general\": { \"home\": \"Home\" }\n}\n",
};

export interface ThemeDefinition {
  id: string;
  name: string;
  version: string;
  engineVersion: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  preview?: {
    type: "placeholder";
    accent: string;
  };
  manifest: Record<string, unknown>;
  settings: Record<string, unknown>;
  settingsSchema: Array<Record<string, unknown>>;
  sections: Array<{
    id: string;
    name: string;
    file: string;
    settings: Array<Record<string, unknown>>;
  }>;
  templates: Array<{
    id: string;
    name: string;
    file: string;
  }>;
  files: Record<string, string>;
}

export const portalModernSettings = {
  global: {
    primaryColor: "#2563EB",
    secondaryColor: "#0F172A",
    background: "#FFFFFF",
    text: "#111827",
    containerWidth: 1200,
    radius: "md",
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Inter",
    headingWeight: "700",
    bodySize: "16",
  },
  header: {
    stickyHeader: true,
    showLogin: true,
  },
  footer: {
    copyright: "(c) Portal Modern",
  },
};

export const portalModernSettingsSchema = [
  { id: "global.primaryColor", type: "color", label: "Primary color", group: "Global", default: "#2563EB" },
  { id: "global.secondaryColor", type: "color", label: "Secondary color", group: "Global", default: "#0F172A" },
  { id: "global.background", type: "color", label: "Background", group: "Global", default: "#FFFFFF" },
  { id: "global.text", type: "color", label: "Text", group: "Global", default: "#111827" },
  { id: "global.containerWidth", type: "range", label: "Container width", group: "Global", min: 960, max: 1600, step: 20, default: 1200 },
  { id: "global.radius", type: "select", label: "Radius", group: "Global", options: ["sm", "md", "lg", "xl"], default: "md" },
  { id: "typography.headingFont", type: "select", label: "Heading font", group: "Typography", options: ["Inter", "Manrope", "DM Sans"], default: "Inter" },
  { id: "typography.bodyFont", type: "select", label: "Body font", group: "Typography", options: ["Inter", "Manrope", "DM Sans"], default: "Inter" },
  { id: "typography.headingWeight", type: "select", label: "Heading weight", group: "Typography", options: ["600", "700", "800"], default: "700" },
  { id: "typography.bodySize", type: "range", label: "Body size", group: "Typography", min: 14, max: 20, step: 1, default: 16 },
  { id: "header.stickyHeader", type: "boolean", label: "Sticky header", group: "Header", default: true },
  { id: "header.showLogin", type: "boolean", label: "Show login", group: "Header", default: true },
  { id: "footer.copyright", type: "text", label: "Copyright", group: "Footer", default: "(c) Portal Modern" },
];

export const portalModernSections = [
  {
    id: "announcement-bar",
    name: "Announcement Bar",
    file: "sections/AnnouncementBar/schema.ts",
    settings: [
      { id: "message", type: "text", label: "Message", group: "Content", default: "New platform theme is live" },
      { id: "linkText", type: "text", label: "Link text", group: "Content", default: "Explore" },
      { id: "linkUrl", type: "url", label: "Link URL", group: "Content", default: "/" },
    ],
  },
  {
    id: "header",
    name: "Header",
    file: "sections/Header/schema.ts",
    settings: [
      { id: "logoText", type: "text", label: "Logo text", group: "Content", default: "Portal" },
      { id: "showLogin", type: "boolean", label: "Show login", group: "Content", default: true },
    ],
  },
  {
    id: "hero",
    name: "Hero",
    file: "sections/Hero/schema.ts",
    settings: [
      { id: "heading", type: "text", label: "Heading", group: "Content", default: "Build a modern customer portal" },
      { id: "description", type: "textarea", label: "Description", group: "Content", default: "Launch a polished portal experience with theme-driven sections." },
      { id: "buttonText", type: "text", label: "Button text", group: "Content", default: "Get started" },
      { id: "buttonLink", type: "url", label: "Button link", group: "Content", default: "/" },
      { id: "alignment", type: "select", label: "Alignment", group: "Layout", options: ["left", "center"], default: "left" },
    ],
  },
  {
    id: "featured-cards",
    name: "Featured Cards",
    file: "sections/FeaturedCards/schema.ts",
    settings: [
      { id: "heading", type: "text", label: "Heading", group: "Content", default: "Everything teams need" },
      { id: "columns", type: "range", label: "Columns", group: "Layout", min: 2, max: 4, step: 1, default: 3 },
    ],
  },
  {
    id: "content-grid",
    name: "Content Grid",
    file: "sections/ContentGrid/schema.ts",
    settings: [
      { id: "heading", type: "text", label: "Heading", group: "Content", default: "Latest resources" },
      { id: "layout", type: "select", label: "Layout", group: "Layout", options: ["grid", "list"], default: "grid" },
    ],
  },
  {
    id: "call-to-action",
    name: "Call to Action",
    file: "sections/CallToAction/schema.ts",
    settings: [
      { id: "heading", type: "text", label: "Heading", group: "Content", default: "Ready to launch?" },
      { id: "buttonText", type: "text", label: "Button text", group: "Content", default: "Publish now" },
      { id: "buttonLink", type: "url", label: "Button link", group: "Content", default: "/" },
    ],
  },
  {
    id: "footer",
    name: "Footer",
    file: "sections/Footer/schema.ts",
    settings: [
      { id: "copyright", type: "text", label: "Copyright", group: "Content", default: "(c) Portal Modern" },
    ],
  },
];

export const portalModernTemplates = [
  { id: "index", name: "Home", file: "templates/index.tsx" },
  { id: "page", name: "Page", file: "templates/page.tsx" },
  { id: "search", name: "Search", file: "templates/search.tsx" },
  { id: "404", name: "404", file: "templates/404.tsx" },
];

export const portalModernManifest = {
  id: "portal-modern",
  engineVersion: "1",
  themeVersion: "1.0.0",
  templates: portalModernTemplates.map((template) => template.id),
  sections: portalModernSections.map((section) => section.id),
  capabilities: { cms: true, ecommerce: false, blog: true, search: true },
  settingsSchemaVersion: "1",
  settingsSchema: portalModernSettingsSchema,
  sectionSchemas: portalModernSections,
  templateDefinitions: portalModernTemplates,
};

const portalModernSectionFiles = Object.fromEntries(
  portalModernSections.flatMap((section) => [
    [
      section.file,
      `export const schema = ${JSON.stringify(
        { id: section.id, name: section.name, settings: section.settings },
        null,
        2,
      )};\n`,
    ],
    [
      section.file.replace("/schema.ts", `/${section.name.replace(/\s+/g, "")}.tsx`),
      `export function ${section.name.replace(/\s+/g, "")}() {\n  return null;\n}\n`,
    ],
  ]),
);

export const portalModernFiles: Record<string, string> = {
  "theme.config.ts": `export const themeConfig = ${JSON.stringify(
    {
      id: "portal-modern",
      name: "Portal Modern",
      version: "1.0.0",
      engineVersion: "1",
      description: "A modern portal theme for content, account, and knowledge-base websites.",
      author: "StackBuilder",
    },
    null,
    2,
  )};\n`,
  "config/settings.schema.ts": `export const settingsSchema = ${JSON.stringify(portalModernSettingsSchema, null, 2)};\n`,
  "config/settings.default.ts": `export const settingsDefault = ${JSON.stringify(portalModernSettings, null, 2)};\n`,
  "layout/ThemeLayout.tsx": "export function ThemeLayout({ children }: { children: React.ReactNode }) {\n  return <main className=\"portal-modern-theme\">{children}</main>;\n}\n",
  ...Object.fromEntries(portalModernTemplates.map((template) => [template.file, `export const template = ${JSON.stringify(template, null, 2)};\n`])),
  ...portalModernSectionFiles,
  "components/PortalButton.tsx": "export function PortalButton({ children }: { children: React.ReactNode }) {\n  return <button>{children}</button>;\n}\n",
  "components/PortalCard.tsx": "export function PortalCard({ children }: { children: React.ReactNode }) {\n  return <article>{children}</article>;\n}\n",
  "assets/theme.css": ":root { --portal-primary: #2563EB; --portal-radius: 8px; }\n.portal-modern-theme { background: var(--portal-background, #fff); }\n",
  "locales/en.json": "{\n  \"theme\": { \"name\": \"Portal Modern\" }\n}\n",
};

export const themeRegistry: Record<string, ThemeDefinition> = {
  "portal-modern": {
    id: "portal-modern",
    name: "Portal Modern",
    version: "1.0.0",
    engineVersion: "1",
    description: "A modern portal theme for content, account, and knowledge-base websites.",
    author: "StackBuilder",
    category: "Portal",
    tags: ["portal", "modern", "cms"],
    preview: { type: "placeholder", accent: "#2563EB" },
    manifest: portalModernManifest,
    settings: portalModernSettings,
    settingsSchema: portalModernSettingsSchema,
    sections: portalModernSections,
    templates: portalModernTemplates,
    files: portalModernFiles,
  },
  starter: {
    id: "starter",
    name: "Starter",
    version: "1.0.0",
    engineVersion: "1",
    description: "Safe starter theme package.",
    author: "StackBuilder",
    category: "Starter",
    tags: ["starter", "editable"],
    preview: { type: "placeholder", accent: "#111827" },
    manifest: starterManifest,
    settings: {},
    settingsSchema: starterSettingsSchema,
    sections: [],
    templates: [],
    files: starterFiles,
  },
};

export function listThemeDefinitions() {
  return Object.values(themeRegistry).map(({ files: _files, ...definition }) => definition);
}

export function getThemeDefinition(id: unknown): ThemeDefinition {
  const themeId = typeof id === "string" && id.trim() ? id.trim() : "portal-modern";
  const definition = themeRegistry[themeId];
  if (!definition) {
    throw new BadRequestException("Theme is not registered");
  }
  return definition;
}

export function validateThemeManifest(value: unknown): Prisma.InputJsonValue {
  if (!isRecord(value)) {
    throw new BadRequestException("manifest must be an object");
  }
  const engineVersion = stringField(value.engineVersion, "manifest.engineVersion");
  if (engineVersion !== "1") {
    throw new BadRequestException("Only theme engine version 1 is supported");
  }
  const templates = stringArray(value.templates, "manifest.templates");
  const sections = stringArray(value.sections, "manifest.sections");
  return {
    engineVersion,
    themeVersion: stringField(value.themeVersion, "manifest.themeVersion"),
    templates,
    sections,
    capabilities: isRecord(value.capabilities) ? value.capabilities : {},
    settingsSchemaVersion: stringField(value.settingsSchemaVersion, "manifest.settingsSchemaVersion"),
  } as Prisma.InputJsonValue;
}

export function validateThemeFilePath(path: unknown): string {
  const value = stringField(path, "path").replace(/\\/g, "/");
  if (value.includes("../") || value.startsWith("/") || value.includes("\0")) {
    throw new BadRequestException("Theme file path is unsafe");
  }
  if (value === "theme.config.ts" || /^[A-Za-z0-9._-]+\.md$/.test(value)) {
    return value;
  }
  const directory = value.split("/")[0] ?? "";
  if (!allowedDirectories.includes(directory)) {
    throw new BadRequestException("Theme file must be in an allowed directory");
  }
  if (!allowedExtensions.some((extension) => value.endsWith(extension))) {
    throw new BadRequestException("Theme file extension is not allowed");
  }
  return value;
}

export function validateThemeFileContent(path: string, content: unknown): string {
  const value = stringField(content, "content");
  if (value.length > maxThemeFileBytes) {
    throw new BadRequestException("Theme file is too large");
  }
  if ((path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".jsx")) && forbiddenText.some((pattern) => pattern.test(value))) {
    throw new BadRequestException("Theme file contains forbidden APIs or imports");
  }
  if (path.endsWith(".json")) {
    try {
      JSON.parse(value);
    } catch {
      throw new BadRequestException("JSON theme files must contain valid JSON");
    }
  }
  return value;
}

export function buildFileManifest(files: Record<string, string>): Prisma.InputJsonValue {
  return {
    files: Object.entries(files).map(([path, content]) => ({
      path,
      size: content.length,
      kind: path.split(".").pop() ?? "text",
    })),
  } as Prisma.InputJsonValue;
}

export function buildUploadedThemeDefinition(buffer: Buffer, fallbackName: unknown): ThemeDefinition {
  const files = extractThemeZipFiles(buffer);
  const config = parseThemeConfig(files["theme.config.ts"], optionalStringField(fallbackName));
  const settingsSchema = parseSettingsSchema(files["config/settings.schema.ts"]);
  const sections = parseSectionSchemas(files);
  const templates = config.templates.length ? config.templates : inferTemplates(files);
  const settings = Object.fromEntries(settingsSchema.map((setting) => [String(setting.id), setting.default ?? ""]));
  const manifest = {
    id: config.id,
    engineVersion: "1",
    themeVersion: config.version,
    templates: templates.map((template) => template.id),
    sections: sections.map((section) => section.id),
    capabilities: {
      settingsSchema: settingsSchema.length > 0,
      sectionSchemas: sections.length > 0,
      blocks: sections.some((section) => Boolean((section as { blocks?: unknown[] }).blocks?.length)),
      localization: Object.keys(files).some((path) => path.startsWith("locales/")),
      imageFields: JSON.stringify(sections).includes('"image"'),
      responsivePreview: true,
    },
    settingsSchemaVersion: "1",
    settingsSchema,
    sectionSchemas: sections,
    templateDefinitions: templates,
    uploaded: true,
  };

  return {
    id: config.id,
    name: config.name,
    version: config.version,
    engineVersion: config.engineVersion,
    description: config.description,
    author: config.author,
    category: "Uploaded",
    tags: ["uploaded"],
    preview: { type: "placeholder", accent: "#C89B3C" },
    manifest,
    settings,
    settingsSchema,
    sections,
    templates,
    files,
  };
}

export function diffFiles(before: Record<string, string>, after: Record<string, string>) {
  const beforeKeys = new Set(Object.keys(before));
  const afterKeys = new Set(Object.keys(after));
  const added = [...afterKeys].filter((key) => !beforeKeys.has(key));
  const deleted = [...beforeKeys].filter((key) => !afterKeys.has(key));
  const modified = [...afterKeys].filter((key) => beforeKeys.has(key) && before[key] !== after[key]);
  return { added, modified, deleted };
}

export function asFileMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export function stringField(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

export function optionalStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function changeTypeForFile(existed: boolean): ThemeChangeType {
  return existed ? ThemeChangeType.FILE_UPDATED : ThemeChangeType.FILE_CREATED;
}

export { ThemeChangeType, ThemeStatus };

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new BadRequestException(`${field} must be a string array`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractThemeZipFiles(buffer: Buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BadRequestException("Theme ZIP is empty");
  }
  if (buffer.length > maxThemeZipBytes) {
    throw new BadRequestException("Theme ZIP is too large");
  }

  const entries = readZipEntries(buffer);
  if (entries.length > maxThemeZipFiles) {
    throw new BadRequestException("Theme ZIP contains too many files");
  }

  const fileEntries = entries.filter((entry) => !entry.path.endsWith("/") && !entry.path.includes("__MACOSX/"));
  const rootPrefix = inferRootPrefix(fileEntries.map((entry) => entry.path));
  const files: Record<string, string> = {};

  for (const entry of fileEntries) {
    const strippedPath = rootPrefix && entry.path.startsWith(rootPrefix) ? entry.path.slice(rootPrefix.length) : entry.path;
    if (!strippedPath || strippedPath.endsWith("/")) continue;
    const safePath = validateThemeFilePath(strippedPath);
    const content = entry.content.toString("utf8");
    files[safePath] = validateThemeFileContent(safePath, content);
  }

  assertRequiredUploadedFiles(files);
  return files;
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: Array<{ path: string; content: Buffer }> = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new BadRequestException("Theme ZIP central directory is invalid");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const path = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!content) {
      throw new BadRequestException("Theme ZIP uses an unsupported compression method");
    }
    entries.push({ path, content });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new BadRequestException("Theme ZIP is invalid");
}

function inferRootPrefix(paths: string[]) {
  const themeConfigPath = paths.find((path) => path.endsWith("theme.config.ts"));
  if (!themeConfigPath) return "";
  const slash = themeConfigPath.lastIndexOf("/");
  return slash >= 0 ? themeConfigPath.slice(0, slash + 1) : "";
}

function assertRequiredUploadedFiles(files: Record<string, string>) {
  const required = ["theme.config.ts", "config/settings.schema.ts", "config/settings.default.ts"];
  for (const path of required) {
    if (!files[path]) {
      throw new BadRequestException(`Theme ZIP is missing ${path}`);
    }
  }
  if (!Object.keys(files).some((path) => path.startsWith("sections/") && path.endsWith("/schema.ts"))) {
    throw new BadRequestException("Theme ZIP must include section schema files");
  }
}

function parseThemeConfig(source: string | undefined, fallbackName?: string) {
  if (!source) throw new BadRequestException("Theme ZIP is missing theme.config.ts");
  const id = slugThemeId(matchString(source, "id") ?? fallbackName ?? "uploaded-theme");
  const name = matchString(source, "name") ?? fallbackName ?? "Uploaded theme";
  const version = matchString(source, "version") ?? "1.0.0";
  return {
    id,
    name,
    version,
    engineVersion: normalizeEngineVersion(matchString(source, "engineVersion") ?? "1"),
    description: matchString(source, "description") ?? "Uploaded theme package.",
    author: matchString(source, "author") ?? "Custom upload",
    templates: parseRecordDefinition(source, "templates").map(([templateId, file]) => ({
      id: templateId,
      name: titleCase(templateId === "index" ? "Home" : templateId),
      file,
    })),
  };
}

function parseSettingsSchema(source: string | undefined): Array<Record<string, unknown>> {
  if (!source) return [];
  return parseSettingObjects(source).map((setting) => ({ group: inferSettingGroup(source, String(setting.id)), ...setting }));
}

function parseSectionSchemas(files: Record<string, string>) {
  const sections = Object.entries(files)
    .filter(([path]) => path.startsWith("sections/") && path.endsWith("/schema.ts"))
    .map(([path, source]) => {
      const rootSource = getRootSectionSource(source);
      const id = matchString(rootSource, "id") ?? matchString(rootSource, "type") ?? slugThemeId(path.split("/")[1] ?? "section");
      const name = matchString(rootSource, "name") ?? titleCase(id);
      const category = matchString(rootSource, "category") ?? "Sections";
      const maxBlocks = matchNumber(source, "maxBlocks");
      const defaultBlocks = parseDefaultBlocks(source);
      return {
        id,
        name,
        category,
        file: path,
        settings: parseSettingObjectsBetween(source, "settings").map((setting) => ({ group: inferSettingGroup(source, String(setting.id)), ...setting })),
        blocks: parseBlockSchemas(source),
        ...(maxBlocks !== undefined ? { maxBlocks } : {}),
        ...(defaultBlocks.length ? { defaultBlocks } : {}),
      };
    });
  return sortSectionsByTemplateOrder(sortSectionsByThemeConfigOrder(sections, files["theme.config.ts"]), files["templates/index.tsx"]);
}

function sortSectionsByThemeConfigOrder<T extends { id: string }>(sections: T[], config: string | undefined) {
  const order = parseThemeSectionOrder(config);
  if (!order.length) return sections;
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...sections].sort((first, second) => (orderMap.get(first.id) ?? 999) - (orderMap.get(second.id) ?? 999));
}

function sortSectionsByTemplateOrder<T extends { id: string; name: string }>(sections: T[], template: string | undefined) {
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

function parseTemplateSectionOrder<T extends { id: string; name: string }>(source: string | undefined, sections: T[]) {
  if (!source) return [];
  return sections
    .map((section) => ({ id: section.id, index: source.indexOf(componentName(section.name)) }))
    .filter((item) => item.index >= 0)
    .sort((first, second) => first.index - second.index)
    .map((item) => item.id);
}

function getRootSectionSource(source: string) {
  const settingsIndex = source.indexOf("settings:");
  const blocksIndex = source.indexOf("blocks:");
  const cutPoints = [settingsIndex, blocksIndex].filter((index) => index >= 0);
  return cutPoints.length ? source.slice(0, Math.min(...cutPoints)) : source;
}

function inferTemplates(files: Record<string, string>) {
  return Object.keys(files)
    .filter((path) => path.startsWith("templates/") && path.endsWith(".tsx"))
    .map((path) => {
      const id = path.replace("templates/", "").replace(/\.tsx$/, "");
      return { id, name: titleCase(id === "index" ? "Home" : id), file: path };
    });
}

function parseBlockSchemas(source: string) {
  const blocks = getArrayBlock(source, "blocks");
  if (!blocks) return [];
  const blockChunks = getObjectLiterals(blocks).filter((chunk) => matchString(chunk, "type") && matchString(chunk, "name") && chunk.includes("settings"));
  return blockChunks.map((chunk) => ({
    type: matchString(chunk, "type") ?? "block",
    name: matchString(chunk, "name") ?? "Block",
    settings: parseSettingObjects(getArrayBlock(chunk, "settings") ?? "").map((setting) => ({ group: "Block", ...setting })),
  }));
}

function parseDefaultBlocks(source: string) {
  const match = source.match(/defaultBlocks:\s*\[([\s\S]*?)\]\s*,?\s*(?:maxBlocks|};)/);
  if (!match) return [];
  return [...(match[1] ?? "").matchAll(/\{\s*type:\s*["']([^"']+)["']\s*,\s*settings:\s*\{([\s\S]*?)\}\s*\}/g)].map((block) => ({
    type: block[1],
    settings: parseObjectProperties(block[2] ?? ""),
  }));
}

function parseSettingObjectsBetween(source: string, key: string) {
  return parseSettingObjects(getArrayBlock(source, key) ?? "");
}

function parseSettingObjects(source: string): Array<Record<string, unknown>> {
  return getObjectLiterals(source).filter((chunk) => !chunk.includes("settings:") && matchString(chunk, "type") && matchString(chunk, "id") && matchString(chunk, "label")).map((chunk) => {
    const setting: Record<string, unknown> = {
      type: matchString(chunk, "type") ?? "text",
      id: matchString(chunk, "id") ?? "",
      label: matchString(chunk, "label") ?? "Setting",
    };
    const defaultValue = matchDefault(chunk);
    if (defaultValue !== undefined) setting.default = defaultValue;
    const min = matchNumber(chunk, "min");
    const max = matchNumber(chunk, "max");
    const step = matchNumber(chunk, "step");
    const unit = matchString(chunk, "unit");
    const options = parseOptions(chunk);
    if (min !== undefined) setting.min = min;
    if (max !== undefined) setting.max = max;
    if (step !== undefined) setting.step = step;
    if (unit) setting.unit = unit;
    if (options.length) setting.options = options;
    return setting;
  });
}

function getObjectLiterals(source: string) {
  const chunks: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{") continue;
    const end = findMatching(source, index, "{", "}");
    if (end > index) {
      chunks.push(source.slice(index, end + 1));
    }
  }
  return chunks;
}

function parseOptions(source: string) {
  const block = getArrayBlock(source, "options");
  if (!block) return [];
  const objectOptions = [...block.matchAll(/\{\s*value:\s*["']([^"']+)["']\s*,\s*label:\s*["']([^"']+)["']/g)].map((optionMatch) => ({
    value: optionMatch[1] ?? "",
    label: optionMatch[2] ?? "",
  }));
  if (objectOptions.length) return objectOptions;
  return [...block.matchAll(/["']([^"']+)["']/g)].map((optionMatch) => optionMatch[1] ?? "");
}

function getArrayBlock(source: string, key: string) {
  const start = source.indexOf(`${key}:`);
  if (start < 0) return undefined;
  const arrayStart = source.indexOf("[", start);
  if (arrayStart < 0) return undefined;
  const arrayEnd = findMatching(source, arrayStart, "[", "]");
  return source.slice(arrayStart + 1, arrayEnd);
}

function parseObjectProperties(source: string) {
  const entries = [...source.matchAll(/([A-Za-z0-9_]+):\s*(["'])([\s\S]*?)\2/g)].map((match) => [match[1], match[3]]);
  return Object.fromEntries(entries);
}

function parseRecordDefinition(source: string, key: string) {
  const match = source.match(new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\}\\s*,`));
  if (!match) return [];
  return [...(match[1] ?? "").matchAll(/["']?([A-Za-z0-9_-]+)["']?\s*:\s*["']([^"']+)["']/g)].map((entry) => [entry[1] ?? "", entry[2] ?? ""] as [string, string]);
}

function matchString(source: string, key: string) {
  return source.match(new RegExp(`${key}:\\s*["']([^"']+)["']`))?.[1];
}

function matchNumber(source: string, key: string) {
  const value = source.match(new RegExp(`${key}:\\s*([0-9.]+)`))?.[1];
  return value === undefined ? undefined : Number(value);
}

function matchDefault(source: string) {
  const raw = source.match(/default:\s*(true|false|[0-9.]+|["']([\s\S]*?)["'])/)?.[1];
  if (raw === undefined) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^[0-9.]+$/.test(raw)) return Number(raw);
  return raw.replace(/^["']|["']$/g, "");
}

function findMatching(source: string, start: number, open: string, close: string) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    if (source[index] === close) depth -= 1;
    if (depth === 0) return index;
  }
  return source.length;
}

function inferSettingGroup(source: string, id: string) {
  const before = source.slice(0, source.indexOf(`id: "${id}"`) > -1 ? source.indexOf(`id: "${id}"`) : source.indexOf(`id: '${id}'`));
  return before.match(/header:\s*["']([^"']+)["'][\s\S]*?settings:\s*\[[\s\S]*$/)?.[1] ?? "Settings";
}

function normalizeEngineVersion(value: string) {
  return value.replace(/^[^0-9]*/, "").split(".")[0] || "1";
}

function slugThemeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "uploaded-theme";
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function componentName(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, " ").split(" ").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("");
}
