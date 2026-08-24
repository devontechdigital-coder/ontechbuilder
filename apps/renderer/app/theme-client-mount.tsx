"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { buildThemedTree, type RenderThemePageInput } from "../lib/theme-engine/build-tree";

/**
 * "Client remount": the server already rendered `html` via renderToStaticMarkup (fast paint, and
 * what crawlers/no-JS visitors see). Once this component mounts in the browser, it re-runs the
 * exact same theme build — same transpile, same require() loader, same section tree — and swaps
 * a live React root over a SEPARATE, initially-empty container, so section-local useState/onClick
 * (an FAQ accordion, a mobile nav toggle, ...) actually work. No hydration matching is required
 * since this fully replaces the static content rather than reconciling onto it; the cost is a
 * brief flash at swap. If the client build throws (a broken theme), the static markup is left in
 * place untouched — the page stays readable, just non-interactive, same as before this existed.
 *
 * The static markup and the live-mount container must be two DIFFERENT elements: React refuses to
 * let the same element carry both a ref used for createRoot AND its own dangerouslySetInnerHTML
 * (ambiguous which content should win), so the static div is only rendered until the live root
 * takes over, at which point it's removed and the (by-then-populated) container replaces it.
 */
export function ThemeClientMount({ input, html, requestedPath }: { input: RenderThemePageInput; html: string; requestedPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const [live, setLive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const { tree } = buildThemedTree(input);
      const root = createRoot(container);
      rootRef.current = root;
      root.render(tree);
      setLive(true);
    } catch (error) {
      console.error("[renderer] client theme mount failed — page stays static/non-interactive:", error);
    }

    return () => {
      rootRef.current?.unmount();
      rootRef.current = null;
      setLive(false);
    };
  }, [input, html]);

  // Every route this app exposes (a real custom domain's root, or an admin-hosted
  // "/site/preview/{websiteId}" / "/preview/{websiteId}" prefix) is reachable at some prefix in
  // front of the theme's own site-relative path. The theme's own <a href="/about"> links are
  // authored assuming they sit at the domain ROOT (correct for a real custom domain, wrong for a
  // prefixed preview route — a plain root-relative href there drops the prefix and lands on a
  // completely different app). Comparing the browser's actual pathname against requestedPath (the
  // exact site-relative path the server just resolved this page from) recovers that prefix
  // precisely, for whichever scheme is in play, without hardcoding the known preview paths.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;

      const pathname = window.location.pathname;
      const prefix = requestedPath === "/" ? (pathname.endsWith("/") ? pathname.slice(0, -1) : pathname) : pathname.endsWith(requestedPath) ? pathname.slice(0, pathname.length - requestedPath.length) : "";

      event.preventDefault();
      router.push(`${prefix}${href}`);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [requestedPath, router]);

  return (
    <>
      {!live ? <div dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning /> : null}
      <div ref={containerRef} />
    </>
  );
}
