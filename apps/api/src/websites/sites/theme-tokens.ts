import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../core/database/database.js";

const colorPattern = /^#[0-9a-fA-F]{6}$/;
const lengthPattern = /^(auto|\d{1,4}(\.\d{1,2})?(px|rem|%))$/;
const fontFamilies = ["system", "serif", "mono"] as const;
const fontSizes = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;
const fontWeights = ["normal", "medium", "semibold", "bold", "black"] as const;
const lineHeights = ["tight", "normal", "relaxed"] as const;
const letterSpacings = ["normal", "wide"] as const;
const shadowValues = ["none", "sm", "md", "lg"] as const;
const radiusValues = ["none", "sm", "md", "lg", "xl", "full"] as const;

export const defaultThemeTokens = {
  colors: {
    primary: "#111827",
    primaryForeground: "#ffffff",
    secondary: "#475569",
    background: "#ffffff",
    foreground: "#111827",
    muted: "#f1f5f9",
    mutedForeground: "#64748b",
    border: "#e2e8f0",
    success: "#15803d",
    warning: "#b45309",
    danger: "#b91c1c",
  },
  typography: {
    body: { family: "system", fontSize: "base", fontWeight: "normal", lineHeight: "relaxed", letterSpacing: "normal" },
    heading: { family: "system", fontSize: "4xl", fontWeight: "black", lineHeight: "tight", letterSpacing: "normal" },
    small: { family: "system", fontSize: "sm", fontWeight: "normal", lineHeight: "normal", letterSpacing: "normal" },
    label: { family: "system", fontSize: "sm", fontWeight: "semibold", lineHeight: "normal", letterSpacing: "normal" },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "4rem",
  },
  radius: {
    none: "none",
    sm: "sm",
    md: "md",
    lg: "lg",
    xl: "xl",
    full: "full",
  },
  shadows: {
    none: "none",
    sm: "sm",
    md: "md",
    lg: "lg",
  },
  layout: {
    container: {
      narrow: "42rem",
      content: "72rem",
      wide: "80rem",
    },
  },
};

export function parseThemeTokens(value: unknown): Prisma.InputJsonValue {
  const source = isRecord(value) ? value : {};
  const tokens = mergeThemeTokens(source);

  for (const [key, color] of Object.entries(tokens.colors)) {
    if (!colorPattern.test(color)) {
      throw new BadRequestException(`colors.${key} must be a hex color`);
    }
  }

  for (const [key, type] of Object.entries(tokens.typography)) {
    enumValue(type.family, fontFamilies, `typography.${key}.family`);
    enumValue(type.fontSize, fontSizes, `typography.${key}.fontSize`);
    enumValue(type.fontWeight, fontWeights, `typography.${key}.fontWeight`);
    enumValue(type.lineHeight, lineHeights, `typography.${key}.lineHeight`);
    enumValue(type.letterSpacing, letterSpacings, `typography.${key}.letterSpacing`);
  }

  for (const [key, spacing] of Object.entries(tokens.spacing)) {
    if (!lengthPattern.test(spacing)) {
      throw new BadRequestException(`spacing.${key} has an invalid length`);
    }
  }

  for (const [key, radius] of Object.entries(tokens.radius)) {
    enumValue(radius, radiusValues, `radius.${key}`);
  }

  for (const [key, shadow] of Object.entries(tokens.shadows)) {
    enumValue(shadow, shadowValues, `shadows.${key}`);
  }

  for (const [key, width] of Object.entries(tokens.layout.container)) {
    if (!lengthPattern.test(width)) {
      throw new BadRequestException(`layout.container.${key} has an invalid length`);
    }
  }

  return tokens as Prisma.InputJsonValue;
}

export function mergeThemeTokens(value: Record<string, unknown>) {
  const colors = isRecord(value.colors) ? value.colors : {};
  const typography = isRecord(value.typography) ? value.typography : {};
  const spacing = isRecord(value.spacing) ? value.spacing : {};
  const radius = isRecord(value.radius) ? value.radius : {};
  const shadows = isRecord(value.shadows) ? value.shadows : {};
  const layout = isRecord(value.layout) ? value.layout : {};
  const container = isRecord(layout.container) ? layout.container : {};

  return {
    colors: mapStringTokens(defaultThemeTokens.colors, colors),
    typography: {
      body: mapStringTokens(defaultThemeTokens.typography.body, isRecord(typography.body) ? typography.body : {}),
      heading: mapStringTokens(defaultThemeTokens.typography.heading, isRecord(typography.heading) ? typography.heading : {}),
      small: mapStringTokens(defaultThemeTokens.typography.small, isRecord(typography.small) ? typography.small : {}),
      label: mapStringTokens(defaultThemeTokens.typography.label, isRecord(typography.label) ? typography.label : {}),
    },
    spacing: mapStringTokens(defaultThemeTokens.spacing, spacing),
    radius: mapStringTokens(defaultThemeTokens.radius, radius),
    shadows: mapStringTokens(defaultThemeTokens.shadows, shadows),
    layout: {
      container: mapStringTokens(defaultThemeTokens.layout.container, container),
    },
  };
}

function mapStringTokens<T extends Record<string, string>>(defaults: T, source: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, typeof source[key] === "string" ? source[key].trim() : fallback]),
  ) as T;
}

function enumValue<T extends readonly string[]>(value: string, options: T, field: string) {
  if (!options.includes(value)) {
    throw new BadRequestException(`${field} has an invalid value`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
