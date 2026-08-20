import * as React from "react";
import { transpileThemeModule } from "./transpile";
import { parseThemeEngineManifest } from "./manifest";
import { resolveThemeRenderer } from "./theme-renderer";
import { getAllGroupSections } from "./state";
import type { SectionBlock, SectionGroups, SectionInstance } from "./types";

/**
 * Server-side counterpart to
 * apps/web/features/websites/customizer/theme-engine/build-bundle.ts.
 *
 * That file builds an HTML document for a SANDBOXED IFRAME: real
 * `theme.tsx` source is transpiled to CommonJS strings, shipped to the
 * browser as data, and `new Function(...)` + a tiny require() loader
 * turns it back into runnable React there — because the customizer needs
 * live postMessage editing inside an opaque-origin iframe.
 *
 * A public page render has none of that: it happens once, server-side,
 * from data that's already final. So this module reuses the exact same
 * transpile-and-require trick (it's just plain JS, works fine in Node),
 * but skips everything iframe/postMessage/click-to-select specific, and
 * finishes with `renderToStaticMarkup` instead of a client React root.
 *
 * These vendored files (state.ts, schema-parser.ts, theme-renderer.ts,
 * manifest.ts, transpile.ts, types.ts) are a deliberate copy of the
 * customizer's pure logic, not a shared package — see repo notes on the
 * tradeoff. Keep them in sync by hand if the source changes shape.
 */

const THEME_LAYOUT_PATH = "layout/ThemeLayout.tsx";
const SECTION_REGISTRY_PATH = "components/sectionRegistry.tsx";
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
};

export type RenderedThemePage = {
  html: string;
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

/** Builds a require()-style loader over the theme's transpiled module sources — same resolution rules as build-bundle.ts's browser loader, running here in plain Node via `new Function`. */
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

/** Server-side port of build-bundle.ts's applyDesignStyles: same per-section design-override fields, rendered as a CSS string instead of injected via the DOM. */
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

// Next's App Router build guard rejects any STATIC `react-dom/server` import
// reachable from a Server Component — even a legitimate one-off manual
// render like this. A dynamic import isn't statically analyzable the same
// way, which is the standard workaround; cached so it only resolves once.
let renderToStaticMarkupPromise: Promise<typeof import("react-dom/server").renderToStaticMarkup> | null = null;
function getRenderToStaticMarkup() {
  renderToStaticMarkupPromise ??= import("react-dom/server").then((mod) => mod.renderToStaticMarkup);
  return renderToStaticMarkupPromise;
}

/**
 * Renders one page of a published theme to a static HTML string.
 *
 * No client hydration: sections that need real interactivity (a mobile
 * nav toggle, a carousel) will render their initial/closed state only,
 * same as any section that fails would show the SectionBoundary message
 * instead of taking the page down. That's a known, deliberate limit of
 * this first pass — see the surrounding PR notes.
 */
export async function renderThemePage(input: RenderThemePageInput): Promise<RenderedThemePage> {
  const renderToStaticMarkup = await getRenderToStaticMarkup();
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
  const registry = registryModule.sectionRegistry;
  if (!registry) throw new Error(`Theme has no sectionRegistry export at ${SECTION_REGISTRY_PATH}`);

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

  const header = wrapInstances(toThemeInstances(groups.header, engineManifest.blocksPropBySchemaId), registry);
  const footer = wrapInstances(toThemeInstances(groups.footer, engineManifest.blocksPropBySchemaId), registry);
  const bodySections = toThemeInstances(groups.template, engineManifest.blocksPropBySchemaId);

  const tree = (
    <ThemeLayout settings={settings} header={<>{header}</>} footer={<>{footer}</>}>
      <TemplateComponent sections={bodySections} query="" results={[]} resultCount={0} />
    </ThemeLayout>
  );

  const html = renderToStaticMarkup(tree);
  const themeCss = files[THEME_CSS_PATH] ?? "";
  const designCss = buildDesignStylesCss(groups);
  const favicon = settings.favicon;
  const faviconUrl = favicon && typeof favicon === "object" ? ((favicon as { src?: string }).src ?? null) : null;

  return { html, css: `${themeCss}\n${designCss}`, faviconUrl };
}
