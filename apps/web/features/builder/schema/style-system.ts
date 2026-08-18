import type { CSSProperties } from "react";
import type {
  BoxSpacing,
  BuilderColor,
  BuilderLength,
  BuilderNode,
  BuilderResponsiveStyles,
  BuilderShadow,
  BuilderStyleBlock,
  BuilderViewport,
} from "./types";
import { isTokenReference, tokenReference } from "./theme-resolver";

export const colorPresets: Array<{ label: string; value: BuilderColor }> = [
  { label: "Transparent", value: "transparent" },
  { label: "White", value: "#ffffff" },
  { label: "Ink", value: "#111827" },
  { label: "Slate", value: "#475569" },
  { label: "Soft", value: "#f8fafc" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#e11d48" },
];

const allowedUnits = /^(auto|-?\d{1,4}(\.\d{1,2})?(px|rem|%))$/;
const hexColor = /^#[0-9a-fA-F]{6}$/;

export function defaultStylesForNode(type: BuilderNode["type"]): BuilderResponsiveStyles {
  if (type === "section") {
    return { base: { padding: linkedSpacing("4rem"), backgroundColor: tokenReference("colors.background") } };
  }
  if (type === "container") {
    return {
      base: {
        maxWidth: "72rem",
        width: "100%",
        padding: linkedSpacing("1.5rem"),
        display: "flex",
        direction: "column",
        gap: "1.25rem",
      },
    };
  }
  if (type === "heading") {
    return {
      base: { fontSize: tokenReference("typography.heading.fontSize"), fontWeight: tokenReference("typography.heading.fontWeight"), lineHeight: tokenReference("typography.heading.lineHeight"), textColor: tokenReference("colors.foreground") },
    };
  }
  if (type === "text") {
    return {
      base: { fontSize: tokenReference("typography.body.fontSize"), fontWeight: tokenReference("typography.body.fontWeight"), lineHeight: tokenReference("typography.body.lineHeight"), textColor: tokenReference("colors.mutedForeground") },
    };
  }
  if (type === "button") {
    return {
      base: {
        backgroundColor: tokenReference("colors.primary"),
        textColor: tokenReference("colors.primaryForeground"),
        borderRadius: tokenReference("radius.md"),
        padding: { top: "0.75rem", right: "1.25rem", bottom: "0.75rem", left: "1.25rem" },
        fontWeight: "semibold",
      },
    };
  }
  if (type === "image") {
    return {
      base: {
        width: "100%",
        minHeight: "12rem",
        borderRadius: "lg",
        objectFit: "cover",
        objectPosition: "center",
      },
    };
  }
  return {};
}

export function resolveStyles(
  styles: BuilderResponsiveStyles | undefined,
  viewport: BuilderViewport,
): BuilderStyleBlock {
  const base = styles?.base ?? {};
  if (viewport === "desktop") {
    return { ...base };
  }
  const tablet = { ...base, ...(styles?.tablet ?? {}) };
  if (viewport === "tablet") {
    return tablet;
  }
  return { ...tablet, ...(styles?.mobile ?? {}) };
}

export function setStyleValue(
  styles: BuilderResponsiveStyles | undefined,
  viewport: BuilderViewport,
  key: keyof BuilderStyleBlock,
  value: unknown,
): BuilderResponsiveStyles {
  const breakpoint = viewportToBreakpoint(viewport);
  return {
    ...(styles ?? {}),
    [breakpoint]: {
      ...((styles ?? {})[breakpoint] ?? {}),
      [key]: value,
    },
  };
}

export function resetStyleGroup(
  styles: BuilderResponsiveStyles | undefined,
  viewport: BuilderViewport,
  keys: Array<keyof BuilderStyleBlock>,
): BuilderResponsiveStyles {
  const breakpoint = viewportToBreakpoint(viewport);
  const nextBlock = { ...((styles ?? {})[breakpoint] ?? {}) };
  for (const key of keys) {
    delete nextBlock[key];
  }
  return {
    ...(styles ?? {}),
    [breakpoint]: nextBlock,
  };
}

export function validateStyleBlock(block: BuilderStyleBlock): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(block)) {
    if (typeof value === "string" && /javascript:|expression\(|url\(/i.test(value)) {
      errors.push(`${key} contains unsafe CSS text.`);
    }
    if (isTokenReference(value) && !isSafeTokenPath(value.value)) {
      errors.push(`${key} has an invalid theme token reference.`);
    }
  }
  validateSpacing(block.margin, "margin", errors);
  validateSpacing(block.padding, "padding", errors);
  for (const key of [
    "width",
    "maxWidth",
    "minWidth",
    "height",
    "minHeight",
    "maxHeight",
    "gap",
  ] as const) {
    if (block[key] !== undefined && !isTokenReference(block[key]) && !isLength(block[key])) {
      errors.push(`${key} has an invalid unit.`);
    }
  }
  for (const key of ["backgroundColor", "textColor", "borderColor"] as const) {
    if (block[key] !== undefined && !isTokenReference(block[key]) && !isColor(block[key])) {
      errors.push(`${key} is not a supported color.`);
    }
  }
  if (
    block.opacity !== undefined &&
    (!Number.isFinite(block.opacity) || block.opacity < 0 || block.opacity > 1)
  ) {
    errors.push("opacity must be between 0 and 1.");
  }
  return errors;
}

export function validateResponsiveStyles(styles: BuilderResponsiveStyles | undefined): string[] {
  if (!styles) {
    return [];
  }
  const errors: string[] = [];
  for (const breakpoint of ["base", "tablet", "mobile"] as const) {
    if (styles[breakpoint]) {
      errors.push(...validateStyleBlock(styles[breakpoint]!));
    }
  }
  return errors;
}

export function styleBlockToCss(block: BuilderStyleBlock): CSSProperties {
  return {
    marginTop: block.margin?.top,
    marginRight: block.margin?.right,
    marginBottom: block.margin?.bottom,
    marginLeft: block.margin?.left,
    paddingTop: block.padding?.top,
    paddingRight: block.padding?.right,
    paddingBottom: block.padding?.bottom,
    paddingLeft: block.padding?.left,
    width: block.width as string | undefined,
    maxWidth: block.maxWidth as string | undefined,
    minWidth: block.minWidth as string | undefined,
    height: block.height as string | undefined,
    minHeight: block.minHeight as string | undefined,
    maxHeight: block.maxHeight as string | undefined,
    display: block.display,
    flexDirection: block.direction,
    alignItems: mapAlign(block.align),
    justifyContent: mapJustify(block.justify),
    gap: block.gap as string | undefined,
    flexWrap: block.wrap ? "wrap" : undefined,
    backgroundColor: block.backgroundColor as string | undefined,
    color: block.textColor as string | undefined,
    textAlign: block.textAlign,
    fontSize: mapFontSize(block.fontSize as Parameters<typeof mapFontSize>[0]),
    fontWeight: mapFontWeight(block.fontWeight as Parameters<typeof mapFontWeight>[0]),
    lineHeight: mapLineHeight(block.lineHeight as Parameters<typeof mapLineHeight>[0]),
    letterSpacing: block.letterSpacing === "wide" ? "0.04em" : undefined,
    borderWidth:
      block.borderWidth === "medium" ? "2px" : block.borderWidth === "thin" ? "1px" : undefined,
    borderStyle:
      block.borderWidth && block.borderWidth !== "none"
        ? (block.borderStyle ?? "solid")
        : undefined,
    borderColor: block.borderColor as string | undefined,
    borderRadius: mapRadius(block.borderRadius as Parameters<typeof mapRadius>[0]),
    boxShadow: mapShadow(block.shadow as Parameters<typeof mapShadow>[0]),
    objectFit: block.objectFit,
    objectPosition: block.objectPosition,
    opacity: block.opacity,
  };
}

export function normalizeColor(value: string): BuilderColor | null {
  const normalized = value.trim();
  if (normalized === "transparent") {
    return "transparent";
  }
  if (hexColor.test(normalized)) {
    return normalized.toLowerCase() as BuilderColor;
  }
  return null;
}

export function linkedSpacing(value: BuilderLength): BoxSpacing {
  return { top: value, right: value, bottom: value, left: value };
}

export function isLength(value: unknown): value is BuilderLength {
  return typeof value === "string" && allowedUnits.test(value);
}

export function isColor(value: unknown): value is BuilderColor {
  return value === "transparent" || (typeof value === "string" && hexColor.test(value));
}

function validateSpacing(spacing: BoxSpacing | undefined, name: string, errors: string[]) {
  if (!spacing) {
    return;
  }
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (spacing[side] !== undefined && !isLength(spacing[side])) {
      errors.push(`${name}.${side} has an invalid unit.`);
    }
  }
}

