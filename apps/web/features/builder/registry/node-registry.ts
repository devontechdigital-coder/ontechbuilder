import type { BuilderNodeType, NodeDefinition } from "../schema/types";
import { defaultStylesForNode } from "../schema/style-system";

export const nodeRegistry: Record<BuilderNodeType, NodeDefinition> = {
  root: {
    type: "root",
    displayName: "Root",
    category: "system",
    allowedChildren: ["section"],
    defaultProps: {},
    properties: [],
  },
  section: {
    type: "section",
    displayName: "Section",
    category: "layout",
    allowedChildren: ["container"],
    defaultProps: {},
    defaultStyles: defaultStylesForNode("section"),
    properties: [
      {
        key: "paddingY",
        label: "Vertical padding",
        type: "select",
        defaultValue: "lg",
        options: [
          { label: "Small", value: "sm" },
          { label: "Medium", value: "md" },
          { label: "Large", value: "lg" },
        ],
      },
      {
        key: "background",
        label: "Background",
        type: "select",
        defaultValue: "white",
        options: [
          { label: "White", value: "white" },
          { label: "Soft", value: "soft" },
          { label: "Dark", value: "dark" },
        ],
      },
    ],
  },
  container: {
    type: "container",
    displayName: "Container",
    category: "layout",
    allowedChildren: ["heading", "text", "image", "button"],
    defaultProps: { maxWidth: "lg" },
    defaultStyles: defaultStylesForNode("container"),
    properties: [
      {
        key: "maxWidth",
        label: "Max width",
        type: "select",
        defaultValue: "lg",
        options: [
          { label: "Small", value: "sm" },
          { label: "Medium", value: "md" },
          { label: "Large", value: "lg" },
          { label: "Extra large", value: "xl" },
          { label: "Full", value: "full" },
        ],
      },
    ],
  },
  heading: {
    type: "heading",
    displayName: "Heading",
    category: "content",
    allowedChildren: [],
    defaultProps: { text: "New heading", level: 2 },
    defaultStyles: defaultStylesForNode("heading"),
    properties: [
      { key: "text", label: "Text", type: "text", defaultValue: "New heading" },
      {
        key: "level",
        label: "Level",
        type: "select",
        defaultValue: 2,
        options: [
          { label: "H1", value: 1 },
          { label: "H2", value: 2 },
          { label: "H3", value: 3 },
        ],
      },
    ],
  },
  text: {
    type: "text",
    displayName: "Text",
    category: "content",
    allowedChildren: [],
    defaultProps: { text: "Add body copy here." },
    defaultStyles: defaultStylesForNode("text"),
    properties: [
      { key: "text", label: "Text", type: "textarea", defaultValue: "Add body copy here." },
    ],
  },
  image: {
    type: "image",
    displayName: "Image",
    category: "content",
    allowedChildren: [],
    defaultProps: { mediaId: "", alt: "" },
    defaultStyles: defaultStylesForNode("image"),
    properties: [
      {
        key: "mediaId",
        label: "Media ID",
        type: "media",
        description: "References an existing Media record.",
      },
      { key: "alt", label: "Alt text", type: "text" },
    ],
  },
  button: {
    type: "button",
    displayName: "Button",
    category: "content",
    allowedChildren: [],
    defaultProps: { label: "Button", url: "/" },
    defaultStyles: defaultStylesForNode("button"),
    properties: [
      { key: "label", label: "Label", type: "text", defaultValue: "Button" },
      { key: "url", label: "URL", type: "url", defaultValue: "/" },
    ],
  },
};

export function canContain(parentType: BuilderNodeType, childType: BuilderNodeType) {
  return nodeRegistry[parentType]?.allowedChildren.includes(childType) ?? false;
}
