export type ThemeEngineManifest = {
  sectionComponentPaths: Record<string, string>;
  /** Header/footer components some themes keep in their own `partials:` map (see build-bundle.ts's registry merge). */
  partialComponentPaths: Record<string, string>;
  templatePaths: Record<string, string>;
  blocksPropBySchemaId: Record<string, string | null>;
};

function parseIdToPathBlock(source: string | undefined, key: "sections" | "templates" | "partials"): Record<string, string> {
  if (!source) return {};
  const block = source.match(new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`))?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/["']?([\w-]+)["']?\s*:\s*["']([^"']+)["']/g)) {
    const id = match[1];
    const path = match[2];
    if (id && path) out[id] = path;
  }
  return out;
}

export function componentNameFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.(tsx|ts)$/, "");
}

/**
 * Every section component in both sample theme packages types its blocks
 * prop as `{name}: RawBlock[]` on an exported `{Component}Props` interface
 * (verified against copora-theme-zip: `trustLogoBlocks`, `navBlocks`, plain
 * `blocks`, `avatarBlocks`, `serviceOptionBlocks` — no fixed name, only a
 * fixed type). Reading that annotation is the only reliable way to know
 * which prop a given section expects its blocks array under.
 */
function findBlocksPropName(source: string, componentName: string): string | null {
  const interfaceMatch = source.match(new RegExp(`interface\\s+${componentName}Props(?:\\s+extends\\s+[^{]+)?\\s*\\{([\\s\\S]*?)\\n\\}`));
  const body = interfaceMatch?.[1] ?? "";
  const fieldMatch = body.match(/(\w+)\??:\s*RawBlock\[\]/);
  return fieldMatch?.[1] ?? null;
}

/** Regex-parses theme.config.ts's manifest (never executed) the same way schema-parser.ts already does for section ordering. */
export function parseThemeEngineManifest(files: Record<string, string>): ThemeEngineManifest {
  const configSource = files["theme.config.ts"];
  const sectionComponentPaths = parseIdToPathBlock(configSource, "sections");
  const partialComponentPaths = parseIdToPathBlock(configSource, "partials");
  const templatePaths = parseIdToPathBlock(configSource, "templates");
  const blocksPropBySchemaId: Record<string, string | null> = {};
  for (const [schemaId, path] of Object.entries({ ...sectionComponentPaths, ...partialComponentPaths })) {
    const source = files[path];
    blocksPropBySchemaId[schemaId] = source ? findBlocksPropName(source, componentNameFromPath(path)) : null;
  }
  return { sectionComponentPaths, partialComponentPaths, templatePaths, blocksPropBySchemaId };
}
