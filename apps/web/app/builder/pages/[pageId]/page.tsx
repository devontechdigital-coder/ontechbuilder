"use client";

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  Monitor,
  MousePointer2,
  PaintBucket,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import { FormEvent, type ReactNode, use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../../../components/ui/button";
import {
  Alert,
  Badge,
  EmptyState,
  LoadingState,
  SectionHeader,
  StatusIndicator,
} from "../../../../components/ui/display";
import { Field, Input, Select, Textarea } from "../../../../components/ui/form";
import { ConfirmDialog } from "../../../../components/ui/overlay";
import { apiRequest } from "../../../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../../../features/auth/types";
import type { PageSummary } from "../../../../features/websites/types";
import { BuilderRuntimeRenderer } from "../../../../features/builder/renderer/runtime-renderer";
import { nodeRegistry } from "../../../../features/builder/registry/node-registry";
import { validateBuilderDocument } from "../../../../features/builder/schema/document";
import {
  colorPresets,
  normalizeColor,
  resetStyleGroup,
  resolveStyles,
  setStyleValue,
} from "../../../../features/builder/schema/style-system";
import { isTokenReference } from "../../../../features/builder/schema/theme-resolver";
import type {
  BoxSpacing,
  BuilderDraft,
  BuilderDocument,
  BuilderLength,
  BuilderNode,
  BuilderNodeType,
  BuilderResponsiveStyles,
  BuilderStyleBlock,
  BuilderViewport,
  PropertyDefinition,
} from "../../../../features/builder/schema/types";
import type { WebsiteTheme, WebsiteThemeTokens } from "../../../../features/websites/theme-types";
import {
  commitDocument,
  createEditorState,
  redo,
  undo,
  type BuilderEditorState,
} from "../../../../features/builder/state/history";
import {
  addNode,
  moveNode,
  removeNode,
  updateNodeProps,
  updateNodeStyles,
} from "../../../../features/builder/state/tree-operations";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

interface BuilderPageProps {
  params: Promise<{ pageId: string }>;
}

export default function BuilderPage({ params }: BuilderPageProps) {
  const { pageId } = use(params);
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [page, setPage] = useState<PageSummary | null>(null);
  const [state, setState] = useState<BuilderEditorState | null>(null);
  const [revision, setRevision] = useState(0);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<WebsiteTheme | null>(null);
  const [savedThemeJson, setSavedThemeJson] = useState("");
  const [themeUndoStack, setThemeUndoStack] = useState<WebsiteThemeTokens[]>([]);
  const [themeRedoStack, setThemeRedoStack] = useState<WebsiteThemeTokens[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [copiedStyles, setCopiedStyles] = useState<BuilderResponsiveStyles | null>(null);
  const [confirmThemeReset, setConfirmThemeReset] = useState(false);

  const selectedNode = state?.selectedNodeId
    ? (state.document.nodes[state.selectedNodeId] ?? null)
    : null;
  const validationErrors = useMemo(
    () => (state ? validateBuilderDocument(state.document) : []),
    [state],
  );

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse, pageResponse, draftResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
          apiRequest<PageSummary>(`/pages/${pageId}`),
          apiRequest<BuilderDraft>(`/pages/${pageId}/builder/draft`),
        ]);
        const themeResponse = meResponse.activeTenant
          ? await apiRequest<WebsiteTheme>(`/tenants/${meResponse.activeTenant.id}/websites/${pageResponse.websiteId}/theme`)
          : null;
        setMe(meResponse);
        setTenants(tenantResponse);
        setPage(pageResponse);
        setTheme(themeResponse);
        setSavedThemeJson(JSON.stringify(themeResponse?.tokens ?? null));
        setThemeUndoStack([]);
        setThemeRedoStack([]);
        setRevision(draftResponse.revision);
        setDraftVersionId(draftResponse.versionId);
        setState(createEditorState(draftResponse.document));
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [pageId, router]);

  async function switchTenant(tenantId: string) {
    await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    window.location.reload();
  }

  function mutateDocument(
    mutator: (document: BuilderDocument) => BuilderDocument,
    selectedNodeId?: string | null,
  ) {
    setState((current) => {
      if (!current) {
        return current;
      }
      const nextDocument = mutator(current.document);
      return {
        ...commitDocument(current, nextDocument),
        selectedNodeId: selectedNodeId === undefined ? current.selectedNodeId : selectedNodeId,
      };
    });
  }

  function addChild(parentId: string, type: BuilderNodeType) {
    try {
      mutateDocument((document) => {
        const next = addNode(document, parentId, type);
        const parent = next.nodes[parentId];
        const nextId = parent?.children?.[parent.children.length - 1] ?? parentId;
        setTimeout(
          () => setState((current) => (current ? { ...current, selectedNodeId: nextId } : current)),
          0,
        );
        return next;
      });
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Node could not be added");
    }
  }

  function removeSelectedNode() {
    if (!state?.selectedNodeId || state.selectedNodeId === state.document.rootNodeId) {
      return;
    }
    mutateDocument(
      (document) => removeNode(document, state.selectedNodeId!),
      state.document.rootNodeId,
    );
  }

  function moveSelected(direction: -1 | 1) {
    if (!state?.selectedNodeId || state.selectedNodeId === state.document.rootNodeId) {
      return;
    }
    const parent = Object.values(state.document.nodes).find((node) =>
      node.children?.includes(state.selectedNodeId!),
    );
    if (!parent?.children) {
      return;
    }
    const index = parent.children.indexOf(state.selectedNodeId);
    mutateDocument((document) =>
      moveNode(document, state.selectedNodeId!, parent.id, index + direction),
    );
  }

  function updateProperty(property: PropertyDefinition, value: unknown) {
    if (!state?.selectedNodeId) {
      return;
    }
    mutateDocument((document) =>
      updateNodeProps(document, state.selectedNodeId!, { [property.key]: value }),
    );
  }

  function updateStyle(key: keyof BuilderStyleBlock, value: unknown) {
    if (!state?.selectedNodeId) {
      return;
    }
    mutateDocument((document) => {
      const node = document.nodes[state.selectedNodeId!];
      return updateNodeStyles(
        document,
        state.selectedNodeId!,
        setStyleValue(node?.styles, state.viewport, key, value),
      );
    });
  }

  function resetStyles(keys: Array<keyof BuilderStyleBlock>) {
    if (!state?.selectedNodeId) {
      return;
    }
    mutateDocument((document) => {
      const node = document.nodes[state.selectedNodeId!];
      return updateNodeStyles(
        document,
        state.selectedNodeId!,
        resetStyleGroup(node?.styles, state.viewport, keys),
      );
    });
  }

  function pasteStyles() {
    if (!state?.selectedNodeId || !copiedStyles) {
      return;
    }
    mutateDocument((document) =>
      updateNodeStyles(document, state.selectedNodeId!, structuredClone(copiedStyles)),
    );
  }

  async function saveDraft(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!state) {
      return;
    }
    const errors = validateBuilderDocument(state.document);
    if (errors.length) {
      setError(errors[0] ?? "Builder document is invalid");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiRequest<BuilderDraft>(`/pages/${pageId}/builder/draft`, {
        method: "PUT",
        body: JSON.stringify({ document: state.document, expectedRevision: revision }),
      });
      setRevision(response.revision);
      setDraftVersionId(response.versionId);
      setState((current) =>
        current ? { ...current, dirty: false, undoStack: [], redoStack: [] } : current,
      );
      setMessage("Draft saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Builder save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function publishDraft() {
    if (!draftVersionId) {
      setError("Save a draft before publishing.");
      return;
    }
    setError(null);
    try {
      await apiRequest(`/pages/${pageId}/versions/${draftVersionId}/publish`, { method: "POST" });
      setMessage("Draft published with the existing page publishing flow.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Publish failed");
    }
  }

  const themeDirty = Boolean(theme && JSON.stringify(theme.tokens) !== savedThemeJson);

  function updateThemeToken(path: string, value: string) {
    setTheme((current) => {
      if (!current) {
        return current;
      }
      const tokens = structuredClone(current.tokens);
      setThemeUndoStack((stack) => [...stack.slice(-29), structuredClone(current.tokens)]);
      setThemeRedoStack([]);
      setDeepToken(tokens, path, value);
      return { ...current, tokens };
    });
  }

  function undoThemeChange() {
    setTheme((current) => {
      const previous = themeUndoStack[themeUndoStack.length - 1];
      if (!current || !previous) {
        return current;
      }
      setThemeUndoStack((stack) => stack.slice(0, -1));
      setThemeRedoStack((stack) => [...stack.slice(-29), structuredClone(current.tokens)]);
      return { ...current, tokens: previous };
    });
  }

  function redoThemeChange() {
    setTheme((current) => {
      const next = themeRedoStack[themeRedoStack.length - 1];
      if (!current || !next) {
        return current;
      }
      setThemeRedoStack((stack) => stack.slice(0, -1));
      setThemeUndoStack((stack) => [...stack.slice(-29), structuredClone(current.tokens)]);
      return { ...current, tokens: next };
    });
  }

  async function saveTheme() {
    if (!me?.activeTenant || !page || !theme) {
      return;
    }

    setIsSavingTheme(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiRequest<WebsiteTheme>(`/tenants/${me.activeTenant.id}/websites/${page.websiteId}/theme`, {
        method: "PATCH",
        body: JSON.stringify({ name: theme.name, tokens: theme.tokens }),
      });
      setTheme(response);
      setSavedThemeJson(JSON.stringify(response.tokens));
      setThemeUndoStack([]);
      setThemeRedoStack([]);
      setMessage("Theme saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Theme save failed");
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function resetTheme() {
    if (!me?.activeTenant || !page) {
      return;
    }

    setConfirmThemeReset(false);
    setIsSavingTheme(true);
    setError(null);
    try {
      const response = await apiRequest<WebsiteTheme>(`/tenants/${me.activeTenant.id}/websites/${page.websiteId}/theme/reset`, {
        method: "POST",
      });
      setTheme(response);
      setSavedThemeJson(JSON.stringify(response.tokens));
      setThemeUndoStack([]);
      setThemeRedoStack([]);
      setMessage("Theme reset.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Theme reset failed");
    } finally {
      setIsSavingTheme(false);
    }
  }

  if (!me || !page || !state) {
    return <LoadingState label="Loading builder" />;
  }

  return (
    <DashboardShell
      title={page.title}
      eyebrow="Page builder"
      description="Customize sections, preview responsive layouts, and publish the current draft."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Builder" }]}
      onTenantChange={switchTenant}
      actions={
        <>
          <ButtonLink href={`/websites/${page.websiteId}`} variant="secondary">
            Pages
          </ButtonLink>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setState((current) => (current ? undo(current) : current))}
            disabled={!state.undoStack.length}
          >
            <Undo2 className="size-4" />
            Undo
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setState((current) => (current ? redo(current) : current))}
            disabled={!state.redoStack.length}
          >
            <Redo2 className="size-4" />
            Redo
          </Button>
          <Button type="button" onClick={() => void saveDraft()} disabled={isSaving}>
            <Save className="size-4" />
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={() => void publishDraft()}>
            <Send className="size-4" />
            Publish
          </Button>
        </>
      }
    >
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {validationErrors.length ? <Alert>{validationErrors[0]}</Alert> : null}

      <div className="grid min-h-[calc(100vh-220px)] overflow-hidden rounded-lg border bg-surface shadow-sm shadow-slate-950/5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="grid content-start gap-5 border-b bg-surface p-4 xl:border-b-0 xl:border-r">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Template</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Sections</h2>
          </div>
          <div className="grid gap-4">
            <PanelCategory
              title="Layout"
              parentId={state.selectedNodeId ?? state.document.rootNodeId}
              onAdd={addChild}
              types={["section", "container"]}
            />
            <PanelCategory
              title="Content"
              parentId={state.selectedNodeId ?? state.document.rootNodeId}
              onAdd={addChild}
              types={["heading", "text", "image", "button"]}
            />
          </div>
          {theme ? (
            <ThemePanel
              theme={theme}
              dirty={themeDirty}
              isSaving={isSavingTheme}
              onChange={updateThemeToken}
              onUndo={undoThemeChange}
              onRedo={redoThemeChange}
              onSave={() => void saveTheme()}
              onReset={() => setConfirmThemeReset(true)}
              canUndo={themeUndoStack.length > 0}
              canRedo={themeRedoStack.length > 0}
            />
          ) : null}
          <div className="border-t pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Layers</h3>
              <Badge tone="info">{Object.keys(state.document.nodes).length} nodes</Badge>
            </div>
            <TreeView
              document={state.document}
              nodeId={state.document.rootNodeId}
              selectedNodeId={state.selectedNodeId}
              onSelect={(nodeId) => setState({ ...state, selectedNodeId: nodeId })}
            />
          </div>
        </aside>

        <main className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-surface px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Eye className="size-4" />
                Preview
              </div>
              <p className="text-xs text-muted-foreground">Click an element to edit it in the inspector.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={state.dirty ? "warning" : "success"}>
                {state.dirty ? "unsaved" : "saved"}
              </Badge>
              <Badge tone="info">rev {revision}</Badge>
              <ViewportButton
                viewport="desktop"
                active={state.viewport}
                onClick={() => setState({ ...state, viewport: "desktop" })}
              />
              <ViewportButton
                viewport="tablet"
                active={state.viewport}
                onClick={() => setState({ ...state, viewport: "tablet" })}
              />
              <ViewportButton
                viewport="mobile"
                active={state.viewport}
                onClick={() => setState({ ...state, viewport: "mobile" })}
              />
            </div>
          </div>
          <div className="min-h-0 overflow-auto p-5">
            <div className="mx-auto grid min-h-full place-items-start">
              <div
                className="mx-auto min-h-[680px] overflow-hidden rounded-lg border bg-surface shadow-lg shadow-slate-950/10 transition-[max-width]"
                style={{ maxWidth: viewportWidth(state.viewport), width: "100%" }}
              >
                <BuilderRuntimeRenderer
                  document={state.document}
                  editorMode
                selectedNodeId={state.selectedNodeId}
                viewport={state.viewport}
                theme={theme}
                onSelectNode={(nodeId) => setState({ ...state, selectedNodeId: nodeId })}
              />
              </div>
            </div>
          </div>
        </main>

        <aside className="grid max-h-[calc(100vh-220px)] content-start gap-4 overflow-auto border-t bg-surface p-4 xl:border-l xl:border-t-0">
          <div className="sticky top-0 z-10 -mx-4 border-b bg-surface px-4 pb-4">
            <SectionHeader
              title="Inspector"
              description={selectedNode ? nodeRegistry[selectedNode.type].displayName : "Select a section or block."}
              actions={selectedNode ? <StatusIndicator tone="info" label={selectedNode.type} /> : null}
            />
          </div>
          {selectedNode ? (
            <form className="grid gap-4" onSubmit={saveDraft}>
              <div className="rounded-lg border bg-surface-secondary/70 p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <MousePointer2 className="size-4" />
                  {selectedNode.id}
                </div>
              </div>
              <PropertiesPanel
                node={selectedNode}
                viewport={state.viewport}
                copiedStyles={copiedStyles}
                onChange={updateProperty}
                onStyleChange={updateStyle}
                onResetStyles={resetStyles}
                onCopyStyles={() => setCopiedStyles(structuredClone(selectedNode.styles ?? {}))}
                onPasteStyles={pasteStyles}
              />
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => moveSelected(-1)}
                  aria-label="Move selected node up"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => moveSelected(1)}
                  aria-label="Move selected node down"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={removeSelectedNode}
                  disabled={selectedNode.id === state.document.rootNodeId}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
            </form>
          ) : (
            <EmptyState
              title="No node selected"
              description="Select a node on the canvas or in the layer tree."
            />
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={confirmThemeReset}
        title="Reset theme"
        description="Reset every theme token for this website to the default theme? Local node overrides will remain unchanged."
        confirmLabel="Reset theme"
        danger
        onClose={() => setConfirmThemeReset(false)}
        onConfirm={() => void resetTheme()}
      />
    </DashboardShell>
  );
}

