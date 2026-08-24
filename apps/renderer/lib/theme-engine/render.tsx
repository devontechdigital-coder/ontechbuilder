import { buildThemedTree } from "./build-tree";
export type { RenderThemePageInput } from "./build-tree";

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
 * The actual theme-source-to-React-tree logic (transpile, require() loader,
 * section/header/footer assembly) lives in build-tree.ts, shared with
 * app/theme-client-mount.tsx — this file just finishes that shared tree
 * with `renderToStaticMarkup` for the fast-paint server pass. The client
 * mount then re-runs the same build client-side and swaps in a live root
 * (see item 2 / "client remount" in the PR notes) so section-local
 * useState/onClick (an FAQ accordion, a mobile nav toggle, ...) actually
 * work on the public site, not just in the customizer's iframe.
 *
 * These vendored files (state.ts, schema-parser.ts, theme-renderer.ts,
 * manifest.ts, transpile.ts, types.ts, build-tree.ts) are a deliberate copy
 * of the customizer's pure logic, not a shared package — see repo notes on
 * the tradeoff. Keep them in sync by hand if the source changes shape.
 */

export type RenderedThemePage = {
  html: string;
  css: string;
  faviconUrl: string | null;
};

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
 * Renders one page of a published theme to a static HTML string, for the fast first paint /
 * crawlers. app/theme-client-mount.tsx re-runs buildThemedTree client-side and mounts a live
 * root over this same markup once it's ready, so real interactivity isn't limited to this pass.
 */
export async function renderThemePage(input: import("./build-tree").RenderThemePageInput): Promise<RenderedThemePage> {
  const renderToStaticMarkup = await getRenderToStaticMarkup();
  const { tree, css, faviconUrl } = buildThemedTree(input);
  const html = renderToStaticMarkup(tree);
  return { html, css, faviconUrl };
}
