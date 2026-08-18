import { transpileThemeModule } from "./transpile";
import { parseThemeEngineManifest, type ThemeEngineManifest } from "./manifest";

const THEME_CSS_PATH = "assets/styles/theme.css";
const THEME_LAYOUT_PATH = "layout/ThemeLayout.tsx";
const SECTION_REGISTRY_PATH = "components/sectionRegistry.tsx";
const SETTINGS_DEFAULT_PATH = "config/settings.default.ts";

export type ThemeEngineBundle = {
  html: string;
  manifest: ThemeEngineManifest;
};

/**
 * Everything below runs inside the sandboxed grandchild iframe
 * (`sandbox="allow-scripts"`, no `allow-same-origin` -> opaque origin, no
 * access to dashboard cookies/storage). It is fully authored here — the
 * theme's own code only ever reaches this document as data (a JSON string
 * of transpiled module sources), never as literal inlined script text, so
 * nothing the theme's source contains can break out of this script block.
 */
const BOOTSTRAP_SCRIPT = `
(function () {
  "use strict";
  var vendor = window.__THEME_ENGINE_VENDOR__;
  var React = vendor.React;
  var ReactDOMClient = vendor.ReactDOM;
  var jsxRuntime = vendor.ReactJsxRuntime;
  var DATA = window.__THEME_ENGINE_DATA__;
  var moduleSources = DATA.moduleSources;
  var manifest = DATA.manifest;
  var parentOrigin = DATA.parentOrigin;

  function resolvePath(fromPath, spec) {
    if (spec.charAt(0) !== ".") return null;
    var fromDir = fromPath.split("/").slice(0, -1).join("/");
    var joined = fromDir ? fromDir + "/" + spec : spec;
    var parts = joined.split("/");
    var stack = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === "" || part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    var base = stack.join("/");
    var candidates = [base, base + ".tsx", base + ".ts", base + "/index.tsx", base + "/index.ts"];
    for (var j = 0; j < candidates.length; j++) {
      if (Object.prototype.hasOwnProperty.call(moduleSources, candidates[j])) return candidates[j];
    }
    return null;
  }

  // Block-level click-to-select needs a marker in the DOM around whatever
  // element each theme component renders per-block, but that render loop is
  // the theme's own code (e.g. StatsRow.tsx mapping its blocks) — we have no
  // hook into it directly. Every one of those loops keys its output with
  // key={block.id} (ordinary React list-key hygiene, already present in
  // every section verified against the real theme). Patching createElement
  // for THEME modules only (never for our own trusted wrapping code below)
  // lets us catch that exact call and wrap it, with no cooperation needed
  // from the theme beyond a convention it already follows.
  var knownSectionIds = {};
  var knownBlockIds = {};
  var themeReact = Object.assign({}, React, {
    createElement: function (type, config) {
      var key = config && config.key;
      if (key != null && Object.prototype.hasOwnProperty.call(knownSectionIds, key)) {
        var sectionInner = React.createElement.apply(React, arguments);
        return React.createElement("div", { key: key, "data-theme-section-id": key, style: { display: "contents" } }, sectionInner);
      }
      if (key != null && Object.prototype.hasOwnProperty.call(knownBlockIds, key)) {
        var inner = React.createElement.apply(React, arguments);
        return React.createElement("div", { key: key, "data-theme-block-id": key, style: { display: "contents" } }, inner);
      }
      return React.createElement.apply(React, arguments);
    },
  });

  var moduleCache = {};
  function requireModule(fromPath, spec) {
    if (spec === "react") return themeReact;
    if (spec === "react/jsx-runtime" || spec === "react/jsx-dev-runtime") return jsxRuntime;
    var resolved = resolvePath(fromPath, spec);
    if (!resolved) throw new Error('Cannot resolve "' + spec + '" from "' + fromPath + '"');
    if (moduleCache[resolved]) return moduleCache[resolved].exports;
    var mod = { exports: {} };
    moduleCache[resolved] = mod;
    var factory = new Function("module", "exports", "require", "React", moduleSources[resolved]);
    factory(mod, mod.exports, function (nextSpec) { return requireModule(resolved, nextSpec); }, themeReact);
    return mod.exports;
  }

  function flattenBlock(block) {
    // depth carries the drag-assigned nav hierarchy through to the theme,
    // which rebuilds the tree from this flat list.
    var flat = { id: block.id, type: block.type, depth: block.depth || 0 };
    for (var key in block.settings) if (Object.prototype.hasOwnProperty.call(block.settings, key)) flat[key] = block.settings[key];
    return flat;
  }

  // "design" + capital letter (designPaddingTop, designBgColor, ...) is the
  // reserved prefix for the universal Design tab's fields (see
  // SECTION_DESIGN_FIELDS in customizer/design-fields.ts) — platform-injected
  // CSS overrides the theme itself has no schema entry for and never asked to
  // receive, so they're applied via generated CSS (applyDesignStyles) instead
  // of being spread in here like an ordinary setting.
  function isDesignKey(key) {
    return key.length > 6 && key.slice(0, 6) === "design" && key.charAt(6) === key.charAt(6).toUpperCase();
  }

  function buildSectionProps(section) {
    var props = {};
    for (var key in section.settings) {
      if (!Object.prototype.hasOwnProperty.call(section.settings, key)) continue;
      if (isDesignKey(key)) continue;
      props[key] = section.settings[key];
    }
    var blocksProp = manifest.blocksPropBySchemaId[section.schemaId];
    if (blocksProp) props[blocksProp] = section.blocks.map(flattenBlock);
    return props;
  }

  // Dashboard-shaped SectionInstance[] (id/schemaId/settings/blocks/enabled)
  // -> the theme's own SectionInstance shape (id/type/props), dropping
  // disabled sections.
  function toThemeInstances(sections) {
    var out = [];
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!section.enabled) continue;
      out.push({ id: section.id, type: section.schemaId, props: buildSectionProps(section) });
    }
    return out;
  }

  // If one section throws while rendering (bad data, a theme bug, an edit
  // that hits an edge case), the default React behavior is to unmount the
  // ENTIRE tree — this boundary confines the damage to that one section, so
  // an edit that breaks one section doesn't blank the whole canvas.
  class SectionBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error: error };
    }
    componentDidCatch(error) {
      console.error("[theme-engine] section failed to render:", this.props.label, error);
    }
    render() {
      if (this.state.error) {
        return React.createElement(
          "div",
          {
            style: {
              margin: "12px",
              padding: "20px",
              border: "1px dashed #dc2626",
              borderRadius: "8px",
              color: "#b91c1c",
              background: "#fef2f2",
              fontFamily: "system-ui, sans-serif",
              fontSize: "13px",
              lineHeight: 1.5,
            },
          },
          '"' + this.props.label + '" section failed to render: ' + (this.state.error.message || String(this.state.error)),
        );
      }
      return this.props.children;
    }
  }

  // Renders theme-shaped instances through the theme's own registry, each
  // wrapped in a layout-transparent (display:contents) div carrying a
  // data-theme-section-id so canvas clicks can be attributed to a section
  // without touching the theme's own box model, and an error boundary so a
  // broken section shows an inline message instead of taking down the page.
  function wrapInstances(instances, registry) {
    var nodes = [];
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      var Component = registry[inst.type];
      if (!Component) continue;
      nodes.push(
        React.createElement(
          "div",
          { key: inst.id, "data-theme-section-id": inst.id, style: { display: "contents" } },
          React.createElement(SectionBoundary, { label: inst.type }, React.createElement(Component, inst.props)),
        ),
      );
    }
    return nodes;
  }

  var reactRoot = null;
  var currentEditable = false;

  function reportError(message) {
    window.parent.postMessage({ type: "themeFrame:error", message: message }, parentOrigin);
  }

  function collectBlockIds(sections) {
    for (var i = 0; i < sections.length; i++) {
      var blocks = sections[i].blocks || [];
      for (var j = 0; j < blocks.length; j++) knownBlockIds[blocks[j].id] = true;
    }
  }

  function collectSectionIds(sections) {
    for (var i = 0; i < sections.length; i++) knownSectionIds[sections[i].id] = true;
  }

  // Shopify-style editing chrome: a blue outline drawn around whatever's
  // selected, and a small toolbar anchored right below it (Add/Duplicate/
  // Up/Down/Hide/Delete). The wrapper divs from wrapInstances are
  // display:contents (no box of their own, so the theme's real layout is
  // untouched), which means they can't be measured or bordered directly —
  // so this overlay lives in its own React root, mounted to a plain div
  // appended to <body>, and positions itself with position:fixed using the
  // real bounding rect of the wrapper's rendered child. It never modifies
  // the theme's own DOM.
  var overlayRoot = null;
  function ensureOverlayRoot() {
    if (overlayRoot) return overlayRoot;
    var container = document.createElement("div");
    container.id = "theme-engine-overlay-root";
    document.body.appendChild(container);
    overlayRoot = ReactDOMClient.createRoot(container);
    return overlayRoot;
  }

  function cssEscapeId(id) {
    return window.CSS && CSS.escape ? CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  }

  function findSelectedMeta(payload) {
    var selected = payload.selected;
    if (!selected || (selected.kind !== "section" && selected.kind !== "block")) return null;
    var groupNames = ["header", "template", "footer"];
    for (var g = 0; g < groupNames.length; g++) {
      var list = payload.groups[groupNames[g]];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === selected.sectionId) return { section: list[i], group: groupNames[g], index: i, total: list.length };
      }
    }
    return null;
  }

  // The wrapper div is display:contents (no box of its own), and the theme's
  // real markup for one section can be more than a single element (a
  // <header> plus an off-screen mobile-menu panel, a skip-link, etc.) — measuring
  // only firstElementChild silently breaks the whole overlay whenever that
  // first child happens to be zero-sized. Union the rects of every real
  // (non-zero-size) child instead, so the outline always tracks the section's
  // actual visible footprint.
  function unionRect(wrapper) {
    var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, found = false;
    for (var i = 0; i < wrapper.children.length; i++) {
      var r = wrapper.children[i].getBoundingClientRect();
      if (!r.width && !r.height) continue;
      found = true;
      if (r.left < left) left = r.left;
      if (r.top < top) top = r.top;
      if (r.right > right) right = r.right;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    if (!found) return wrapper.getBoundingClientRect();
    return { left: left, top: top, right: right, bottom: bottom, width: right - left, height: bottom - top };
  }

  function getSelectedRect(payload) {
    var selected = payload.selected;
    if (!selected || (selected.kind !== "section" && selected.kind !== "block")) return null;
    var attr = selected.kind === "block" ? "data-theme-block-id" : "data-theme-section-id";
    var id = selected.kind === "block" ? selected.blockId : selected.sectionId;
    var wrapper = document.querySelector("[" + attr + '="' + cssEscapeId(id) + '"]');
    if (!wrapper) return null;
    var rect = unionRect(wrapper);
    if (!rect.width && !rect.height) return null;
    return rect;
  }

  function sendAction(action) {
    window.parent.postMessage(Object.assign({ type: "themeFrame:action" }, action), parentOrigin);
  }

  // Inline styles can't express :hover/:active/:disabled, and this document has
  // no Tailwind — so the toolbar's look ships as one injected stylesheet,
  // written to match the dashboard's shadcn/ui tokens (zinc surface, subtle
  // ring, soft shadow) so the canvas chrome feels like part of the same app.
  var TOOLBAR_CSS = [
    ".te-bar{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;",
    "border-radius:12px;background:rgba(9,9,11,.92);border:1px solid rgba(255,255,255,.10);",
    "box-shadow:0 10px 34px rgba(0,0,0,.42),0 1px 2px rgba(0,0,0,.5);",
    "-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);",
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;pointer-events:auto;}",
    ".te-name{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
    "padding:0 8px 0 6px;font-size:11.5px;font-weight:600;letter-spacing:.01em;color:rgba(255,255,255,.62);}",
    ".te-sep{width:1px;align-self:stretch;margin:2px 3px;background:rgba(255,255,255,.10);}",
    ".te-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;",
    "padding:0;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.80);",
    "cursor:pointer;transition:background .13s ease,color .13s ease,transform .13s ease;}",
    ".te-btn:hover:not(:disabled){background:rgba(255,255,255,.12);color:#fff;}",
    ".te-btn:active:not(:disabled){transform:scale(.94);}",
    ".te-btn:focus-visible{outline:2px solid rgba(96,165,250,.9);outline-offset:1px;}",
    ".te-btn:disabled{opacity:.30;cursor:not-allowed;}",
    ".te-btn--danger:hover:not(:disabled){background:rgba(239,68,68,.92);color:#fff;}",
    ".te-btn--primary{background:rgba(255,255,255,.13);color:#fff;}",
    ".te-btn--primary:hover:not(:disabled){background:rgba(255,255,255,.22);}",
  ].join("");

  /** Lucide-style 24x24 stroke icons, so canvas chrome matches the dashboard's icon set. */
  var ICON_PATHS = {
    settings: ["M21 4H14", "M10 4H3", "M21 12H12", "M8 12H3", "M21 20H16", "M12 20H3", "M14 2v4", "M8 10v4", "M16 18v4"],
    up: ["M12 19V5", "M5 12l7-7 7 7"],
    down: ["M12 5v14", "M19 12l-7 7-7-7"],
    plus: ["M5 12h14", "M12 5v14"],
    copy: ["M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
    eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
    eyeOff: ["M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19", "M6.61 6.61A18.4 18.4 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.39-1.61", "M2 2l20 20"],
    trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
    close: ["M18 6 6 18", "M6 6l12 12"],
  };

  function icon(name) {
    var paths = ICON_PATHS[name] || [];
    var children = [];
    for (var i = 0; i < paths.length; i++) {
      children.push(React.createElement("path", { key: i, d: paths[i] }));
    }
    return React.createElement(
      "svg",
      { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
      children,
    );
  }

  function toolbarButton(key, iconName, label, onClick, options) {
    var settings = options || {};
    return React.createElement(
      "button",
      {
        key: key,
        type: "button",
        title: label,
        "aria-label": label,
        disabled: Boolean(settings.disabled),
        className: "te-btn" + (settings.variant ? " te-btn--" + settings.variant : ""),
        onClick: onClick,
      },
      icon(iconName),
    );
  }

  var designStyleEl = null;
  function applyDesignStyles(payload) {
    if (!designStyleEl) {
      designStyleEl = document.createElement("style");
      designStyleEl.id = "theme-engine-design-style";
      document.head.appendChild(designStyleEl);
    }
    var rules = [];
    var allSections = [].concat(payload.groups.header, payload.groups.template, payload.groups.footer);
    for (var i = 0; i < allSections.length; i++) {
      var section = allSections[i];
      var s = section.settings || {};
      var sel = '[data-theme-section-id="' + cssEscapeId(section.id) + '"]';

      var boxDecls = [];
      if (s.designPaddingTop != null) boxDecls.push("padding-top:" + s.designPaddingTop + "px");
      if (s.designPaddingRight != null) boxDecls.push("padding-right:" + s.designPaddingRight + "px");
      if (s.designPaddingBottom != null) boxDecls.push("padding-bottom:" + s.designPaddingBottom + "px");
      if (s.designPaddingLeft != null) boxDecls.push("padding-left:" + s.designPaddingLeft + "px");
      if (s.designMarginTop != null) boxDecls.push("margin-top:" + s.designMarginTop + "px");
      if (s.designMarginBottom != null) boxDecls.push("margin-bottom:" + s.designMarginBottom + "px");
      if (s.designBgColor) boxDecls.push("background-color:" + s.designBgColor);
      var bgImage = s.designBgImage && typeof s.designBgImage === "object" ? s.designBgImage.src : "";
      if (bgImage) boxDecls.push("background-image:url(" + JSON.stringify(bgImage) + ")");
      if (s.designBgSize) boxDecls.push("background-size:" + s.designBgSize);
      if (s.designBgAttachment) boxDecls.push("background-attachment:" + s.designBgAttachment);
      if (boxDecls.length) rules.push(sel + " > * {" + boxDecls.join(";") + ";}");

      var allDecls = [];
      if (s.designAllFontFamily) allDecls.push("font-family:" + s.designAllFontFamily);
      if (s.designAllFontSize != null) allDecls.push("font-size:" + s.designAllFontSize + "px");
      if (s.designAllFontWeight) allDecls.push("font-weight:" + s.designAllFontWeight);
      if (s.designAllColor) allDecls.push("color:" + s.designAllColor);
      if (allDecls.length) rules.push(sel + ", " + sel + " * {" + allDecls.join(";") + ";}");

      var headingDecls = [];
      if (s.designHeadingFontFamily) headingDecls.push("font-family:" + s.designHeadingFontFamily);
      if (s.designHeadingFontSize != null) headingDecls.push("font-size:" + s.designHeadingFontSize + "px");
      if (s.designHeadingFontWeight) headingDecls.push("font-weight:" + s.designHeadingFontWeight);
      if (s.designHeadingColor) headingDecls.push("color:" + s.designHeadingColor);
      if (headingDecls.length) rules.push(sel + " h1, " + sel + " h2, " + sel + " h3, " + sel + " h4 {" + headingDecls.join(";") + ";}");

      var paraDecls = [];
      if (s.designParagraphFontFamily) paraDecls.push("font-family:" + s.designParagraphFontFamily);
      if (s.designParagraphFontSize != null) paraDecls.push("font-size:" + s.designParagraphFontSize + "px");
      if (s.designParagraphFontWeight) paraDecls.push("font-weight:" + s.designParagraphFontWeight);
      if (s.designParagraphColor) paraDecls.push("color:" + s.designParagraphColor);
      if (paraDecls.length) rules.push(sel + " p {" + paraDecls.join(";") + ";}");
    }
    designStyleEl.textContent = rules.join(" ");
  }

  function renderOverlay(payload) {
    try {
      renderOverlayUnsafe(payload);
    } catch (error) {
      console.error("[theme-engine] overlay failed:", error);
      reportError("selection toolbar: " + (error && error.message ? error.message : String(error)));
    }
  }

  function renderOverlayUnsafe(payload) {
    var root = ensureOverlayRoot();
    if (!payload.editable) {
      console.log("[theme-engine] overlay: not editable, skipping");
      root.render(null);
      return;
    }
    var meta = findSelectedMeta(payload);
    var rect = meta ? getSelectedRect(payload) : null;
    console.log("[theme-engine] overlay: selected=", payload.selected, "meta found=", !!meta, "rect found=", !!rect, rect || "");
    if (!meta || !rect) {
      root.render(null);
      return;
    }
    // The border/toolbar track the selected section, not the viewport — once
    // it's scrolled fully out of view (no vertical overlap left) there's
    // nothing to anchor to, so hide rather than pin to a screen edge. Scroll
    // it back into view (or select a new section) and this re-evaluates via
    // the scroll/resize listeners already driving scheduleOverlayUpdate.
    var sectionInViewport = rect.bottom > 0 && rect.top < window.innerHeight;
    if (!sectionInViewport) {
      root.render(null);
      return;
    }
    var isBlock = payload.selected.kind === "block";
    var outline = React.createElement("div", {
      style: {
        position: "fixed",
        left: rect.left + "px",
        top: rect.top + "px",
        width: rect.width + "px",
        height: rect.height + "px",
        outline: "2px solid #2563eb",
        outlineOffset: "-1px",
        pointerEvents: "none",
        zIndex: 2147483646,
        boxSizing: "border-box",
      },
    });

    var items = [
      React.createElement("span", { key: "name", className: "te-name" }, meta.section.name + (isBlock ? " · block" : "")),
    ];
    // The sidebar's own inspector (or, once minimized, the floating panel it
    // hands off to) already shows the selected section's or block's settings
    // whenever it's on screen, so the gear would just duplicate it — it only
    // earns its place here once the sidebar is off-screen.
    if (payload.sidebarMinimized) {
      items.push(
        toolbarButton(
          "settings",
          "settings",
          isBlock ? "Block settings" : "Section settings",
          function () {
            sendAction(
              isBlock
                ? { action: "openSettings", sectionId: meta.section.id, blockId: payload.selected.blockId }
                : { action: "openSettings", sectionId: meta.section.id },
            );
          },
          { variant: "primary" },
        ),
      );
    }

    if (!isBlock) {
      items.push(
        React.createElement("span", { key: "sep1", className: "te-sep" }),
        toolbarButton("up", "up", "Move up", function () { sendAction({ action: "moveSection", sectionId: meta.section.id, direction: "up" }); }, { disabled: meta.index === 0 }),
        toolbarButton("down", "down", "Move down", function () { sendAction({ action: "moveSection", sectionId: meta.section.id, direction: "down" }); }, { disabled: meta.index === meta.total - 1 }),
        React.createElement("span", { key: "sep2", className: "te-sep" }),
        toolbarButton("add", "plus", "Add section after", function () { sendAction({ action: "addSection", group: meta.group, afterSectionId: meta.section.id }); }),
        toolbarButton("dup", "copy", "Duplicate section", function () { sendAction({ action: "duplicateSection", sectionId: meta.section.id }); }),
        toolbarButton("toggle", meta.section.enabled ? "eye" : "eyeOff", meta.section.enabled ? "Hide section" : "Show section", function () { sendAction({ action: "toggleSection", sectionId: meta.section.id }); }),
        React.createElement("span", { key: "sep3", className: "te-sep" }),
        toolbarButton("del", "trash", "Delete section", function () { sendAction({ action: "deleteSection", sectionId: meta.section.id }); }, { variant: "danger" }),
      );
    }
    items.push(
      React.createElement("span", { key: "sep4", className: "te-sep" }),
      toolbarButton("close", "close", "Close", function () { sendAction({ action: "deselect" }); }),
    );

    // Anchored to the END of the selected section rather than the viewport, so
    // the toolbar reads as belonging to that section. It only detaches to hug
    // the viewport edge when the section's bottom is scrolled out of view,
    // which keeps the controls reachable on sections taller than the screen.
    var BAR_H = 36;
    var MARGIN = 10;
    var anchored = rect.bottom - BAR_H - MARGIN;
    var maxTop = window.innerHeight - BAR_H - MARGIN;
    var minTop = Math.max(MARGIN, rect.top + MARGIN);
    var toolbarTop = Math.max(minTop, Math.min(anchored, maxTop));
    var toolbarLeft = Math.max(MARGIN, Math.min(rect.left + rect.width / 2, window.innerWidth - MARGIN));

    var toolbar = React.createElement(
      "div",
      { className: "te-bar", style: { top: toolbarTop + "px", left: toolbarLeft + "px", transform: "translateX(-50%)" } },
      items,
    );

    // No inline canvas fields panel: the actual Content/Design settings
    // render only in the dashboard's own React sidebar / floating panel
    // (real Tailwind + shadcn/ui there), which stay in sync with the
    // selection above — showing them again here would just duplicate that surface.
    root.render(React.createElement(React.Fragment, null, outline, toolbar));
  }

  var lastPayload = null;
  function scheduleOverlayUpdate() {
    if (!lastPayload) return;
    window.requestAnimationFrame(function () { renderOverlay(lastPayload); });
  }
  window.addEventListener("scroll", scheduleOverlayUpdate, true);
  window.addEventListener("resize", scheduleOverlayUpdate);

  function render(payload) {
    try {
      currentEditable = !!payload.editable;
      knownSectionIds = {};
      knownBlockIds = {};
      collectSectionIds(payload.groups.header);
      collectSectionIds(payload.groups.template);
      collectSectionIds(payload.groups.footer);
      collectBlockIds(payload.groups.header);
      collectBlockIds(payload.groups.template);
      collectBlockIds(payload.groups.footer);

      var layoutModule = requireModule("__root__", "./" + manifest.themeLayoutPath);
      var ThemeLayout = layoutModule.ThemeLayout;
      if (!ThemeLayout) throw new Error("Theme has no ThemeLayout export at " + manifest.themeLayoutPath);

      var registryModule = requireModule("__root__", "./" + manifest.sectionRegistryPath);
      var registry = registryModule.sectionRegistry;
      if (!registry) throw new Error("Theme has no sectionRegistry export at " + manifest.sectionRegistryPath);

      // Body sections are rendered by the TEMPLATE's own code calling its
      // own RenderSections internally (templates/*.tsx do this themselves,
      // some — like page.tsx — wrap it with extra template-specific markup
      // we must preserve). Swap in a patched RenderSections so those
      // sections get the same click-to-select wrapper as header/footer,
      // without us having to bypass the template's own composition.
      moduleCache[manifest.sectionRegistryPath] = {
        exports: {
          sectionRegistry: registry,
          RenderSections: function (props) {
            return React.createElement(React.Fragment, null, wrapInstances(props.sections, registry));
          },
        },
      };

      var settings = {};
      if (manifest.settingsDefaultPath) {
        var defaultsModule = requireModule("__root__", "./" + manifest.settingsDefaultPath);
        var defaults = defaultsModule.default || {};
        for (var dk in defaults) if (Object.prototype.hasOwnProperty.call(defaults, dk)) settings[dk] = defaults[dk];
      }
      for (var sk in payload.settings) if (Object.prototype.hasOwnProperty.call(payload.settings, sk)) settings[sk] = payload.settings[sk];
      applyFavicon(settings);
      applyDesignStyles(payload);

      var templatePath = manifest.templatePaths[payload.templateId];
      if (!templatePath) throw new Error('Unknown template "' + payload.templateId + '"');
      var templateModule = requireModule("__root__", "./" + templatePath);
      var TemplateComponent = templateModule.default;
      if (!TemplateComponent) throw new Error("Template has no default export: " + templatePath);

      var header = React.createElement(React.Fragment, null, wrapInstances(toThemeInstances(payload.groups.header), registry));
      var footer = React.createElement(React.Fragment, null, wrapInstances(toThemeInstances(payload.groups.footer), registry));
      var bodyProps = { sections: toThemeInstances(payload.groups.template), query: "", results: [], resultCount: 0 };
      var body = React.createElement(TemplateComponent, bodyProps);

      var tree = React.createElement(ThemeLayout, { settings: settings, header: header, footer: footer }, body);

      if (!reactRoot) reactRoot = ReactDOMClient.createRoot(document.getElementById("root"));
      reactRoot.render(tree);
      lastPayload = payload;
      console.log("[theme-engine] render() ok, editable=", payload.editable, "selected=", payload.selected);
      window.requestAnimationFrame(function () { renderOverlay(payload); });
      // Web fonts / images can still be loading right after this first paint,
      // shifting layout after the measurement above already ran — one more
      // pass shortly after catches the outline up once things settle.
      window.setTimeout(function () { renderOverlay(payload); }, 250);
      window.parent.postMessage({ type: "themeFrame:rendered" }, parentOrigin);
    } catch (error) {
      console.error("[theme-engine] render() failed:", error);
      reportError(error && error.message ? error.message : String(error));
    }
  }

  var styleEl = document.createElement("style");
  styleEl.textContent = DATA.css;
  document.head.appendChild(styleEl);

  // Appended after the theme's own CSS so editor chrome always wins the cascade.
  var chromeStyleEl = document.createElement("style");
  chromeStyleEl.id = "theme-engine-chrome-style";
  chromeStyleEl.textContent = TOOLBAR_CSS;
  document.head.appendChild(chromeStyleEl);

  // A favicon is <head> content, not something a theme's own React tree can
  // render into — updated directly here, once per render(), from whatever
  // the merged settings currently say. Only meaningful once this iframe is a
  // real top-level page (a future publishing milestone); this element exists
  // now so that data path is already correct when it is.
  var faviconEl = document.createElement("link");
  faviconEl.rel = "icon";
  document.head.appendChild(faviconEl);
  function applyFavicon(settings) {
    var favicon = settings && settings.favicon;
    var src = favicon && typeof favicon === "object" ? favicon.src : "";
    if (src) faviconEl.setAttribute("href", src);
    else faviconEl.removeAttribute("href");
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "themeFrame:update") render(data.payload);
  });

  document.addEventListener(
    "click",
    function (event) {
      if (!currentEditable) {
        console.log("[theme-engine] click ignored: not editable");
        return;
      }
      var el = event.target;
      var blockId = null;
      while (el && el !== document.body) {
        if (!blockId && el.getAttribute) {
          var bId = el.getAttribute("data-theme-block-id");
          if (bId) blockId = bId;
        }
        var sectionId = el.getAttribute && el.getAttribute("data-theme-section-id");
        if (sectionId) {
          console.log("[theme-engine] click matched section=", sectionId, "block=", blockId);
          window.parent.postMessage({ type: "themeFrame:action", action: "selectSection", sectionId: sectionId }, parentOrigin);
          return;
        }
        el = el.parentElement;
      }
      console.log("[theme-engine] click found no section-id ancestor from target=", event.target);
    },
    true,
  );

  window.parent.postMessage({ type: "themeFrame:ready" }, parentOrigin);
})();
`;

