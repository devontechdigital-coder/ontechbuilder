import { transform } from "sucrase";

/**
 * Compiles one uploaded theme file (TSX/TS, always authored with
 * `import * as React from "react"` + ESM import/export per both sample
 * packages) into a CommonJS-shaped JS string. The "imports" transform is
 * what makes the output consumable by a plain require()/module.exports
 * loader — no bundler, no real ESM support needed at runtime.
 */
export function transpileThemeModule(path: string, source: string): string {
  const result = transform(source, { transforms: ["typescript", "jsx", "imports"], filePath: path });
  return result.code;
}
