export interface WebsiteThemeTokens {
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
  typography: Record<"body" | "heading" | "small" | "label", {
    family: "system" | "serif" | "mono";
    fontSize: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
    fontWeight: "normal" | "medium" | "semibold" | "bold" | "black";
    lineHeight: "tight" | "normal" | "relaxed";
    letterSpacing: "normal" | "wide";
  }>;
  spacing: Record<"xs" | "sm" | "md" | "lg" | "xl" | "2xl", string>;
  radius: Record<"none" | "sm" | "md" | "lg" | "xl" | "full", "none" | "sm" | "md" | "lg" | "xl" | "full">;
  shadows: Record<"none" | "sm" | "md" | "lg", "none" | "sm" | "md" | "lg">;
  layout: {
    container: {
      narrow: string;
      content: string;
      wide: string;
    };
  };
}

export interface WebsiteTheme {
  id: string;
  websiteId: string;
  name: string;
  tokens: WebsiteThemeTokens;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeTokenReference {
  type: "token";
  value: string;
}

export const defaultThemeTokens: WebsiteThemeTokens = {
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
  spacing: { xs: "0.25rem", sm: "0.5rem", md: "1rem", lg: "1.5rem", xl: "2rem", "2xl": "4rem" },
  radius: { none: "none", sm: "sm", md: "md", lg: "lg", xl: "xl", full: "full" },
  shadows: { none: "none", sm: "sm", md: "md", lg: "lg" },
  layout: { container: { narrow: "42rem", content: "72rem", wide: "80rem" } },
};
