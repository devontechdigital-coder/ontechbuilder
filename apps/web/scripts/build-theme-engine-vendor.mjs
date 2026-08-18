// Bundles React + ReactDOM/client into one IIFE so the sandboxed theme-engine
// iframe (opaque origin, no module resolution of its own) can load a single
// same-origin static <script> and get a working React runtime. Re-run this
// (`pnpm --filter web run build:theme-engine-vendor`) whenever react/react-dom
// versions change.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "theme-engine-vendor-entry.ts");
const outfile = path.join(here, "..", "public", "theme-engine", "vendor.js");

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});

console.log(`theme-engine vendor bundle written to ${path.relative(process.cwd(), outfile)}`);