function isSafeTokenPath(value: string) {
  return /^(colors|typography|spacing|radius|shadows|layout)\.[a-zA-Z0-9.]+$/.test(value);
}

function viewportToBreakpoint(viewport: BuilderViewport): "base" | "tablet" | "mobile" {
  return viewport === "desktop" ? "base" : viewport;
}

function mapAlign(value: BuilderStyleBlock["align"]) {
  return value === "start" ? "flex-start" : value === "end" ? "flex-end" : value;
}

function mapJustify(value: BuilderStyleBlock["justify"]) {
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  if (value === "between") return "space-between";
  return value;
}

function mapFontSize(value: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | undefined) {
  const sizes = {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  };
  return value ? sizes[value] : undefined;
}

function mapFontWeight(value: "normal" | "medium" | "semibold" | "bold" | "black" | undefined) {
  const weights = { normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 };
  return value ? weights[value] : undefined;
}

function mapLineHeight(value: "tight" | "normal" | "relaxed" | undefined) {
  return value === "tight"
    ? 1.1
    : value === "relaxed"
      ? 1.7
      : value === "normal"
        ? 1.45
        : undefined;
}

function mapRadius(value: "none" | "sm" | "md" | "lg" | "xl" | "full" | undefined) {
  const radii = {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  };
  return value ? radii[value] : undefined;
}

function mapShadow(value: BuilderShadow | undefined) {
  const shadows = {
    none: "none",
    sm: "0 1px 2px rgb(15 23 42 / 0.08)",
    md: "0 8px 20px rgb(15 23 42 / 0.10)",
    lg: "0 18px 40px rgb(15 23 42 / 0.14)",
  };
  return value ? shadows[value] : undefined;
}