function PanelCategory({
  title,
  types,
  parentId,
  onAdd,
}: {
  title: string;
  types: BuilderNodeType[];
  parentId: string;
  onAdd: (parentId: string, type: BuilderNodeType) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{title}</span>
      <div className="grid grid-cols-2 gap-2">
        {types.map((type) => (
          <Button
            key={type}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onAdd(parentId, type)}
          >
            <Plus className="size-4" />
            {nodeRegistry[type].displayName}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ThemePanel({
  theme,
  dirty,
  isSaving,
  onChange,
  onUndo,
  onRedo,
  onSave,
  onReset,
  canUndo,
  canRedo,
}: {
  theme: WebsiteTheme;
  dirty: boolean;
  isSaving: boolean;
  onChange: (path: string, value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const tokens = theme.tokens;
  return (
    <div className="grid gap-3 rounded-lg border bg-surface-secondary/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Design</h3>
          <p className="text-xs leading-5 text-muted-foreground">Website theme tokens</p>
        </div>
        <Badge tone={dirty ? "warning" : "success"}>{dirty ? "unsaved" : "saved"}</Badge>
      </div>
      <div className="grid gap-3">
        <ThemeColor label="Primary" value={tokens.colors.primary} onChange={(value) => onChange("colors.primary", value)} />
        <ThemeColor label="Secondary" value={tokens.colors.secondary} onChange={(value) => onChange("colors.secondary", value)} />
        <ThemeColor label="Background" value={tokens.colors.background} onChange={(value) => onChange("colors.background", value)} />
        <ThemeColor label="Text" value={tokens.colors.foreground} onChange={(value) => onChange("colors.foreground", value)} />
        <ThemeColor label="Muted" value={tokens.colors.muted} onChange={(value) => onChange("colors.muted", value)} />
        <ThemeColor label="Border" value={tokens.colors.border} onChange={(value) => onChange("colors.border", value)} />
        <ThemeColor label="Success" value={tokens.colors.success} onChange={(value) => onChange("colors.success", value)} />
        <ThemeColor label="Warning" value={tokens.colors.warning} onChange={(value) => onChange("colors.warning", value)} />
        <ThemeColor label="Danger" value={tokens.colors.danger} onChange={(value) => onChange("colors.danger", value)} />
      </div>
      <div className="grid gap-2 border-t pt-3">
        <ThemeSelect label="Heading size" value={tokens.typography.heading.fontSize} options={["2xl", "3xl", "4xl", "5xl"]} onChange={(value) => onChange("typography.heading.fontSize", value)} />
        <ThemeSelect label="Body size" value={tokens.typography.body.fontSize} options={["sm", "base", "lg", "xl"]} onChange={(value) => onChange("typography.body.fontSize", value)} />
        <ThemeInput label="Spacing lg" value={tokens.spacing.lg} onChange={(value) => onChange("spacing.lg", value)} />
        <ThemeSelect label="Button radius" value={tokens.radius.md} options={["none", "sm", "md", "lg", "xl", "full"]} onChange={(value) => onChange("radius.md", value)} />
        <ThemeSelect label="Shadow md" value={tokens.shadows.md} options={["none", "sm", "md", "lg"]} onChange={(value) => onChange("shadows.md", value)} />
        <ThemeInput label="Content width" value={tokens.layout.container.content} onChange={(value) => onChange("layout.container.content", value)} />
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button type="button" size="sm" variant="secondary" onClick={onUndo} disabled={!canUndo}>
          Undo
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onRedo} disabled={!canRedo}>
          Redo
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isSaving || !dirty}>
          {isSaving ? "Saving" : "Save theme"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

function ThemeColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-foreground">
      <span>{label}</span>
      <span className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
        <input className="h-9 w-full rounded-md border bg-surface p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <Input className="h-9 min-h-9 px-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function ThemeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-foreground">
      <span>{label}</span>
      <Input className="h-9 min-h-9 px-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ThemeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-foreground">
      <span>{label}</span>
      <Select className="h-9 min-h-9 px-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
    </label>
  );
}

function TreeView({
  document,
  nodeId,
  selectedNodeId,
  onSelect,
  depth = 0,
}: {
  document: BuilderDocument;
  nodeId: string;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  depth?: number;
}) {
  const node = document.nodes[nodeId];
  if (!node) {
    return null;
  }
  return (
    <div className="grid gap-1">
      <button
        type="button"
        className={`rounded-lg px-3 py-2 text-left text-sm ${selectedNodeId === nodeId ? "bg-primary text-primary-foreground" : "hover:bg-surface-secondary"}`}
        style={{ marginLeft: depth * 12 }}
        onClick={() => onSelect(nodeId)}
      >
        {nodeRegistry[node.type].displayName}
      </button>
      {(node.children ?? []).map((childId) => (
        <TreeView
          key={childId}
          document={document}
          nodeId={childId}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function ViewportButton({
  viewport,
  active,
  onClick,
}: {
  viewport: BuilderViewport;
  active: BuilderViewport;
  onClick: () => void;
}) {
  const Icon = viewport === "desktop" ? Monitor : viewport === "tablet" ? Tablet : Smartphone;
  return (
    <Button
      type="button"
      variant={active === viewport ? "primary" : "secondary"}
      size="sm"
      onClick={onClick}
    >
      <Icon className="size-4" />
      {viewport}
    </Button>
  );
}

function viewportWidth(viewport: BuilderViewport) {
  if (viewport === "mobile") {
    return "390px";
  }
  if (viewport === "tablet") {
    return "820px";
  }
  return "1024px";
}

function PropertiesPanel({
  node,
  viewport,
  copiedStyles,
  onChange,
  onStyleChange,
  onResetStyles,
  onCopyStyles,
  onPasteStyles,
}: {
  node: BuilderNode;
  viewport: BuilderViewport;
  copiedStyles: BuilderResponsiveStyles | null;
  onChange: (property: PropertyDefinition, value: unknown) => void;
  onStyleChange: (key: keyof BuilderStyleBlock, value: unknown) => void;
  onResetStyles: (keys: Array<keyof BuilderStyleBlock>) => void;
  onCopyStyles: () => void;
  onPasteStyles: () => void;
}) {
  const properties = nodeRegistry[node.type].properties;
  const resolved = resolveStyles(node.styles, viewport);

  return (
    <div className="grid gap-5">
      <PropertyGroup
        title="Responsive"
        description={`Editing ${viewport === "desktop" ? "base desktop styles" : `${viewport} overrides`}.`}
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCopyStyles}>
            <Copy className="size-4" />
            Copy styles
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onPasteStyles}
            disabled={!copiedStyles}
          >
            Paste styles
          </Button>
        </div>
      </PropertyGroup>

      {properties.length ? (
        <PropertyGroup title="Content">
          {properties.map((property) => {
            const value = node.props?.[property.key] ?? property.defaultValue ?? "";
            return (
              <PropertyField
                key={property.key}
                property={property}
                value={value}
                onChange={onChange}
              />
            );
          })}
        </PropertyGroup>
      ) : null}

      {node.type === "section" || node.type === "container" ? (
        <PropertyGroup
          title="Layout"
          action={
            <ResetButton
              onClick={() =>
                onResetStyles(["display", "direction", "align", "justify", "gap", "wrap"])
              }
            />
          }
        >
          <StyleSelect
            label="Display"
            value={resolved.display ?? ""}
            options={["", "block", "flex"]}
            onChange={(value) => onStyleChange("display", value || undefined)}
          />
          <StyleSelect
            label="Direction"
            value={resolved.direction ?? ""}
            options={["", "row", "column"]}
            onChange={(value) => onStyleChange("direction", value || undefined)}
          />
          <StyleSelect
            label="Align"
            value={resolved.align ?? ""}
            options={["", "start", "center", "end", "stretch"]}
            onChange={(value) => onStyleChange("align", value || undefined)}
          />
          <StyleSelect
            label="Justify"
            value={resolved.justify ?? ""}
            options={["", "start", "center", "end", "between"]}
            onChange={(value) => onStyleChange("justify", value || undefined)}
          />
          <StyleInput
            label="Gap"
            value={styleControlValue(resolved.gap)}
            onChange={(value) => onStyleChange("gap", value || undefined)}
          />
        </PropertyGroup>
      ) : null}

      <PropertyGroup
        title="Spacing"
        action={<ResetButton onClick={() => onResetStyles(["margin", "padding"])} />}
      >
        <BoxModelControl
          label="Margin"
          value={resolved.margin}
          onChange={(value) => onStyleChange("margin", value)}
        />
        <BoxModelControl
          label="Padding"
          value={resolved.padding}
          onChange={(value) => onStyleChange("padding", value)}
        />
      </PropertyGroup>

      <PropertyGroup
        title="Size"
        action={
          <ResetButton
            onClick={() =>
              onResetStyles(["width", "maxWidth", "minWidth", "height", "minHeight", "maxHeight"])
            }
          />
        }
      >
        <StyleInput
          label="Width"
          value={styleControlValue(resolved.width)}
          onChange={(value) => onStyleChange("width", value || undefined)}
        />
        <StyleInput
          label="Max width"
          value={styleControlValue(resolved.maxWidth)}
          onChange={(value) => onStyleChange("maxWidth", value || undefined)}
        />
        <StyleInput
          label="Min height"
          value={styleControlValue(resolved.minHeight)}
          onChange={(value) => onStyleChange("minHeight", value || undefined)}
        />
      </PropertyGroup>

      {node.type === "heading" || node.type === "text" || node.type === "button" ? (
        <PropertyGroup
          title="Typography"
          action={
            <ResetButton
              onClick={() =>
                onResetStyles([
                  "fontSize",
                  "fontWeight",
                  "lineHeight",
                  "letterSpacing",
                  "textAlign",
                  "textColor",
                ])
              }
            />
          }
        >
          <StyleSelect
            label="Size"
            value={styleControlValue(resolved.fontSize)}
            options={["", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"]}
            onChange={(value) => onStyleChange("fontSize", value || undefined)}
          />
          <StyleSelect
            label="Weight"
            value={styleControlValue(resolved.fontWeight)}
            options={["", "normal", "medium", "semibold", "bold", "black"]}
            onChange={(value) => onStyleChange("fontWeight", value || undefined)}
          />
          <StyleSelect
            label="Line height"
            value={styleControlValue(resolved.lineHeight)}
            options={["", "tight", "normal", "relaxed"]}
            onChange={(value) => onStyleChange("lineHeight", value || undefined)}
          />
          <StyleSelect
            label="Align"
            value={resolved.textAlign ?? ""}
            options={["", "left", "center", "right"]}
            onChange={(value) => onStyleChange("textAlign", value || undefined)}
          />
        </PropertyGroup>
      ) : null}

      <PropertyGroup
        title="Colors"
        action={
          <ResetButton
            onClick={() => onResetStyles(["backgroundColor", "textColor", "borderColor"])}
          />
        }
      >
        <ColorControl
          label="Background"
          value={styleControlValue(resolved.backgroundColor)}
          onChange={(value) => onStyleChange("backgroundColor", value)}
        />
        <ColorControl
          label="Text"
          value={styleControlValue(resolved.textColor)}
          onChange={(value) => onStyleChange("textColor", value)}
        />
        <ColorControl
          label="Border"
          value={styleControlValue(resolved.borderColor)}
          onChange={(value) => onStyleChange("borderColor", value)}
        />
      </PropertyGroup>

      <PropertyGroup
        title="Border & Shadow"
        action={
          <ResetButton
            onClick={() => onResetStyles(["borderWidth", "borderStyle", "borderRadius", "shadow"])}
          />
        }
      >
        <StyleSelect
          label="Border width"
          value={resolved.borderWidth ?? ""}
          options={["", "none", "thin", "medium"]}
          onChange={(value) => onStyleChange("borderWidth", value || undefined)}
        />
        <StyleSelect
          label="Border style"
          value={resolved.borderStyle ?? ""}
          options={["", "solid", "dashed"]}
          onChange={(value) => onStyleChange("borderStyle", value || undefined)}
        />
        <StyleSelect
          label="Radius"
          value={styleControlValue(resolved.borderRadius)}
          options={["", "none", "sm", "md", "lg", "xl", "full"]}
          onChange={(value) => onStyleChange("borderRadius", value || undefined)}
        />
        <StyleSelect
          label="Shadow"
          value={styleControlValue(resolved.shadow)}
          options={["", "none", "sm", "md", "lg"]}
          onChange={(value) => onStyleChange("shadow", value || undefined)}
        />
      </PropertyGroup>

      {node.type === "image" ? (
        <PropertyGroup
          title="Image"
          action={
            <ResetButton
              onClick={() => onResetStyles(["objectFit", "objectPosition", "opacity"])}
            />
          }
        >
          <StyleSelect
            label="Fit"
            value={resolved.objectFit ?? ""}
            options={["", "cover", "contain"]}
            onChange={(value) => onStyleChange("objectFit", value || undefined)}
          />
          <StyleSelect
            label="Position"
            value={resolved.objectPosition ?? ""}
            options={["", "center", "top", "bottom", "left", "right"]}
            onChange={(value) => onStyleChange("objectPosition", value || undefined)}
          />
          <StyleInput
            label="Opacity"
            value={resolved.opacity === undefined ? "" : String(resolved.opacity)}
            onChange={(value) => onStyleChange("opacity", value === "" ? undefined : Number(value))}
          />
        </PropertyGroup>
      ) : null}
    </div>
  );
}

function PropertyGroup({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-xl border bg-surface-secondary/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <PaintBucket className="size-4" />
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Reset style group"
    >
      <RotateCcw className="size-4" />
    </Button>
  );
}

function StyleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="auto, 24px, 2rem, 100%"
      />
    </Field>
  );
}

function StyleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || "inherit"} value={option}>
            {option || "Inherit"}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-[15px] font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colorPresets.map((color) => (
          <button
            key={`${label}-${color.value}`}
            type="button"
            className="size-7 rounded-full border shadow-sm"
            style={{ backgroundColor: color.value === "transparent" ? "transparent" : color.value }}
            title={color.label}
            onClick={() => onChange(color.value)}
          />
        ))}
      </div>
      <Input
        value={value}
        onChange={(event) => onChange(normalizeColor(event.target.value) ?? event.target.value)}
        placeholder="#111827 or transparent"
      />
    </div>
  );
}

function BoxModelControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BuilderStyleBlock["margin"];
  onChange: (value: BuilderStyleBlock["margin"]) => void;
}) {
  const current = value ?? {};
  function setSide(side: "top" | "right" | "bottom" | "left", nextValue: string) {
    const next = { ...current };
    const normalized = toOptionalLength(nextValue);
    if (normalized) {
      next[side] = normalized;
    } else {
      delete next[side];
    }
    onChange(next);
  }
  function linkAll(nextValue: string) {
    const normalized = toOptionalLength(nextValue);
    const next: BoxSpacing = {};
    if (normalized) {
      next.top = normalized;
      next.right = normalized;
      next.bottom = normalized;
      next.left = normalized;
    }
    onChange(next);
  }
  return (
    <div className="grid gap-2 rounded-lg border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          Reset
        </Button>
      </div>
      <Input placeholder="Link all" onChange={(event) => linkAll(event.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={`${label} top`}
          placeholder="Top"
          value={current.top ?? ""}
          onChange={(event) => setSide("top", event.target.value)}
        />
        <Input
          aria-label={`${label} right`}
          placeholder="Right"
          value={current.right ?? ""}
          onChange={(event) => setSide("right", event.target.value)}
        />
        <Input
          aria-label={`${label} bottom`}
          placeholder="Bottom"
          value={current.bottom ?? ""}
          onChange={(event) => setSide("bottom", event.target.value)}
        />
        <Input
          aria-label={`${label} left`}
          placeholder="Left"
          value={current.left ?? ""}
          onChange={(event) => setSide("left", event.target.value)}
        />
      </div>
    </div>
  );
}

function toOptionalLength(value: string): BuilderLength | undefined {
  return value ? (value as BuilderLength) : undefined;
}

function PropertyField({
  property,
  value,
  onChange,
}: {
  property: PropertyDefinition;
  value: unknown;
  onChange: (property: PropertyDefinition, value: unknown) => void;
}) {
  if (property.type === "textarea") {
    return (
      <Field
        label={property.label}
        {...(property.description ? { hint: property.description } : {})}
      >
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(property, event.target.value)}
        />
      </Field>
    );
  }
  if (property.type === "select") {
    return (
      <Field
        label={property.label}
        {...(property.description ? { hint: property.description } : {})}
      >
        <Select
          value={String(value)}
          onChange={(event) => onChange(property, parseSelectValue(property, event.target.value))}
        >
          {property.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (property.type === "number") {
    return (
      <Field
        label={property.label}
        {...(property.description ? { hint: property.description } : {})}
      >
        <Input
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => onChange(property, Number(event.target.value))}
        />
      </Field>
    );
  }
  if (property.type === "toggle") {
    return (
      <label className="flex items-center gap-2 rounded-lg border bg-surface px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(property, event.target.checked)}
        />
        {property.label}
      </label>
    );
  }
  return (
    <Field label={property.label} {...(property.description ? { hint: property.description } : {})}>
      <Input
        type={property.type === "url" ? "url" : "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(property, event.target.value)}
      />
    </Field>
  );
}

function parseSelectValue(property: PropertyDefinition, value: string) {
  const match = property.options?.find((option) => String(option.value) === value);
  return match?.value ?? value;
}

function setDeepToken(tokens: WebsiteThemeTokens, path: string, value: string) {
  const parts = path.split(".");
  let current: unknown = tokens;

  for (const part of parts.slice(0, -1)) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return;
    }
    current = (current as Record<string, unknown>)[part];
  }

  const last = parts[parts.length - 1];
  if (!last || typeof current !== "object" || current === null || Array.isArray(current)) {
    return;
  }

  if (last in current) {
    (current as Record<string, string>)[last] = value;
  }
}

function styleControlValue(value: unknown) {
  if (isTokenReference(value)) {
    return `token:${value.value}`;
  }

  return typeof value === "string" ? value : "";
}
