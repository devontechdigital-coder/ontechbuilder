import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuilderRuntimeRenderer } from "./renderer/runtime-renderer";
import { createDefaultBuilderDocument, validateBuilderDocument } from "./schema/document";
import {
  resetStyleGroup,
  resolveStyles,
  setStyleValue,
  validateResponsiveStyles,
} from "./schema/style-system";
import { isTokenReference, resolveStyleTokens } from "./schema/theme-resolver";
import { commitDocument, createEditorState, redo, undo } from "./state/history";
import {
  addNode,
  moveNode,
  removeNode,
  updateNodeProps,
  updateNodeStyles,
} from "./state/tree-operations";

describe("builder document validation", () => {
  it("accepts a valid document", () => {
    expect(validateBuilderDocument(createDefaultBuilderDocument())).toEqual([]);
  });

  it("rejects unknown root schema version", () => {
    const document = createDefaultBuilderDocument();
    document.schemaVersion = 2 as 1;
    expect(validateBuilderDocument(document)).toContain("Unsupported schema version.");
  });

  it("detects orphan nodes", () => {
    const document = createDefaultBuilderDocument();
    document.nodes.orphan = { id: "orphan", type: "text", props: { text: "Lost" } };
    expect(validateBuilderDocument(document).join(" ")).toContain("orphaned");
  });

  it("detects invalid children", () => {
    const document = createDefaultBuilderDocument();
    document.nodes.root!.children = ["heading-1"];
    expect(validateBuilderDocument(document).join(" ")).toContain("root cannot contain heading");
  });
});

describe("builder tree operations", () => {
  it("adds, updates, removes, and moves nodes", () => {
    const document = createDefaultBuilderDocument();
    const withText = addNode(document, "container-1", "text");
    const addedId = withText.nodes["container-1"]!.children!.at(-1)!;
    expect(withText.nodes[addedId]?.type).toBe("text");

    const updated = updateNodeProps(withText, addedId, { text: "Updated copy" });
    expect(updated.nodes[addedId]?.props?.text).toBe("Updated copy");

    const moved = moveNode(updated, addedId, "container-1", 0);
    expect(moved.nodes["container-1"]?.children?.[0]).toBe(addedId);

    const removed = removeNode(moved, addedId);
    expect(removed.nodes[addedId]).toBeUndefined();
  });
});

describe("builder undo and redo", () => {
  it("keeps history for document mutations only", () => {
    const state = createEditorState(createDefaultBuilderDocument());
    const nextDocument = addNode(state.document, "container-1", "heading");
    const committed = commitDocument(state, nextDocument);
    expect(committed.undoStack).toHaveLength(1);

    const undone = undo(committed);
    expect(undone.document.nodes).not.toHaveProperty("heading-7");

    const redone = redo(undone);
    expect(
      Object.values(redone.document.nodes).some(
        (node) => node.type === "heading" && node.id !== "heading-1",
      ),
    ).toBe(true);
  });

  it("tracks style changes in undo and redo history", () => {
    const state = createEditorState(createDefaultBuilderDocument());
    const section = state.document.nodes["section-1"]!;
    const styles = setStyleValue(section.styles, "desktop", "backgroundColor", "#2563eb");
    const nextDocument = updateNodeStyles(state.document, "section-1", styles);
    const committed = commitDocument(state, nextDocument);

    expect(
      resolveStyles(committed.document.nodes["section-1"]?.styles, "desktop").backgroundColor,
    ).toBe("#2563eb");
    const undoneBackground = resolveStyles(undo(committed).document.nodes["section-1"]?.styles, "desktop").backgroundColor;
    expect(isTokenReference(undoneBackground)).toBe(true);
    expect(isTokenReference(undoneBackground) ? undoneBackground.value : "").toBe("colors.background");
    expect(
      resolveStyles(redo(undo(committed)).document.nodes["section-1"]?.styles, "desktop")
        .backgroundColor,
    ).toBe("#2563eb");
  });
});

describe("builder responsive style system", () => {
  it("resolves base, tablet, and mobile inheritance", () => {
    const styles = {
      base: { backgroundColor: "#ffffff", padding: { top: "4rem" } },
      tablet: { backgroundColor: "#f8fafc" },
      mobile: { padding: { top: "2rem" } },
    } as const;

    expect(resolveStyles(styles, "desktop")).toMatchObject({ backgroundColor: "#ffffff" });
    expect(resolveStyles(styles, "tablet")).toMatchObject({
      backgroundColor: "#f8fafc",
      padding: { top: "4rem" },
    });
    expect(resolveStyles(styles, "mobile")).toMatchObject({
      backgroundColor: "#f8fafc",
      padding: { top: "2rem" },
    });
  });

  it("resolves theme token references while preserving explicit overrides", () => {
    const block = {
      backgroundColor: { type: "token", value: "colors.primary" },
      textColor: "#ffffff",
    } as const;

    expect(resolveStyleTokens(block, null)).toMatchObject({
      backgroundColor: "#111827",
      textColor: "#ffffff",
    });
  });

  it("validates units, colors, and malicious CSS", () => {
    expect(
      validateResponsiveStyles({ base: { width: "100%", backgroundColor: "#111827" } }),
    ).toEqual([]);
    expect(
      validateResponsiveStyles({ base: { width: "calc(100% - 1rem)" as never } }).join(" "),
    ).toContain("invalid unit");
    expect(
      validateResponsiveStyles({ base: { backgroundColor: "red" as never } }).join(" "),
    ).toContain("not a supported color");
    expect(
      validateResponsiveStyles({ base: { width: "url(javascript:alert(1))" as never } }).join(" "),
    ).toContain("unsafe");
  });

  it("resets only requested style groups", () => {
    const styles = { base: { width: "100%", backgroundColor: "#111827" } } as const;
    expect(resetStyleGroup(styles, "desktop", ["width"]).base).toEqual({
      backgroundColor: "#111827",
    });
  });
});

describe("builder runtime renderer", () => {
  it("renders supported nodes without editor controls in runtime mode", () => {
    const html = renderToStaticMarkup(
      <BuilderRuntimeRenderer document={createDefaultBuilderDocument()} />,
    );
    expect(html).toContain("Start building your page");
    expect(html).not.toContain("data-builder-node");
  });

  it("renders a safe fallback for missing nodes", () => {
    const document = createDefaultBuilderDocument();
    document.nodes.root!.children = ["missing"];
    const html = renderToStaticMarkup(<BuilderRuntimeRenderer document={document} />);
    expect(html).toContain("Unsupported builder node");
  });

  it("renders viewport-specific styles", () => {
    const document = createDefaultBuilderDocument();
    document.nodes["section-1"]!.styles = {
      base: { backgroundColor: "#ffffff" },
      mobile: { backgroundColor: "#111827" },
    };
    const desktop = renderToStaticMarkup(
      <BuilderRuntimeRenderer document={document} viewport="desktop" />,
    );
    const mobile = renderToStaticMarkup(
      <BuilderRuntimeRenderer document={document} viewport="mobile" />,
    );
    expect(desktop).toContain("background-color:#ffffff");
    expect(mobile).toContain("background-color:#111827");
  });
});
