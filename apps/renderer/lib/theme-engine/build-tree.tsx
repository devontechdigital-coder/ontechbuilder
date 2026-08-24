import * as React from "react";
import { transpileThemeModule } from "./transpile";
import { parseThemeEngineManifest } from "./manifest";
import { resolveThemeRenderer } from "./theme-renderer";
import { getAllGroupSections } from "./state";
import type { SectionBlock, SectionGroups, SectionInstance } from "./types";

/**
 * The theme-source-to-React-tree logic shared by the server render path
 * (render.tsx, finishes with renderToStaticMarkup) and the client mount
 * path (app/theme-client-mount.tsx, finishes with createRoot().render()).
 * Split out specifically so this file — unlike render.tsx — has no
 * react-dom/server import anywhere in it, and is safe for a "use client"
 * component to import directly without pulling server-only code into the
 * client bundle.
 */

const THEME_LAYOUT_PATH = "layout/ThemeLayout.tsx";
const SECTION_REGISTRY_PATH = "components/sectionRegistry.tsx";
/** Optional — only themes that keep header/footer in their own `partials/` directory (see schema-parser.ts's isSectionSchemaPath) ship this. */
const PARTIAL_REGISTRY_PATH = "components/partialRegistry.tsx";
const SETTINGS_DEFAULT_PATH = "config/settings.default.ts";
const THEME_CSS_PATH = "assets/styles/theme.css";

export type RenderThemePageInput = {
  /** ThemeVersion.files (or ThemeDraft.files) — the theme's full uploaded source, path -> content. */
  files: Record<string, string>;
  /** ThemeVersion.manifest (or ThemeDraft.manifest) — includes `.id` (used to detect curated themes) and, for uploaded themes, parsed section schemas. */
  storedManifest: unknown;
  /** ThemeVersion.settings (or ThemeDraft.settings) — the full customizer settings blob: flat global settings plus nested `customizer.pages.{pageKey}.sections` / `customizer.global.{header|footer}.sections`. */
  customizerSettings: Record<string, unknown>;
  /** Theme template id for this page (e.g. "index", "page", "about"). */
  templateId: string;
  /** Storage key for this page's section content — the real page id for CMS pages. */
  pageKey: string;
  /** The page's real name — some templates (a generic "page" template's own title header) render this directly; omitting it renders an empty heading that still takes up its section's full padding. */
  pageTitle?: string;
};

export type BuiltThemedTree = {
  tree: React.ReactElement;
  css: string;
  faviconUrl: string | null;
};

type ModuleRecord = { exports: Record<string, unknown> };

/** Theme components come from `new Function`-loaded modules, so their prop types can't be known statically beyond "some props object". */
type ThemeComponent = React.ComponentType<Record<string, unknown>>;

