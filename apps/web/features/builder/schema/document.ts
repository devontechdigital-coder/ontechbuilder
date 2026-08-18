import { canContain } from "../registry/node-registry";
import { defaultStylesForNode, validateResponsiveStyles } from "./style-system";
import type { BuilderDocument, BuilderNode, BuilderNodeType } from "./types";

export function createDefaultBuilderDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    rootNodeId: "root",
    nodes: {
      root: { id: "root", type: "root", children: ["section-1"] },
      "section-1": {
        id: "section-1",
        type: "section",
        children: ["container-1"],
        styles: defaultStylesForNode("section"),
      },
      "container-1": {
        id: "container-1",
        type: "container",
        children: ["heading-1", "text-1", "button-1"],
        props: { maxWidth: "lg" },
        styles: defaultStylesForNode("container"),
      },
      "heading-1": {
        id: "heading-1",
        type: "heading",
        props: { text: "Start building your page", level: 1 },
        styles: defaultStylesForNode("heading"),
      },
      "text-1": {
        id: "text-1",
        type: "text",
        props: { text: "Compose sections, containers, headings, text, images, and buttons." },
        styles: defaultStylesForNode("text"),
      },
      "button-1": {
        id: "button-1",
        type: "button",
        props: { label: "Learn more", url: "/" },
        styles: defaultStylesForNode("button"),
      },
    },
    metadata: { viewportDefaults: ["desktop", "tablet", "mobile"] },
  };
}

export function validateBuilderDocument(document: BuilderDocument): string[] {
  const errors: string[] = [];
  if (document.schemaVersion !== 1) {
    errors.push("Unsupported schema version.");
  }
  if (!document.nodes[document.rootNodeId]) {
    errors.push("Root node is missing.");
  }
  if (document.nodes[document.rootNodeId]?.type !== "root") {
    errors.push("Root node must be type root.");
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  function walk(nodeId: string) {
    const node = document.nodes[nodeId];
    if (!node) {
      errors.push(`Missing node ${nodeId}.`);
      return;
    }
    if (visiting.has(nodeId)) {
      errors.push("Document contains a cycle.");
      return;
    }
    if (visited.has(nodeId)) {
      errors.push(`Node ${nodeId} has multiple parents.`);
      return;
    }

    visiting.add(nodeId);
    for (const childId of node.children ?? []) {
      const child = document.nodes[childId];
      if (!child) {
        errors.push(`Missing child ${childId}.`);
        continue;
      }
      if (!canContain(node.type, child.type)) {
        errors.push(`${node.type} cannot contain ${child.type}.`);
      }
      walk(childId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  walk(document.rootNodeId);
  for (const id of Object.keys(document.nodes)) {
    const node = document.nodes[id];
    if (!node || node.id !== id) {
      errors.push(`Node ${id} has an invalid id.`);
    }
    if (!visited.has(id)) {
      errors.push(`Node ${id} is orphaned.`);
    }
    errors.push(...validateResponsiveStyles(node?.styles));
  }

  return Array.from(new Set(errors));
}

export function findParentId(document: BuilderDocument, nodeId: string): string | null {
  for (const node of Object.values(document.nodes)) {
    if (node.children?.includes(nodeId)) {
      return node.id;
    }
  }
  return null;
}

export function cloneDocument(document: BuilderDocument): BuilderDocument {
  return JSON.parse(JSON.stringify(document)) as BuilderDocument;
}

export function createNode(
  type: BuilderNodeType,
  id: string,
  props: Record<string, unknown> = {},
): BuilderNode {
  const node: BuilderNode = {
    id,
    type,
    props,
  };
  if (type === "section" || type === "container") {
    node.children = [];
  }
  node.styles = defaultStylesForNode(type);
  return node;
}
