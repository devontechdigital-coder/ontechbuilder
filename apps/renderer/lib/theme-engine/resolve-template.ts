/**
 * Split out from render.tsx on purpose: this has zero React dependency,
 * so page.tsx / public-renderer.tsx (which run in Next's restricted
 * "react-server" module layer) can import it directly without pulling in
 * render.tsx's react-dom/server + class-component code — that module is
 * only ever safe to load from the internal render-theme Route Handler.
 * Mirrors customizer/state.ts's resolvePageTemplateId, without needing
 * the editor's full CustomizerPageOption shape.
 */
export function resolvePageTemplateId(page: { slug: string; templateId: string | null } | null): string {
  if (!page) return "index";
  if (page.templateId) return page.templateId;
  return page.slug === "home" || page.slug === "" ? "index" : "page";
}
