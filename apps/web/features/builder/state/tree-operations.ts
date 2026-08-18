import { canContain, nodeRegistry } from "../registry/node-registry";
import { cloneDocument, createNode, findParentId } from "../schema/document";
import type { BuilderDocument, BuilderNodeType, BuilderResponsiveStyles } from "../schema/types";

export function addNode(
  document: BuilderDocument,
  parentId: string,
  type: BuilderNodeType,
): BuilderDocument {
  const parent = document.nodes[parentId];
  if (!parent || !canContain(parent.type, type)) {
    throw new Error(`${parent?.type ?? "unknown"} cannot contain ${type}`);
  }

  const next = cloneDocument(document);
  const id = createUniqueNodeId(next, type);
  next.nodes[id] = createNode(type, id, { ...nodeRegistry[type].defaultProps });
  if (nodeRegistry[type].defaultStyles) {
    next.nodes[id]!.styles = { ...nodeRegistry[type].defaultStyles };
  }
  next.nodes[parentId]!.children = [...(next.nodes[parentId]!.children ?? []), id];
  return next;
}

export function removeNode(document: BuilderDocument, nodeId: string): BuilderDocument {
  if (nodeId === document.rootNodeId) {
    throw new Error("Root node cannot be removed");
  }

  const next = cloneDocument(document);
  const parentId = findParentId(next, nodeId);
  if (parentId) {
    next.nodes[parentId]!.children = (next.nodes[parentId]!.children ?? []).filter(
      (id) => id !== nodeId,
    );
  }
  removeSubtree(next, nodeId);
  return next;
}

export function moveNode(
  document: BuilderDocument,
  nodeId: string,
  targetParentId: string,
  targetIndex: number,
): BuilderDocument {
  if (nodeId === document.rootNodeId) {
    throw new Error("Root node cannot be moved");
  }
  const node = document.nodes[nodeId];
  const targetParent = document.nodes[targetParentId];
  if (!node || !targetParent || !canContain(targetParent.type, node.type)) {
    throw new Error("Invalid builder move");
  }
  if (isDescendant(document, targetParentId, nodeId)) {
    throw new Error("Node cannot move into its own descendant");
  }

  const next = cloneDocument(document);
  const currentParentId = findParentId(next, nodeId);
  if (currentParentId) {
    next.nodes[currentParentId]!.children = (next.nodes[currentParentId]!.children ?? []).filter(
      (id) => id !== nodeId,
    );
  }
  const children = [...(next.nodes[targetParentId]!.children ?? [])];
  children.splice(Math.max(0, Math.min(targetIndex, children.length)), 0, nodeId);
  next.nodes[targetParentId]!.children = children;
  return next;
}

export function updateNodeProps(
  document: BuilderDocument,
  nodeId: string,
  props: Record<string, unknown>,
): BuilderDocument {
  const node = document.nodes[nodeId];
  if (!node) {
    throw new Error("Node was not found");
  }

  const next = cloneDocument(document);
  next.nodes[nodeId]!.props = {
    ...(next.nodes[nodeId]!.props ?? {}),
    ...props,
  };
  return next;
}

export function updateNodeStyles(
  document: BuilderDocument,
  nodeId: string,
  styles: BuilderResponsiveStyles,
): BuilderDocument {
  const node = document.nodes[nodeId];
  if (!node) {
    throw new Error("Node was not found");
  }

  const next = cloneDocument(document);
  next.nodes[nodeId]!.styles = styles;
  return next;
}

function removeSubtree(document: BuilderDocument, nodeId: string): void {
  const node = document.nodes[nodeId];
  for (const childId of node?.children ?? []) {
    removeSubtree(document, childId);
  }
  delete document.nodes[nodeId];
}

function isDescendant(
  document: BuilderDocument,
  maybeDescendantId: string,
  ancestorId: string,
): boolean {
  const ancestor = document.nodes[ancestorId];
  if (!ancestor) {
    return false;
  }
  for (const childId of ancestor.children ?? []) {
    if (childId === maybeDescendantId || isDescendant(document, maybeDescendantId, childId)) {
      return true;
    }
  }
  return false;
}

function createUniqueNodeId(document: BuilderDocument, type: BuilderNodeType): string {
  let index = Object.keys(document.nodes).length + 1;
  while (document.nodes[`${type}-${index}`]) {
    index += 1;
  }
  return `${type}-${index}`;
}
