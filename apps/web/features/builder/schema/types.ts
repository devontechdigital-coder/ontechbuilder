export type BuilderNodeType =
  "root" | "section" | "container" | "heading" | "text" | "image" | "button";
export type BuilderViewport = "desktop" | "tablet" | "mobile";

export type BuilderLength = "auto" | `${number}px` | `${number}rem` | `${number}%`;
export type BuilderColor = "transparent" | `#${string}`;
export type BuilderShadow = "none" | "sm" | "md" | "lg";
export interface BuilderTokenReference {
  type: "token";
  value: string;
}
export type BuilderThemeValue<T> = T | BuilderTokenReference;

export interface BoxSpacing {
  top?: BuilderLength;
  right?: BuilderLength;
  bottom?: BuilderLength;
  left?: BuilderLength;
}

export interface BuilderStyleBlock {
  margin?: BoxSpacing;
  padding?: BoxSpacing;
  width?: BuilderThemeValue<BuilderLength>;
  maxWidth?: BuilderThemeValue<BuilderLength>;
  minWidth?: BuilderThemeValue<BuilderLength>;
  height?: BuilderThemeValue<BuilderLength>;
  minHeight?: BuilderThemeValue<BuilderLength>;
  maxHeight?: BuilderThemeValue<BuilderLength>;
  display?: "block" | "flex";
  direction?: "row" | "column";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: BuilderThemeValue<BuilderLength>;
  wrap?: boolean;
  backgroundColor?: BuilderThemeValue<BuilderColor>;
  backgroundMediaId?: string;
  textAlign?: "left" | "center" | "right";
  textColor?: BuilderThemeValue<BuilderColor>;
  fontSize?: BuilderThemeValue<"xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl">;
  fontWeight?: BuilderThemeValue<"normal" | "medium" | "semibold" | "bold" | "black">;
  lineHeight?: BuilderThemeValue<"tight" | "normal" | "relaxed">;
  letterSpacing?: BuilderThemeValue<"normal" | "wide">;
  borderWidth?: "none" | "thin" | "medium";
  borderStyle?: "solid" | "dashed";
  borderColor?: BuilderThemeValue<BuilderColor>;
  borderRadius?: BuilderThemeValue<"none" | "sm" | "md" | "lg" | "xl" | "full">;
  shadow?: BuilderThemeValue<BuilderShadow>;
  objectFit?: "cover" | "contain";
  objectPosition?: "center" | "top" | "bottom" | "left" | "right";
  opacity?: number;
}

export interface BuilderResponsiveStyles {
  base?: BuilderStyleBlock;
  tablet?: BuilderStyleBlock;
  mobile?: BuilderStyleBlock;
}

export interface BuilderNode {
  id: string;
  type: BuilderNodeType;
  props?: Record<string, unknown>;
  styles?: BuilderResponsiveStyles;
  children?: string[];
}

export interface BuilderDocument {
  schemaVersion: 1;
  rootNodeId: string;
  nodes: Record<string, BuilderNode>;
  metadata?: Record<string, unknown>;
}

export interface BuilderDraft {
  pageId: string;
  versionId: string | null;
  versionNumber: number | null;
  revision: number;
  document: BuilderDocument;
}

export type PropertyType = "text" | "textarea" | "number" | "select" | "toggle" | "url" | "media";

export interface PropertyDefinition {
  key: string;
  label: string;
  type: PropertyType;
  defaultValue?: unknown;
  description?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
}

export interface NodeDefinition {
  type: BuilderNodeType;
  displayName: string;
  category: "layout" | "content" | "system";
  allowedChildren: BuilderNodeType[];
  defaultProps: Record<string, unknown>;
  defaultStyles?: BuilderResponsiveStyles;
  properties: PropertyDefinition[];
}
