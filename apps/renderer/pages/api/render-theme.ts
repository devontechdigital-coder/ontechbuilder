import type { NextApiRequest, NextApiResponse } from "next";
import { renderThemePage, type RenderThemePageInput } from "../../lib/theme-engine/render";

/**
 * Theme rendering (react-dom/server + a manual React tree with class
 * components for error boundaries) can't live anywhere under app/ —
 * Next's App Router compiles EVERYTHING reachable from app/, including
 * its own Route Handlers, under the restricted "react-server" webpack
 * condition, which rejects both a static `react-dom/server` import and
 * any `class extends React.Component`. This legacy Pages Router API
 * route is the actual escape hatch: it's ordinary Node/CommonJS with no
 * react-server condition applied, which is why apps/renderer carries a
 * `pages/` directory alongside its `app/` one for this single endpoint.
 * Not exposed to visitors — only ever called server-to-server by this
 * same app (see app/public-renderer.tsx).
 */
export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const rendered = await renderThemePage(request.body as RenderThemePageInput);
    response.status(200).json(rendered);
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
