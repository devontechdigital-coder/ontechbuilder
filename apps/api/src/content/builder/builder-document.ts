import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../../core/database/database.js";

export const builderSchemaVersion = 1;
export const builderContentKind = "builderDocument";
export const maxBuilderDocumentBytes = 256_000;
const nodeIdPattern = /^[a-zA-Z0-9_-]{1,80}$/;

export type BuilderNodeType =
  "root" | "section" | "container" | "heading" | "text" | "image" | "button";

export interface BuilderNode {
  id: string;
  type: BuilderNodeType;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  children?: string[];
}

export interface BuilderDocument {
  schemaVersion: 1;
  rootNodeId: string;
  nodes: Record<string, BuilderNode>;
  metadata?: Record<string, unknown>;
}

export interface BuilderVersionContent {
  kind: typeof builderContentKind;
  revision: number;
  document: BuilderDocument;
}

const allowedChildren: Record<BuilderNodeType, BuilderNodeType[]> = {
  root: ["section"],
  section: ["container"],
  container: ["heading", "text", "image", "button"],
  heading: [],
  text: [],
  image: [],
  button: [],
};

export function createDefaultBuilderDocument(): BuilderDocument {
  return {
    schemaVersion: builderSchemaVersion,
    rootNodeId: "root",
    nodes: {
      root: {
        id: "root",
        type: "root",
        children: ["section-1"],
      },
      "section-1": {
        id: "section-1",
        type: "section",
        children: ["container-1"],
        props: {},
        styles: {},
      },
      "container-1": {
        id: "container-1",
        type: "container",
        children: ["heading-1", "text-1", "button-1"],
        props: {
          maxWidth: "lg",
        },
        styles: {},
      },
      "heading-1": {
        id: "heading-1",
        type: "heading",
        props: {
          text: "Start building your page",
          level: 1,
        },
      },
      "text-1": {
        id: "text-1",
        type: "text",
        props: {
          text: "Use the builder foundation to compose sections, containers, and simple content nodes.",
        },
      },
      "button-1": {
        id: "button-1",
        type: "button",
        props: {
          label: "Learn more",
          url: "/",
        },
      },
    },
    metadata: {
      viewportDefaults: ["desktop", "tablet", "mobile"],
    },
  };
}

export function createBuilderContent(
  document = createDefaultBuilderDocument(),
  revision = 1,
): BuilderVersionContent {
  return {
    kind: builderContentKind,
    revision,
    document,
  };
}

export function parseBuilderContent(value: unknown): BuilderVersionContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const content = value as Record<string, unknown>;
  if (content.kind !== builderContentKind) {
    return null;
  }

  return {
    kind: builderContentKind,
    revision:
      typeof content.revision === "number" && Number.isInteger(content.revision)
        ? content.revision
        : 0,
    document: validateBuilderDocument(content.document),
  };
}

export function validateBuilderDocument(value: unknown): BuilderDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Builder document must be an object");
  }

  const document = value as Record<string, unknown>;
  if (document.schemaVersion !== builderSchemaVersion) {
    throw new BadRequestException("Builder document schema version is not supported");
  }

  const rootNodeId = requiredNodeId(document.rootNodeId, "rootNodeId");
  if (!document.nodes || typeof document.nodes !== "object" || Array.isArray(document.nodes)) {
    throw new BadRequestException("Builder document nodes must be an object");
  }

  const rawNodes = document.nodes as Record<string, unknown>;
  if (!rawNodes[rootNodeId]) {
    throw new BadRequestException("Builder document root node is missing");
  }

  const nodes: Record<string, BuilderNode> = {};
  for (const [id, rawNode] of Object.entries(rawNodes)) {
    if (id !== requiredNodeId(id, "node id")) {
      throw new BadRequestException("Builder node id is invalid");
    }
    nodes[id] = parseNode(id, rawNode);
  }

  if (nodes[rootNodeId]?.type !== "root") {
    throw new BadRequestException("Builder root node must have type root");
  }

  assertTree(rootNodeId, nodes);
  const output: BuilderDocument = {
    schemaVersion: builderSchemaVersion,
    rootNodeId,
    nodes,
  };

  if (document.metadata !== undefined) {
    output.metadata = parseRecord(document.metadata, "metadata");
  }

  const serialized = JSON.stringify(output);
  if (serialized.length > maxBuilderDocumentBytes) {
    throw new BadRequestException("Builder document is too large");
  }

  return output;
}

export function toBuilderJson(document: BuilderDocument, revision: number): Prisma.InputJsonValue {
  return createBuilderContent(document, revision) as unknown as Prisma.InputJsonValue;
}

