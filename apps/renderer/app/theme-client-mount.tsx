"use client";

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
export function ThemeClientMount({ input, html }: { input: RenderThemePageInput; html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const [live, setLive] = useState(false);

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

  return (
    <>
      {!live ? <div dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning /> : null}
      <div ref={containerRef} />
    </>
  );
}
