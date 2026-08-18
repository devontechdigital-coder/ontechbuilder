import React from "react";
import type { MouseEvent, ReactNode } from "react";
import { nodeRegistry } from "../registry/node-registry";
import { resolveStyles, styleBlockToCss } from "../schema/style-system";
import { resolveStyleTokens } from "../schema/theme-resolver";
import type { BuilderDocument, BuilderNode, BuilderViewport } from "../schema/types";
import type { WebsiteTheme } from "../../websites/theme-types";

export function BuilderRuntimeRenderer({
  document,
  selectedNodeId,
  onSelectNode,
  editorMode = false,
  viewport = "desktop",
  theme,
}: {
  document: BuilderDocument;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  editorMode?: boolean;
  viewport?: BuilderViewport;
  theme?: WebsiteTheme | null;
}) {
  return (
    <>
      {renderNode(document, document.rootNodeId, {
        ...(selectedNodeId !== undefined ? { selectedNodeId } : {}),
        ...(onSelectNode ? { onSelectNode } : {}),
        ...(theme !== undefined ? { theme } : {}),
        editorMode,
        viewport,
      })}
    </>
  );
}

function renderNode(
  document: BuilderDocument,
  nodeId: string,
  context: {
    selectedNodeId?: string | null;
    onSelectNode?: (nodeId: string) => void;
    editorMode: boolean;
    viewport: BuilderViewport;
    theme?: WebsiteTheme | null;
  },
): ReactNode {
  const node = document.nodes[nodeId];
  if (!node || !nodeRegistry[node.type]) {
    return (
      <div className="rounded-md border border-dashed border-destructive/40 p-3 text-sm text-destructive">
        Unsupported builder node
      </div>
    );
  }

  const children = (node.children ?? []).map((childId) => (
    <React.Fragment key={childId}>{renderNode(document, childId, context)}</React.Fragment>
  ));
  const editorProps = context.editorMode
    ? {
        onClick: (event: MouseEvent) => {
          event.stopPropagation();
          context.onSelectNode?.(node.id);
        },
        "data-builder-node": node.id,
      }
    : {};
  const selectedClass =
    context.editorMode && context.selectedNodeId === node.id
      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
      : "";
  const computedStyles = styleBlockToCss(resolveStyleTokens(resolveStyles(node.styles, context.viewport), context.theme));

  if (node.type === "root") {
    return (
      <div style={computedStyles} {...editorProps}>
        {children}
      </div>
    );
  }

  if (node.type === "section") {
    return (
      <section className={`bg-white ${selectedClass}`} style={computedStyles} {...editorProps}>
        {children}
      </section>
    );
  }

  if (node.type === "container") {
    return (
      <div
        className={`mx-auto ${selectedClass}`}
        style={{ ...containerFallback(node), ...computedStyles }}
        {...editorProps}
      >
        {children}
      </div>
    );
  }

  if (node.type === "heading") {
    const text = stringProp(node, "text", "Heading");
    const level = numberProp(node, "level", 2);
    const className = `${selectedClass}`;
    if (level === 1) {
      return (
        <h1 className={className} style={computedStyles} {...editorProps}>
          {text}
        </h1>
      );
    }
    if (level === 3) {
      return (
        <h3 className={className} style={computedStyles} {...editorProps}>
          {text}
        </h3>
      );
    }
    return (
      <h2 className={className} style={computedStyles} {...editorProps}>
        {text}
      </h2>
    );
  }

  if (node.type === "text") {
    return (
      <p className={`${selectedClass}`} style={computedStyles} {...editorProps}>
        {stringProp(node, "text", "Text")}
      </p>
    );
  }

  if (node.type === "button") {
    const url = safeUrl(stringProp(node, "url", "/"));
    return (
      <a
        className={`inline-flex items-center justify-center ${selectedClass}`}
        style={computedStyles}
        href={url}
        {...editorProps}
      >
        {stringProp(node, "label", "Button")}
      </a>
    );
  }

  if (node.type === "image") {
    return (
      <div
        className={`grid place-items-center border border-dashed bg-surface-secondary text-sm text-muted-foreground ${selectedClass}`}
        style={computedStyles}
        {...editorProps}
      >
        {stringProp(node, "mediaId", "")
          ? `Media: ${stringProp(node, "mediaId", "")}`
          : "Select a media item"}
      </div>
    );
  }

  return null;
}

function containerFallback(node: BuilderNode) {
  const maxWidth = stringProp(node, "maxWidth", "lg");
  const widths: Record<string, string> = {
    sm: "42rem",
    md: "56rem",
    lg: "72rem",
    xl: "80rem",
    full: "none",
  };
  return { maxWidth: widths[maxWidth] ?? undefined, width: "100%" };
}

function stringProp(node: BuilderNode, key: string, fallback: string) {
  return stringPropFrom(node.props, key, fallback);
}

function stringPropFrom(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
) {
  const value = source?.[key];
  return typeof value === "string" ? value : fallback;
}

function numberProp(node: BuilderNode, key: string, fallback: number) {
  const value = node.props?.[key];
  return typeof value === "number" ? value : fallback;
}

function safeUrl(value: string) {
  if (value.startsWith("javascript:")) {
    return "/";
  }
  return value || "/";
}