/**
 * Given the theme's real uploaded files, produces the full HTML document
 * for the sandboxed grandchild iframe: the vendor React/ReactDOM script,
 * every theme file transpiled to a requireable module (as a JSON-encoded
 * data blob, never as literal inlined script text, so nothing in the
 * theme's own source — however unusual — can prematurely close a <script>
 * or <style> tag), the theme's own CSS verbatim, and the bootstrap script
 * that composes ThemeLayout + the theme's own section registry.
 */
export function buildThemeEngineBundle(files: Record<string, string>, parentOrigin: string): ThemeEngineBundle {
  const manifest = parseThemeEngineManifest(files);
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

  const data = {
    moduleSources,
    css: files[THEME_CSS_PATH] ?? "",
    manifest: {
      blocksPropBySchemaId: manifest.blocksPropBySchemaId,
      templatePaths: manifest.templatePaths,
      themeLayoutPath: THEME_LAYOUT_PATH,
      sectionRegistryPath: SECTION_REGISTRY_PATH,
      settingsDefaultPath: files[SETTINGS_DEFAULT_PATH] ? SETTINGS_DEFAULT_PATH : null,
    },
    parentOrigin,
  };

  // Theme content only ever reaches the page as a JSON *string* value, so a
  // theme file that happens to contain the literal text "</script>" cannot
  // terminate this tag early; < escaping is the last-mile guard for
  // the outer JS string literal itself.
  const dataLiteral = JSON.stringify(JSON.stringify(data)).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<script src="/theme-engine/vendor.js"></script>
</head>
<body>
<div id="root"></div>
<script>window.__THEME_ENGINE_DATA__ = JSON.parse(${dataLiteral});</script>
<script>${BOOTSTRAP_SCRIPT}</script>
</body>
</html>`;

  return { html, manifest };
}