function resolveModulePath(fromPath: string, spec: string, moduleSources: Record<string, string>): string | null {
  if (spec.charAt(0) !== ".") return null;
  const fromDir = fromPath.split("/").slice(0, -1).join("/");
  const joined = fromDir ? `${fromDir}/${spec}` : spec;
  const parts = joined.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  const base = stack.join("/");
  const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`];
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(moduleSources, candidate)) return candidate;
  }
  return null;
}

/** Builds a require()-style loader over the theme's transpiled module sources — same resolution rules as build-bundle.ts's browser loader, via `new Function` (works identically in Node and in the browser). */
function createThemeRequire(moduleSources: Record<string, string>) {
  const cache = new Map<string, ModuleRecord>();

  function requireModule(fromPath: string, spec: string): unknown {
    if (spec === "react") return React;
    const resolved = resolveModulePath(fromPath, spec, moduleSources);
    if (!resolved) throw new Error(`Cannot resolve "${spec}" from "${fromPath}"`);
    const cached = cache.get(resolved);
    if (cached) return cached.exports;
    const mod: ModuleRecord = { exports: {} };
    cache.set(resolved, mod);
    const factory = new Function("module", "exports", "require", "React", moduleSources[resolved] as string);
    factory(mod, mod.exports, (nextSpec: string) => requireModule(resolved, nextSpec), React);
    return mod.exports;
  }

  return { requireModule, cache };
}

function flattenBlock(block: SectionBlock): Record<string, unknown> {
  return { id: block.id, type: block.type, depth: block.depth ?? 0, ...block.settings };
}

/** "design" + capital letter is the reserved prefix for platform-injected style overrides (see buildDesignStylesCss) — never spread into a section's own props. */
function isDesignKey(key: string) {
  return key.length > 6 && key.slice(0, 6) === "design" && key.charAt(6) === key.charAt(6).toUpperCase();
}

function buildSectionProps(section: SectionInstance, blocksPropBySchemaId: Record<string, string | null>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(section.settings)) {
    if (isDesignKey(key)) continue;
    props[key] = value;
  }
  const blocksProp = blocksPropBySchemaId[section.schemaId];
  if (blocksProp) props[blocksProp] = section.blocks.map(flattenBlock);
  return props;
}

type ThemeInstance = { id: string; type: string; props: Record<string, unknown> };

/** Dashboard-shaped SectionInstance[] -> the theme's own {id,type,props} shape, dropping disabled sections. */
function toThemeInstances(sections: SectionInstance[], blocksPropBySchemaId: Record<string, string | null>): ThemeInstance[] {
  return sections.filter((section) => section.enabled).map((section) => ({ id: section.id, type: section.schemaId, props: buildSectionProps(section, blocksPropBySchemaId) }));
}

/**
 * A theme with several header/footer designs (see schema-parser.ts's isSectionSchemaPath) picks
 * the live one through a global setting rather than the header/footer group's instance list (e.g.
 * Copora's "headerVariant": "classic" | "dentora" | "skyvilla" selects between the
 * "header"/"header-dentora"/"header-skyvilla" partials) — so if the merchant has added more than
 * one header/footer instance, only render whichever one that setting currently points at, rather
 * than stacking all of them. Themes with just one instance (the common case) are unaffected.
 * Mirrors theme-engine/build-bundle.ts's pickActiveVariant (the customizer's client-side copy).
 */
function pickActiveVariant(instances: ThemeInstance[], groupName: string, settings: Record<string, unknown>): ThemeInstance[] {
  if (instances.length <= 1) return instances;
  let variantKey: string | undefined;
  for (const key of Object.keys(settings)) {
    const lower = key.toLowerCase();
    if (lower.indexOf(groupName) === 0 && (lower.includes("variant") || lower.includes("style") || lower.includes("layout"))) {
      variantKey = key;
      break;
    }
  }
  if (!variantKey) return instances;
  const value = String(settings[variantKey] ?? "").toLowerCase();
  if (!value) return instances;
  const specific = instances.filter((instance) => instance.type === `${groupName}-${value}`);
  if (specific.length) return specific;
  const canonical = instances.filter((instance) => instance.type === groupName);
  return canonical.length ? canonical : instances;
}

/** If one section throws while rendering, this confines the damage to that section instead of failing the whole page. */
class SectionBoundary extends React.Component<{ label: string; children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            margin: "12px",
            padding: "20px",
            border: "1px dashed #dc2626",
            borderRadius: "8px",
            color: "#b91c1c",
            background: "#fef2f2",
            fontFamily: "system-ui, sans-serif",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          &quot;{this.props.label}&quot; section failed to render: {this.state.error.message || String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

function wrapInstances(instances: ThemeInstance[], registry: Record<string, ThemeComponent>): React.ReactNode {
  return instances.map((instance) => {
    const Component = registry[instance.type];
    if (!Component) return null;
    return (
      <div key={instance.id} data-theme-section-id={instance.id} style={{ display: "contents" }}>
        <SectionBoundary label={instance.type}>
          <Component {...instance.props} />
        </SectionBoundary>
      </div>
    );
  });
}

function cssEscapeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/** build-bundle.ts's applyDesignStyles, ported: same per-section design-override fields, rendered as a CSS string instead of injected via the DOM. */
function buildDesignStylesCss(groups: SectionGroups): string {
  const rules: string[] = [];
  const allSections = [...groups.header, ...groups.template, ...groups.footer];
  for (const section of allSections) {
    const s = section.settings as Record<string, unknown>;
    const sel = `[data-theme-section-id="${cssEscapeId(section.id)}"]`;

    const boxDecls: string[] = [];
    if (s.designPaddingTop != null) boxDecls.push(`padding-top:${s.designPaddingTop}px`);
    if (s.designPaddingRight != null) boxDecls.push(`padding-right:${s.designPaddingRight}px`);
    if (s.designPaddingBottom != null) boxDecls.push(`padding-bottom:${s.designPaddingBottom}px`);
    if (s.designPaddingLeft != null) boxDecls.push(`padding-left:${s.designPaddingLeft}px`);
    if (s.designMarginTop != null) boxDecls.push(`margin-top:${s.designMarginTop}px`);
    if (s.designMarginBottom != null) boxDecls.push(`margin-bottom:${s.designMarginBottom}px`);
    if (s.designBgColor) boxDecls.push(`background-color:${s.designBgColor}`);
    const bgImage = s.designBgImage && typeof s.designBgImage === "object" ? (s.designBgImage as { src?: string }).src : "";
    if (bgImage) boxDecls.push(`background-image:url(${JSON.stringify(bgImage)})`);
    if (s.designBgSize) boxDecls.push(`background-size:${s.designBgSize}`);
    if (s.designBgAttachment) boxDecls.push(`background-attachment:${s.designBgAttachment}`);
    if (boxDecls.length) rules.push(`${sel} > * {${boxDecls.join(";")};}`);

    const allDecls: string[] = [];
    if (s.designAllFontFamily) allDecls.push(`font-family:${s.designAllFontFamily}`);
    if (s.designAllFontSize != null) allDecls.push(`font-size:${s.designAllFontSize}px`);
    if (s.designAllFontWeight) allDecls.push(`font-weight:${s.designAllFontWeight}`);
    if (s.designAllColor) allDecls.push(`color:${s.designAllColor}`);
    if (allDecls.length) rules.push(`${sel}, ${sel} * {${allDecls.join(";")};}`);

    const headingDecls: string[] = [];
    if (s.designHeadingFontFamily) headingDecls.push(`font-family:${s.designHeadingFontFamily}`);
    if (s.designHeadingFontSize != null) headingDecls.push(`font-size:${s.designHeadingFontSize}px`);
    if (s.designHeadingFontWeight) headingDecls.push(`font-weight:${s.designHeadingFontWeight}`);
    if (s.designHeadingColor) headingDecls.push(`color:${s.designHeadingColor}`);
    if (headingDecls.length) rules.push(`${sel} h1, ${sel} h2, ${sel} h3, ${sel} h4 {${headingDecls.join(";")};}`);

    const paraDecls: string[] = [];
    if (s.designParagraphFontFamily) paraDecls.push(`font-family:${s.designParagraphFontFamily}`);
    if (s.designParagraphFontSize != null) paraDecls.push(`font-size:${s.designParagraphFontSize}px`);
    if (s.designParagraphFontWeight) paraDecls.push(`font-weight:${s.designParagraphFontWeight}`);
    if (s.designParagraphColor) paraDecls.push(`color:${s.designParagraphColor}`);
    if (paraDecls.length) rules.push(`${sel} p {${paraDecls.join(";")};}`);
  }
  return rules.join(" ");
}

/**
 * Transpiles the theme's real source and builds the exact React element tree for one page —
 * everything render.tsx (server, finishes with renderToStaticMarkup) and theme-client-mount.tsx
 * (browser, finishes with createRoot().render()) share. Running this twice (once server-side for
 * the fast-paint static HTML, once client-side to mount a live root) is deliberate — see item 2's
 * "client remount" approach: no hydration-matching is required, so the two passes only need to
 * agree closely enough that the swap isn't jarring, not byte-for-byte.
 */
export function buildThemedTree(input: RenderThemePageInput): BuiltThemedTree {
  const { files, storedManifest, customizerSettings, templateId, pageKey } = input;

  const engineManifest = parseThemeEngineManifest(files);
  const moduleSources: Record<string, string> = {};
  for (const [path, source] of Object.entries(files)) {
    if (!/\.(tsx|ts)$/.test(path)) continue;
    try {
      moduleSources[path] = transpileThemeModule(path, source);
    } catch (error) {
      const message = `Failed to compile ${path}: ${error instanceof Error ? error.message : String(error)}`;
      moduleSources[path] = `throw new Error(${JSON.stringify(message)});`;
    }
  }

  const { requireModule, cache } = createThemeRequire(moduleSources);

  const layoutModule = requireModule("__root__", `./${THEME_LAYOUT_PATH}`) as { ThemeLayout?: ThemeComponent };
  const ThemeLayout = layoutModule.ThemeLayout;
  if (!ThemeLayout) throw new Error(`Theme has no ThemeLayout export at ${THEME_LAYOUT_PATH}`);

  const registryModule = requireModule("__root__", `./${SECTION_REGISTRY_PATH}`) as { sectionRegistry?: Record<string, ThemeComponent> };
  let registry = registryModule.sectionRegistry;
  if (!registry) throw new Error(`Theme has no sectionRegistry export at ${SECTION_REGISTRY_PATH}`);

  // Some themes keep header/footer (and any per-vertical variants of them) in their own
  // partials/ directory with a separate partialRegistry.tsx, rather than folding them into
  // sectionRegistry. Their instance types never collide with body section ids, so merging is
  // safe; without this, header/footer group instances would look up nothing in the registry
  // and wrapInstances would render them as nothing at all.
  if (files[PARTIAL_REGISTRY_PATH]) {
    const partialModule = requireModule("__root__", `./${PARTIAL_REGISTRY_PATH}`) as { partialRegistry?: Record<string, ThemeComponent> };
    if (partialModule.partialRegistry) registry = { ...registry, ...partialModule.partialRegistry };
  }

  // Templates call their own RenderSections internally (some, like page.tsx,
  // wrap it with extra template-specific markup) — swap in a version that
  // wraps each section the same way header/footer are wrapped below, so a
  // template-composed body gets the same click-target divs and error
  // boundaries without us having to bypass the template's own composition.
  cache.set(SECTION_REGISTRY_PATH, {
    exports: {
      sectionRegistry: registry,
      RenderSections: (props: { sections: ThemeInstance[] }) => <>{wrapInstances(props.sections, registry)}</>,
    },
  });

  let settings: Record<string, unknown> = {};
  if (files[SETTINGS_DEFAULT_PATH]) {
    const defaultsModule = requireModule("__root__", `./${SETTINGS_DEFAULT_PATH}`) as { default?: Record<string, unknown> };
    settings = { ...(defaultsModule.default ?? {}) };
  }
  for (const [key, value] of Object.entries(customizerSettings)) {
    if (key === "customizer") continue; // the nested section-storage namespace, not a flat global setting
    settings[key] = value;
  }

  const templatePath = engineManifest.templatePaths[templateId];
  if (!templatePath) throw new Error(`Unknown template "${templateId}"`);
  const templateModule = requireModule("__root__", `./${templatePath}`) as { default?: ThemeComponent };
  const TemplateComponent = templateModule.default;
  if (!TemplateComponent) throw new Error(`Template has no default export: ${templatePath}`);

  const { sectionSchemas, getTemplateScope } = resolveThemeRenderer(null, { manifest: storedManifest as never, files });
  const groups = getAllGroupSections(customizerSettings, pageKey, sectionSchemas, getTemplateScope(templateId));

  const headerInstances = pickActiveVariant(toThemeInstances(groups.header, engineManifest.blocksPropBySchemaId), "header", settings);
  const footerInstances = pickActiveVariant(toThemeInstances(groups.footer, engineManifest.blocksPropBySchemaId), "footer", settings);
  const header = wrapInstances(headerInstances, registry);
  const footer = wrapInstances(footerInstances, registry);
  const bodySections = toThemeInstances(groups.template, engineManifest.blocksPropBySchemaId);

  const tree = (
    <ThemeLayout settings={settings} header={<>{header}</>} footer={<>{footer}</>}>
      <TemplateComponent title={input.pageTitle ?? ""} sections={bodySections} query="" results={[]} resultCount={0} />
    </ThemeLayout>
  );

  const themeCss = files[THEME_CSS_PATH] ?? "";
  const designCss = buildDesignStylesCss(groups);
  const favicon = settings.favicon;
  const faviconUrl = favicon && typeof favicon === "object" ? ((favicon as { src?: string }).src ?? null) : null;

  return { tree, css: `${themeCss}\n${designCss}`, faviconUrl };
}
