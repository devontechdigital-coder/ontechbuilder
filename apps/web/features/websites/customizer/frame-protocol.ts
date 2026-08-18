import type { CustomizerPageOption, SectionGroupKey, SectionGroups, SectionSchema, SelectedItem } from "./types";

/**
 * The rendered website (preview + customizer canvas) lives in a separate
 * <iframe> document so none of the dashboard's own styling or scripts can
 * bleed onto theme content. Parent and frame only ever exchange plain,
 * serializable data over postMessage — no shared functions, no shared DOM.
 */
export const THEME_FRAME_UPDATE = "themeFrame:update";
export const THEME_FRAME_READY = "themeFrame:ready";
export const THEME_FRAME_RENDERED = "themeFrame:rendered";
export const THEME_FRAME_ACTION = "themeFrame:action";
export const THEME_FRAME_ERROR = "themeFrame:error";

export type ThemeFrameUpdatePayload = {
  groups: SectionGroups;
  sectionSchemas: SectionSchema[];
  page: CustomizerPageOption | null;
  /** Which theme.config.ts template file renders this page's body — the theme-engine entry point. */
  templateId: string;
  settings: Record<string, unknown>;
  selected: SelectedItem;
  websiteName: string;
  editable: boolean;
  templateSupportsSections: boolean;
  /** The sidebar's own inspector is off-screen while minimized, so only then does the canvas toolbar need its own settings entry point. */
  sidebarMinimized: boolean;
};

export type ThemeFrameUpdateMessage = {
  type: typeof THEME_FRAME_UPDATE;
  payload: ThemeFrameUpdatePayload;
};

export type ThemeFrameReadyMessage = {
  type: typeof THEME_FRAME_READY;
};

export type ThemeFrameRenderedMessage = {
  type: typeof THEME_FRAME_RENDERED;
};

export type ThemeFrameAction =
  | { action: "selectSection"; sectionId: string }
  /** Select the section (or block, when blockId is set) AND surface its settings — the canvas toolbar's gear button. */
  | { action: "openSettings"; sectionId: string; blockId?: string }
  | { action: "selectBlock"; sectionId: string; blockId: string }
  | { action: "toggleSection"; sectionId: string }
  | { action: "duplicateSection"; sectionId: string }
  | { action: "deleteSection"; sectionId: string }
  | { action: "moveSection"; sectionId: string; direction: "up" | "down" }
  | { action: "addSection"; group: SectionGroupKey; schemaId?: string; afterSectionId?: string }
  /** The inline canvas editor's own field changes — same effect as editing the sidebar inspector. */
  | { action: "changeSectionSetting"; sectionId: string; controlId: string; value: unknown }
  /** Closes the inline canvas editor without changing what's selected in the sidebar. */
  | { action: "deselect" };

export type ThemeFrameActionMessage = {
  type: typeof THEME_FRAME_ACTION;
} & ThemeFrameAction;

export type ThemeFrameErrorMessage = {
  type: typeof THEME_FRAME_ERROR;
  message: string;
};

export type ThemeFrameMessage = ThemeFrameUpdateMessage | ThemeFrameReadyMessage | ThemeFrameRenderedMessage | ThemeFrameActionMessage | ThemeFrameErrorMessage;

export function isThemeFrameMessage(value: unknown): value is ThemeFrameMessage {
  return typeof value === "object" && value !== null && "type" in value && typeof (value as { type: unknown }).type === "string" && String((value as { type: unknown }).type).startsWith("themeFrame:");
}

export function postToFrame(target: Window | null | undefined, message: ThemeFrameMessage) {
  target?.postMessage(message, window.location.origin);
}

export function postToParent(message: ThemeFrameMessage) {
  window.parent.postMessage(message, window.location.origin);
}

/**
 * The theme-engine grandchild iframe is `sandbox="allow-scripts"` without
 * `allow-same-origin`, so it has an opaque ("null") origin — it can never
 * be addressed by a real origin string, and its own outgoing messages
 * always arrive with `event.origin === "null"` regardless of what target
 * origin it used. Messages TO it must use "*"; messages FROM it must be
 * authenticated by `event.source` reference equality, never by origin.
 */
export function postToOpaqueFrame(target: Window | null | undefined, message: ThemeFrameMessage) {
  target?.postMessage(message, "*");
}