function parseNode(id: string, rawNode: unknown): BuilderNode {
  if (!rawNode || typeof rawNode !== "object" || Array.isArray(rawNode)) {
    throw new BadRequestException("Builder node must be an object");
  }

  const node = rawNode as Record<string, unknown>;
  if (node.id !== id) {
    throw new BadRequestException("Builder node id must match its map key");
  }

  const type = parseNodeType(node.type);
  const parsed: BuilderNode = {
    id,
    type,
  };

  if (node.props !== undefined) {
    parsed.props = validateProps(type, parseRecord(node.props, `${id}.props`));
  }
  if (node.styles !== undefined) {
    parsed.styles = validateStyles(parseRecord(node.styles, `${id}.styles`));
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      throw new BadRequestException(`${id}.children must be an array`);
    }
    parsed.children = node.children.map((childId) => requiredNodeId(childId, `${id}.children`));
  }

  return parsed;
}

function parseNodeType(value: unknown): BuilderNodeType {
  if (
    value === "root" ||
    value === "section" ||
    value === "container" ||
    value === "heading" ||
    value === "text" ||
    value === "image" ||
    value === "button"
  ) {
    return value;
  }

  throw new BadRequestException("Builder node type is not registered");
}

function validateProps(
  type: BuilderNodeType,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && /<script|javascript:/i.test(value)) {
      throw new BadRequestException("Builder property contains unsafe text");
    }
    clean[key] = value;
  }

  if (type === "heading") {
    assertOptionalString(clean.text, "heading.text", 500);
    if (clean.level !== undefined && clean.level !== 1 && clean.level !== 2 && clean.level !== 3) {
      throw new BadRequestException("heading.level must be 1, 2, or 3");
    }
  }

  if (type === "text") {
    assertOptionalString(clean.text, "text.text", 2_000);
  }

  if (type === "button") {
    assertOptionalString(clean.label, "button.label", 120);
    assertOptionalUrl(clean.url, "button.url");
  }

  if (type === "image") {
    assertOptionalString(clean.mediaId, "image.mediaId", 80);
    assertOptionalString(clean.alt, "image.alt", 300);
  }

  if (
    type === "container" &&
    clean.maxWidth !== undefined &&
    !["sm", "md", "lg", "xl", "full"].includes(String(clean.maxWidth))
  ) {
    throw new BadRequestException("container.maxWidth is invalid");
  }

  return clean;
}

function validateStyles(styles: Record<string, unknown>): Record<string, unknown> {
  const breakpointKeys = new Set(["base", "tablet", "mobile"]);
  const hasResponsiveShape = Object.keys(styles).some((key) => breakpointKeys.has(key));

  if (!hasResponsiveShape) {
    const legacyAllowed = new Set(["paddingY", "background", "align", "responsive"]);
    for (const key of Object.keys(styles)) {
      if (!legacyAllowed.has(key)) {
        throw new BadRequestException("Builder style key is not allowed");
      }
    }
    return styles;
  }

  for (const [breakpoint, block] of Object.entries(styles)) {
    if (!breakpointKeys.has(breakpoint)) {
      throw new BadRequestException("Builder style breakpoint is not allowed");
    }
    validateStyleBlock(parseRecord(block, `styles.${breakpoint}`));
  }

  return styles;
}

