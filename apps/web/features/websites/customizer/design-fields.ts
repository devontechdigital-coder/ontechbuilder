import type { ThemeSetting } from "./types";

const FONT_WEIGHT_OPTIONS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extrabold" },
];

/**
 * Universal per-section AND per-block overrides, independent of any theme's own schema. The theme
 * engine (customizer/theme-engine/build-bundle.ts) recognizes any section or block setting whose
 * id starts with "design" + an uppercase letter, strips it before it ever reaches the theme's own
 * component props, and applies it instead as generated CSS scoped to that section or block
 * (applyDesignStyles, keyed off data-theme-section-id / data-theme-block-id respectively). These
 * ids must stay byte-for-byte in sync with the ones hardcoded there.
 */
export const DESIGN_FIELDS: ThemeSetting[] = [
  { id: "designPaddingTop", type: "range", label: "Padding top", group: "Spacing", min: 0, max: 160, step: 4, unit: "px", default: 0 },
  { id: "designPaddingRight", type: "range", label: "Padding right", group: "Spacing", min: 0, max: 160, step: 4, unit: "px", default: 0 },
  { id: "designPaddingBottom", type: "range", label: "Padding bottom", group: "Spacing", min: 0, max: 160, step: 4, unit: "px", default: 0 },
  { id: "designPaddingLeft", type: "range", label: "Padding left", group: "Spacing", min: 0, max: 160, step: 4, unit: "px", default: 0 },
  { id: "designMarginTop", type: "range", label: "Margin top", group: "Spacing", min: -80, max: 160, step: 4, unit: "px", default: -80 },
  { id: "designMarginBottom", type: "range", label: "Margin bottom", group: "Spacing", min: -80, max: 160, step: 4, unit: "px", default: -80 },
  { id: "designMarginLeft", type: "range", label: "Margin left", group: "Spacing", min: -80, max: 160, step: 4, unit: "px", default: -80 },
  { id: "designMarginRight", type: "range", label: "Margin right", group: "Spacing", min: -80, max: 160, step: 4, unit: "px", default: -80 },

  { id: "designWidth", type: "range", label: "Width", group: "Size", min: 0, max: 1600, step: 8, unit: "px", default: 0 },
  { id: "designMinWidth", type: "range", label: "Min width", group: "Size", min: 0, max: 1600, step: 8, unit: "px", default: 0 },
  { id: "designMaxWidth", type: "range", label: "Max width", group: "Size", min: 0, max: 1600, step: 8, unit: "px", default: 0 },
  { id: "designHeight", type: "range", label: "Height", group: "Size", min: 0, max: 1200, step: 8, unit: "px", default: 0 },
  { id: "designMinHeight", type: "range", label: "Min height", group: "Size", min: 0, max: 1200, step: 8, unit: "px", default: 0 },
  { id: "designMaxHeight", type: "range", label: "Max height", group: "Size", min: 0, max: 1200, step: 8, unit: "px", default: 0 },

  // "options" starts empty and is filled in at render time with the theme's own curated font
  // list (see CustomizerInspector's sectionDesignFields in inspector.tsx) — this file is
  // theme-agnostic and has no way to know that list itself. A free-text input let a merchant
  // type any font stack, but gave no indication of which fonts the theme actually ships
  // (downloads) versus an arbitrary string that silently renders as a fallback everywhere.
  { id: "designAllFontFamily", type: "select", label: "Font family", group: "All text", options: [] },
  { id: "designAllFontSize", type: "range", label: "Font size", group: "All text", min: 10, max: 72, step: 1, unit: "px", default: 10 },
  { id: "designAllFontWeight", type: "select", label: "Font weight", group: "All text", options: FONT_WEIGHT_OPTIONS, default: "300" },
  { id: "designAllColor", type: "color", label: "Text color", group: "All text" },

  { id: "designHeadingFontFamily", type: "select", label: "Font family", group: "Heading text", options: [] },
  { id: "designHeadingFontSize", type: "range", label: "Font size", group: "Heading text", min: 10, max: 96, step: 1, unit: "px", default: 10 },
  { id: "designHeadingFontWeight", type: "select", label: "Font weight", group: "Heading text", options: FONT_WEIGHT_OPTIONS, default: "300" },
  { id: "designHeadingColor", type: "color", label: "Text color", group: "Heading text" },

  { id: "designParagraphFontFamily", type: "select", label: "Font family", group: "Paragraph text", options: [] },
  { id: "designParagraphFontSize", type: "range", label: "Font size", group: "Paragraph text", min: 10, max: 48, step: 1, unit: "px", default: 10 },
  { id: "designParagraphFontWeight", type: "select", label: "Font weight", group: "Paragraph text", options: FONT_WEIGHT_OPTIONS, default: "300" },
  { id: "designParagraphColor", type: "color", label: "Text color", group: "Paragraph text" },

  { id: "designBgImage", type: "image", label: "Background image", group: "Background" },
  { id: "designBgColor", type: "color", label: "Background color", group: "Background" },
  {
    id: "designBgSize",
    type: "select",
    label: "Background size",
    group: "Background",
    default: "auto",
    options: [
      { value: "auto", label: "Auto" },
      { value: "cover", label: "Cover" },
      { value: "contain", label: "Contain" },
    ],
  },
  {
    id: "designBgAttachment",
    type: "select",
    label: "Background attachment",
    group: "Background",
    default: "scroll",
    options: [
      { value: "scroll", label: "Scroll" },
      { value: "fixed", label: "Fixed" },
      { value: "local", label: "Local" },
    ],
  },

  { id: "designBorderWidth", type: "range", label: "Border width", group: "Border", min: 0, max: 20, step: 1, unit: "px", default: 0 },
  {
    id: "designBorderStyle",
    type: "select",
    label: "Border style",
    group: "Border",
    default: "solid",
    options: [
      { value: "solid", label: "Solid" },
      { value: "dashed", label: "Dashed" },
      { value: "dotted", label: "Dotted" },
      { value: "none", label: "None" },
    ],
  },
  { id: "designBorderColor", type: "color", label: "Border color", group: "Border" },
  { id: "designBorderRadius", type: "range", label: "Border radius", group: "Border", min: 0, max: 100, step: 2, unit: "px", default: 0 },
];
