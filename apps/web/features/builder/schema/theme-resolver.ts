import type { BuilderStyleBlock, BuilderTokenReference } from "./types";
import type { WebsiteTheme, WebsiteThemeTokens } from "../../websites/theme-types";
import { defaultThemeTokens } from "../../websites/theme-types";

export function isTokenReference(value: unknown): value is BuilderTokenReference {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).type === "token" &&
    typeof (value as Record<string, unknown>).value === "string"
  );
}

export function tokenReference(value: string): BuilderTokenReference {
  return { type: "token", value };
}

export function getThemeToken(theme: WebsiteTheme | WebsiteThemeTokens | null | undefined, path: string): unknown {
  const tokens = "tokens" in (theme ?? {}) ? (theme as WebsiteTheme).tokens : (theme as WebsiteThemeTokens | null | undefined);
  const source = tokens ?? defaultThemeTokens;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function resolveThemeValue<T>(value: T | BuilderTokenReference | undefined, theme: WebsiteTheme | null | undefined, fallback?: T): T | undefined {
  if (isTokenReference(value)) {
    const token = getThemeToken(theme, value.value);
    return token === undefined ? fallback : (token as T);
  }
  return value === undefined ? fallback : value;
}

export function resolveStyleTokens(block: BuilderStyleBlock, theme: WebsiteTheme | null | undefined): BuilderStyleBlock {
  const next: BuilderStyleBlock = {
    ...block,
  };

  assignResolved(next, "width", resolveThemeValue(block.width, theme));
  assignResolved(next, "maxWidth", resolveThemeValue(block.maxWidth, theme));
  assignResolved(next, "minWidth", resolveThemeValue(block.minWidth, theme));
  assignResolved(next, "height", resolveThemeValue(block.height, theme));
  assignResolved(next, "minHeight", resolveThemeValue(block.minHeight, theme));
  assignResolved(next, "maxHeight", resolveThemeValue(block.maxHeight, theme));
  assignResolved(next, "gap", resolveThemeValue(block.gap, theme));
  assignResolved(next, "backgroundColor", resolveThemeValue(block.backgroundColor, theme));
  assignResolved(next, "textColor", resolveThemeValue(block.textColor, theme));
  assignResolved(next, "fontSize", resolveThemeValue(block.fontSize, theme));
  assignResolved(next, "fontWeight", resolveThemeValue(block.fontWeight, theme));
  assignResolved(next, "lineHeight", resolveThemeValue(block.lineHeight, theme));
  assignResolved(next, "letterSpacing", resolveThemeValue(block.letterSpacing, theme));
  assignResolved(next, "borderColor", resolveThemeValue(block.borderColor, theme));
  assignResolved(next, "borderRadius", resolveThemeValue(block.borderRadius, theme));
  assignResolved(next, "shadow", resolveThemeValue(block.shadow, theme));

  return next;
}

function assignResolved<K extends keyof BuilderStyleBlock>(target: BuilderStyleBlock, key: K, value: BuilderStyleBlock[K] | undefined) {
  if (value !== undefined) {
    target[key] = value;
  }
}
