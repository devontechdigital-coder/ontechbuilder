"use client";

import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser } from "../auth/types";
import { getPreviewColors, StaticSitePreview, ThemeLivePreview } from "./customizer/preview-renderer";
import { getAllGroupSections, getCustomizerPageOptions, getNestedValue, resolvePageTemplateId } from "./customizer/state";
import { resolveThemeRenderer } from "./customizer/theme-renderer";
import { buildThemeEngineBundle } from "./customizer/theme-engine/build-bundle";
import { expandFormShortcodes } from "./customizer/shortcodes";
import {
  isThemeFrameMessage,
  postToOpaqueFrame,
  postToParent,
  THEME_FRAME_ACTION,
  THEME_FRAME_ERROR,
  THEME_FRAME_READY,
  THEME_FRAME_RENDERED,
  THEME_FRAME_UPDATE,
  type ThemeFrameUpdatePayload,
} from "./customizer/frame-protocol";
import type { PageSummary, ThemeDraftSummary, ThemeInstallationSummary, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

const REQUIRED_ENGINE_FILES = ["theme.config.ts", "layout/ThemeLayout.tsx", "components/sectionRegistry.tsx"];
const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function hasRealThemeFiles(files: Record<string, string> | null): files is Record<string, string> {
  return !!files && REQUIRED_ENGINE_FILES.every((path) => typeof files[path] === "string" && files[path].length > 0);
}

/**
 * Renders inside an <iframe>, deliberately kept out of the dashboard shell.
 * The real work happens one level deeper: the theme's own uploaded files
 * (its real components, its own ThemeLayout composition, its own CSS) get
 * compiled and executed in a second, sandboxed grandchild iframe
 * (`sandbox="allow-scripts"`, no `allow-same-origin`) so the rendered site
 * is exactly what the theme defines — nothing dashboard-authored layered on
 * top — while staying isolated from the logged-in admin session (an opaque
 * origin has no access to this page's cookies/storage). A theme installed
 * without real uploaded source (no files yet) falls back to a heuristic
 * renderer so there's still something to look at, not a blank page.
 */
export function ThemeFramePage({ params }: { params: Promise<{ id: string; themeId: string }> }) {
  const { id: websiteId, themeId } = use(params);
  const [payload, setPayload] = useState<ThemeFrameUpdatePayload | null>(null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  /**
   * A theme-authored link was clicked in the canvas — see build-bundle.ts's click handler, which
   * preventDefault()s the real navigation and asks for this instead. x/y are the grandchild's own
   * viewport coordinates, which map 1:1 onto this page's viewport (the grandchild iframe fills it
   * exactly), so no coordinate translation is needed to position the popup here.
   */
  const [linkPopup, setLinkPopup] = useState<{ href: string; x: number; y: number } | null>(null);
  /**
   * Whether the theme's own file fetch has settled (success or failure) —
   * distinct from `usesEngine`, which is only meaningful once this is true.
   * The parent's postMessage payload can arrive before this fetch finishes
   * (it's a faster, already-in-flight round trip), and without this gate the
   * render below would fall through to the generic schema-only fallback
   * during that window — a real theme's actual layout flashing in only
   * after files finish loading a moment later.
   */
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [engineError, setEngineError] = useState("");
  const [parentOrigin, setParentOrigin] = useState("");
  const grandchildRef = useRef<HTMLIFrameElement>(null);
  /**
   * Counter, not a boolean, for the same reason as the customizer's canvas
   * handshake: the sandboxed grandchild posts READY during script execution,
   * which happens BEFORE its iframe `load` event — so resetting on load
   * clobbered the flag and blocked every payload after the first render.
   * Counting also re-sends when the grandchild remounts and re-announces.
   */
  const [grandchildNonce, setGrandchildNonce] = useState(0);

  useEffect(() => {
    setParentOrigin(window.location.origin);
  }, []);

  // Messages FROM the trusted parent (customizer/preview page) — same
  // origin, validated the normal way.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isThemeFrameMessage(event.data)) return;
      if (event.data.type === THEME_FRAME_UPDATE) {
        setPayload(event.data.payload);
      }
    }

    window.addEventListener("message", handleMessage);
    postToParent({ type: THEME_FRAME_READY });
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Own copy of the theme's real files, fetched once and decoupled from the
  // hot settings-edit path (which keeps flowing over postMessage as before).
  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        const meResponse = await apiRequest<MeResponse>("/auth/me");
        if (!meResponse.activeTenant) {
          throw new Error("Login required to preview this theme");
        }

        const [websiteResponse, themesResponse, draftResponse, pagesResponse] = await Promise.all([
          apiRequest<WebsiteSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}`),
          apiRequest<ThemeInstallationSummary[]>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes`),
          apiRequest<ThemeDraftSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes/${themeId}/draft`),
          apiRequest<PageSummary[]>(`/websites/${websiteId}/pages`),
        ]);

        if (cancelled) return;
        setFiles(draftResponse.files ?? {});

        // Opened directly (not embedded in the customizer/preview page) —
        // there's no parent to postMessage a payload down, so build one
        // from a fresh fetch, same as before.
        if (window.parent === window) {
          const theme = themesResponse.find((item) => item.id === themeId) ?? null;
          const { sectionSchemas, getTemplateScope } = resolveThemeRenderer(theme, draftResponse);
          const pageOptions = getCustomizerPageOptions(pagesResponse, draftResponse);
          const page = pageOptions[0] ?? null;
          const pageKey = page?.id ?? "template-home";
          const templateId = resolvePageTemplateId(page);
          const templateScope = getTemplateScope(templateId);
          const groups = getAllGroupSections(draftResponse.settings ?? {}, pageKey, sectionSchemas, templateScope);
          const expandedGroups = await expandFormShortcodes(groups, publicApiBaseUrl, new Map());
          if (cancelled) return;

          setPayload({
            groups: expandedGroups as typeof groups,
            sectionSchemas,
            page,
            templateId,
            settings: draftResponse.settings,
            selected: { kind: "theme" },
            websiteName: websiteResponse.name,
            editable: false,
            templateSupportsSections: templateScope.supportsSections,
            // Non-editable standalone preview — never renders the overlay, so
            // this has no visible effect. `true` because there's no sidebar here.
            sidebarMinimized: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Theme preview could not be loaded");
        }
      } finally {
        if (!cancelled) setFilesLoaded(true);
      }
    }

    void loadFiles();
    return () => {
      cancelled = true;
    };
  }, [themeId, websiteId]);

  const usesEngine = hasRealThemeFiles(files);
  const engineBundle = useMemo(() => {
    if (!hasRealThemeFiles(files) || !parentOrigin) return null;
    return buildThemeEngineBundle(files, parentOrigin);
  }, [files, parentOrigin]);

  // Messages FROM the sandboxed grandchild — opaque origin, so authenticate
  // by window reference, never by event.origin (it will always read "null").
  useEffect(() => {
    if (!usesEngine) return;
    function handleMessage(event: MessageEvent) {
      if (event.source !== grandchildRef.current?.contentWindow) return;
      if (!isThemeFrameMessage(event.data)) return;
      const message = event.data;
      if (message.type === THEME_FRAME_READY) {
        setGrandchildNonce((current) => current + 1);
        return;
      }
      if (message.type === THEME_FRAME_RENDERED) {
        setEngineError("");
        postToParent({ type: THEME_FRAME_RENDERED });
        return;
      }
      if (message.type === THEME_FRAME_ERROR) {
        setEngineError(message.message);
        return;
      }
      if (message.type === THEME_FRAME_ACTION) {
        if (message.action === "showLinkPopup") {
          setLinkPopup({ href: message.href, x: message.x, y: message.y });
          return;
        }
        // A selectSection/selectBlock click that also hit a link carries it here — show the
        // popup alongside the toolbar the parent draws for that selection, rather than losing
        // the ability to select a linked button/card just because it's also a link. Any other
        // canvas interaction (no link attached) means the click that opened a previous popup is
        // done with — close it rather than leave it pointing at a link clicked away from.
        setLinkPopup("link" in message && message.link ? message.link : null);
        postToParent(message);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [usesEngine]);

  useEffect(() => {
    if (!usesEngine || !grandchildNonce || !payload) return;
    postToOpaqueFrame(grandchildRef.current?.contentWindow, { type: THEME_FRAME_UPDATE, payload });
  }, [grandchildNonce, payload, usesEngine]);

  useEffect(() => {
    if (!filesLoaded || usesEngine || !payload) return;
    postToParent({ type: THEME_FRAME_RENDERED });
  }, [filesLoaded, payload, usesEngine]);

  // Wait for the files fetch to settle before deciding how to render at all —
  // otherwise a payload that arrives first (a faster, already-in-flight
  // request) briefly renders the generic schema-only fallback below, which
  // then gets replaced by the real theme a moment later once files finish
  // loading. That replacement is the "wrong layout, then the real one"
  // flash this gate exists to prevent.
  if (!filesLoaded) {
    return <FrameLoadingState error={loadError} />;
  }

  if (usesEngine) {
    return (
      <div style={{ minHeight: "100svh" }}>
        {engineError ? <EngineErrorBanner message={engineError} /> : null}
        {engineBundle ? (
          <iframe
            ref={grandchildRef}
            title="Theme content"
            sandbox="allow-scripts"
            srcDoc={engineBundle.html}
            style={{ display: "block", width: "100%", height: "100svh", border: 0 }}
          />
        ) : (
          <FrameLoadingState error={loadError} />
        )}
        {linkPopup ? <LinkPopup href={linkPopup.href} x={linkPopup.x} y={linkPopup.y} onClose={() => setLinkPopup(null)} /> : null}
      </div>
    );
  }

  if (!payload) {
    return <FrameLoadingState error={loadError} />;
  }

  return (
    <div style={{ minHeight: "100svh" }}>
      <style dangerouslySetInnerHTML={{ __html: buildOverrideCss(payload.settings) }} />
      {payload.editable ? (
        <ThemeLivePreview
          groups={payload.groups}
          onAddSection={(group, schemaId, afterSectionId) =>
            postToParent({ type: THEME_FRAME_ACTION, action: "addSection", group, ...(schemaId ? { schemaId } : {}), ...(afterSectionId ? { afterSectionId } : {}) })
          }
          onDeleteSection={(sectionId) => postToParent({ type: THEME_FRAME_ACTION, action: "deleteSection", sectionId })}
          onDuplicateSection={(sectionId) => postToParent({ type: THEME_FRAME_ACTION, action: "duplicateSection", sectionId })}
          onMoveSection={(sectionId, direction) => postToParent({ type: THEME_FRAME_ACTION, action: "moveSection", sectionId, direction })}
          onSelectBlock={(sectionId, blockId) => postToParent({ type: THEME_FRAME_ACTION, action: "selectBlock", sectionId, blockId })}
          onSelectSection={(sectionId) => postToParent({ type: THEME_FRAME_ACTION, action: "selectSection", sectionId })}
          onToggleSection={(sectionId) => postToParent({ type: THEME_FRAME_ACTION, action: "toggleSection", sectionId })}
          page={payload.page}
          sectionSchemas={payload.sectionSchemas}
          selected={payload.selected}
          settings={payload.settings}
          templateSupportsSections={payload.templateSupportsSections}
          websiteName={payload.websiteName}
        />
      ) : (
        <StaticSitePreview groups={payload.groups} page={payload.page} sectionSchemas={payload.sectionSchemas} settings={payload.settings} websiteName={payload.websiteName} />
      )}
    </div>
  );
}

/**
 * A real <a target="_blank"> so the click that opens it is a genuine user gesture on a real
 * element — this page isn't sandboxed, unlike the grandchild the click originated in, so it can
 * actually open a new tab. A JS window.open() call here, triggered from a postMessage handler
 * rather than synchronously from the click itself, risks being treated as a popup by the browser
 * and blocked; a real anchor never has that problem.
 */
function LinkPopup({ href, onClose, x, y }: { href: string; onClose: () => void; x: number; y: number }) {
  const width = 280;
  const height = 96;
  const margin = 12;
  const left = typeof window === "undefined" ? x : Math.min(Math.max(x, margin), window.innerWidth - width - margin);
  const top = typeof window === "undefined" ? y + 12 : Math.min(y + 12, window.innerHeight - height - margin);

  return (
    <div
      className="fixed z-[2147483647] grid gap-2 rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-white shadow-2xl shadow-black/40 backdrop-blur"
      style={{ left, top, width }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-white/60">{href || "(no link target)"}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-5 shrink-0 place-items-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {href ? (
        // No onClick handler here — unmounting this very anchor (which closing the popup would
        // do) synchronously inside its own click handler races the browser's native "open in a
        // new tab" action for that click and can silently suppress it. The close button next to
        // it stays available if the popup should go away without opening the link.
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-white/20"
        >
          <ExternalLink className="size-3.5" />
          Open link
        </a>
      ) : (
        <p className="text-[11.5px] text-white/50">This link has no destination set.</p>
      )}
    </div>
  );
}

function EngineErrorBanner({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-red-200 bg-red-50 px-4 py-2 text-[12.5px] font-medium text-red-700">
      Theme failed to render: {message}
    </div>
  );
}

function FrameLoadingState({ error }: { error?: string }) {
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 94) return 94;
        if (current >= 82) return current + 1;
        if (current >= 58) return current + 2;
        return current + 4;
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="grid min-h-svh place-items-center overflow-hidden bg-white px-6 text-slate-950">
      <section className="relative grid w-full max-w-md justify-items-center gap-8 text-center">
        <motion.div
          className="relative grid h-36 w-48 place-items-center"
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-x-5 bottom-1 h-8 rounded-full bg-violet-500/15 blur-2xl"
            animate={{ opacity: [0.25, 0.55, 0.25], scaleX: [0.85, 1.08, 0.85] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="relative h-28 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex h-7 items-center gap-1.5 border-b bg-slate-50 px-3">
              <span className="size-2 rounded-full bg-slate-300" />
              <span className="size-2 rounded-full bg-slate-300" />
              <span className="size-2 rounded-full bg-violet-400" />
            </div>
            <div className="space-y-3 p-4">
              <motion.div
                className="h-3 rounded-full bg-violet-500"
                animate={{ width: ["38%", "72%", "52%"] }}
                transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="grid grid-cols-2 gap-2">
                <motion.div className="h-9 rounded-lg bg-slate-100" animate={{ opacity: [0.65, 1, 0.65] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
                <motion.div className="h-9 rounded-lg bg-slate-100" animate={{ opacity: [1, 0.65, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
              </div>
            </div>
          </motion.div>
          <motion.div
            className="absolute -right-1 top-6 h-12 w-16 rounded-xl border border-slate-200 bg-white/90 shadow-sm"
            animate={{ y: [0, 7, 0], opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <div className="space-y-3">
          <motion.p
            className="text-xs font-bold uppercase tracking-[0.18em] text-violet-500"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
          >
            Draft preview
          </motion.p>
          <motion.h1
            className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            {error ? "Preview could not load" : "Launching website preview"}
          </motion.h1>
          {error ? <p className="text-sm leading-6 text-red-600">{error}</p> : null}
        </div>

        {!error ? <div className="w-full max-w-[370px] space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Loading</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className="h-full rounded-full bg-slate-950"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
          <motion.p
            className="text-sm font-medium text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ delay: 0.4, duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            This may take a few seconds
          </motion.p>
        </div> : null}
      </section>
    </main>
  );
}

function sanitizeForStyleTag(value: string) {
  return value.replace(/</g, "");
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHslTriplet([r, g, b]: [number, number, number]): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Fallback-only: applies when a theme has no real uploaded source to
 * execute (see hasRealThemeFiles above), so the heuristic renderer below
 * still needs dashboard tokens overridden from the theme's own resolved
 * palette instead of a fixed neutral guess.
 */
function buildOverrideCss(settings: Record<string, unknown>) {
  const colors = getPreviewColors(settings);
  const bgRgb = hexToRgb(colors.background) ?? [255, 255, 255];
  const surfaceRgb = hexToRgb(colors.surface) ?? [255, 255, 255];
  const textRgb = hexToRgb(colors.text) ?? [17, 24, 39];
  const primaryRgb = hexToRgb(colors.primary) ?? [17, 24, 39];
  const darkRgb = hexToRgb(colors.dark) ?? [17, 24, 39];

  const backgroundTriplet = rgbToHslTriplet(bgRgb);
  const foregroundTriplet = rgbToHslTriplet(textRgb);
  const surfaceTriplet = rgbToHslTriplet(surfaceRgb);
  const surfaceSecondaryTriplet = rgbToHslTriplet(mixRgb(surfaceRgb, textRgb, 0.05));
  const borderTriplet = rgbToHslTriplet(mixRgb(surfaceRgb, textRgb, 0.12));
  const inputTriplet = rgbToHslTriplet(mixRgb(surfaceRgb, textRgb, 0.16));
  const mutedTriplet = rgbToHslTriplet(mixRgb(surfaceRgb, textRgb, 0.04));
  const mutedForegroundTriplet = rgbToHslTriplet(mixRgb(textRgb, surfaceRgb, 0.45));
  const primaryTriplet = rgbToHslTriplet(primaryRgb);
  const primaryForegroundTriplet = relativeLuminance(primaryRgb) > 0.45 ? "0 0% 9%" : "0 0% 100%";
  const secondaryTriplet = rgbToHslTriplet(darkRgb);

  const bodyFont = sanitizeForStyleTag(String(getNestedValue(settings, "bodyFont") ?? "").trim());
  const headingFont = sanitizeForStyleTag(String(getNestedValue(settings, "headingFont") ?? "").trim());
  const baseFontSizeValue = getNestedValue(settings, "baseFontSize");
  const fontSize = typeof baseFontSizeValue === "number" ? `${baseFontSizeValue}px` : "16px";

  return `
    :root {
      --background: ${backgroundTriplet};
      --foreground: ${foregroundTriplet};
      --surface: ${surfaceTriplet};
      --surface-secondary: ${surfaceSecondaryTriplet};
      --border: ${borderTriplet};
      --input: ${inputTriplet};
      --ring: ${primaryTriplet};
      --muted: ${mutedTriplet};
      --muted-foreground: ${mutedForegroundTriplet};
      --primary: ${primaryTriplet};
      --primary-foreground: ${primaryForegroundTriplet};
      --secondary: ${secondaryTriplet};
      --accent: ${primaryTriplet};
      --text-micro: 0.6875rem;
      --text-xs: 0.75rem;
      --text-sm: 0.875rem;
      --text-base: 1rem;
      --text-lg: 1.125rem;
      --text-xl: 1.25rem;
    }
    html, body { background: transparent; }
    body {
      font-family: ${bodyFont || "ui-sans-serif, system-ui, -apple-system, sans-serif"};
      font-size: ${fontSize};
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${headingFont || "inherit"};
    }
  `;
}