function validateStyleBlock(block: Record<string, unknown>): void {
  const allowed = new Set([
    "margin",
    "padding",
    "width",
    "maxWidth",
    "minWidth",
    "height",
    "minHeight",
    "maxHeight",
    "display",
    "direction",
    "align",
    "justify",
    "gap",
    "wrap",
    "backgroundColor",
    "backgroundMediaId",
    "textAlign",
    "textColor",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "borderWidth",
    "borderStyle",
    "borderColor",
    "borderRadius",
    "shadow",
    "objectFit",
    "objectPosition",
    "opacity",
  ]);

  for (const [key, value] of Object.entries(block)) {
    if (!allowed.has(key)) {
      throw new BadRequestException("Builder style property is not supported");
    }
    if (typeof value === "string" && /javascript:|expression\(|url\(/i.test(value)) {
      throw new BadRequestException("Builder style contains unsafe CSS text");
    }
  }

  validateSpacing(block.margin, "margin");
  validateSpacing(block.padding, "padding");
  for (const key of ["width", "maxWidth", "minWidth", "height", "minHeight", "maxHeight", "gap"]) {
    if (block[key] !== undefined) {
      assertLength(block[key], key);
    }
  }
  for (const key of ["backgroundColor", "textColor", "borderColor"]) {
    if (block[key] !== undefined) {
      assertColor(block[key], key);
    }
  }
  assertEnum(block.display, "display", ["block", "flex"]);
  assertEnum(block.direction, "direction", ["row", "column"]);
  assertEnum(block.align, "align", ["start", "center", "end", "stretch"]);
  assertEnum(block.justify, "justify", ["start", "center", "end", "between"]);
  assertEnum(block.textAlign, "textAlign", ["left", "center", "right"]);
  assertEnum(block.fontSize, "fontSize", [
    "xs",
    "sm",
    "base",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl",
  ]);
  assertEnum(block.fontWeight, "fontWeight", ["normal", "medium", "semibold", "bold", "black"]);
  assertEnum(block.lineHeight, "lineHeight", ["tight", "normal", "relaxed"]);
  assertEnum(block.letterSpacing, "letterSpacing", ["normal", "wide"]);
  assertEnum(block.borderWidth, "borderWidth", ["none", "thin", "medium"]);
  assertEnum(block.borderStyle, "borderStyle", ["solid", "dashed"]);
  assertEnum(block.borderRadius, "borderRadius", ["none", "sm", "md", "lg", "xl", "full"]);
  assertEnum(block.shadow, "shadow", ["none", "sm", "md", "lg"]);
  assertEnum(block.objectFit, "objectFit", ["cover", "contain"]);
  assertEnum(block.objectPosition, "objectPosition", ["center", "top", "bottom", "left", "right"]);

  if (block.wrap !== undefined && typeof block.wrap !== "boolean") {
    throw new BadRequestException("wrap must be a boolean");
  }
  if (
    block.opacity !== undefined &&
    (typeof block.opacity !== "number" ||
      !Number.isFinite(block.opacity) ||
      block.opacity < 0 ||
      block.opacity > 1)
  ) {
    throw new BadRequestException("opacity must be between 0 and 1");
  }
  if (block.backgroundMediaId !== undefined) {
    assertOptionalString(block.backgroundMediaId, "backgroundMediaId", 80);
  }
}

function validateSpacing(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }
  const spacing = parseRecord(value, field);
  const allowedSides = new Set(["top", "right", "bottom", "left"]);
  for (const [side, sideValue] of Object.entries(spacing)) {
    if (!allowedSides.has(side)) {
      throw new BadRequestException(`${field} side is invalid`);
    }
    assertLength(sideValue, `${field}.${side}`);
  }
}

function assertLength(value: unknown, field: string): void {
  if (typeof value !== "string" || !/^(auto|-?\d{1,4}(\.\d{1,2})?(px|rem|%))$/.test(value)) {
    throw new BadRequestException(`${field} has an invalid unit`);
  }
}

function assertColor(value: unknown, field: string): void {
  if (value !== "transparent" && (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))) {
    throw new BadRequestException(`${field} is not a supported color`);
  }
}

function assertEnum(value: unknown, field: string, allowed: string[]): void {
  if (value !== undefined && (typeof value !== "string" || !allowed.includes(value))) {
    throw new BadRequestException(`${field} is invalid`);
  }
}

function assertTree(rootNodeId: string, nodes: Record<string, BuilderNode>): void {
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function walk(nodeId: string): void {
    if (visiting.has(nodeId)) {
      throw new BadRequestException("Builder document cannot contain cycles");
    }
    if (visited.has(nodeId)) {
      throw new BadRequestException("Builder node cannot have multiple parents");
    }

    const node = nodes[nodeId];
    if (!node) {
      throw new BadRequestException("Builder document references a missing child node");
    }

    visiting.add(nodeId);
    const children = node.children ?? [];
    for (const childId of children) {
      const child = nodes[childId];
      if (!child) {
        throw new BadRequestException("Builder document references a missing child node");
      }
      if (!allowedChildren[node.type].includes(child.type)) {
        throw new BadRequestException(`${node.type} cannot contain ${child.type}`);
      }
      walk(childId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  walk(rootNodeId);

  if (visited.size !== Object.keys(nodes).length) {
    throw new BadRequestException("Builder document contains orphan nodes");
  }
}

function requiredNodeId(value: unknown, field: string): string {
  if (typeof value !== "string" || !nodeIdPattern.test(value)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value;
}

function parseRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOptionalString(value: unknown, field: string, maxLength: number): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "string" || value.length > maxLength) {
    throw new BadRequestException(`${field} is invalid`);
  }
}

function assertOptionalUrl(value: unknown, field: string): void {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} is invalid`);
  }
  try {
    const url = new URL(value, "https://example.com");
    if (
      value.startsWith("javascript:") ||
      (url.protocol !== "http:" && url.protocol !== "https:")
    ) {
      throw new Error("unsafe url");
    }
  } catch {
    throw new BadRequestException(`${field} is invalid`);
  }
}
