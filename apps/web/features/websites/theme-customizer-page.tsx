"use client";

import { ArrowLeft, ChevronDown, Clipboard, Download, FileText, Grid2x2, Laptop, LayoutGrid, PanelLeftClose, PanelLeftOpen, Redo2, Settings2, Smartphone, Tablet, Undo2, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import { Badge } from "../../components/ui/display";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { FloatingPanel } from "./customizer/floating-panel";
import { apiRequest } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import { CustomizerOutline } from "./customizer/section-tree";
import { CustomizerInspector } from "./customizer/inspector";
import { IconAction } from "./customizer/preview-renderer";
import { isThemeFrameMessage, postToFrame, THEME_FRAME_ACTION, THEME_FRAME_READY, THEME_FRAME_UPDATE } from "./customizer/frame-protocol";
import { expandFormShortcodes } from "./customizer/shortcodes";
import {
  createBlock,
  createSectionInstance,
  duplicateBlock,
  duplicateSectionInstance,
  findSectionGroup,
  getAllGroupSections,
  getCustomizerPageOptions,
  getGroupSections,
  groupSchemas,
  insertSectionAfter,
  moveBlockWithDepth,
  moveItem,
  resolvePageTemplateId,
  setGroupSections,
  setNestedValue,
} from "./customizer/state";
import { resolveThemeRenderer } from "./customizer/theme-renderer";
import type { CustomizerPageOption, SectionGroupKey, SectionGroups, SectionInstance, SelectedItem, Viewport } from "./customizer/types";
import { useHistoryState } from "./customizer/use-history-state";
import type { PageSummary, ThemeDraftSummary, ThemeInstallationSummary, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

/** The URL a shortcode-expanded form's own action should post to — same convention as lib/api.ts. */
const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function ThemeCustomizerPage({
  websiteId,
  themeId,
  initialPageId,
}: {
  websiteId: string;
  themeId: string;
  /** Preselects this real page (e.g. the page-builder route hands off a specific page) instead of defaulting to the first page option. */
  initialPageId?: string;
}) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [theme, setTheme] = useState<ThemeInstallationSummary | null>(null);
  const [draft, setDraft] = useState<ThemeDraftSummary | null>(null);
  const { value: settings, commit: commitSettings, reset: resetSettings, undo, redo, canUndo, canRedo } = useHistoryState<Record<string, unknown>>({});
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selected, setSelected] = useState<SelectedItem>({ kind: "theme" });
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [splitRatio, setSplitRatio] = useState(0.52);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [sectionEditPanelOpen, setSectionEditPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const canvasFrameRef = useRef<HTMLIFrameElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const shortcodeCacheRef = useRef<Map<string, string>>(new Map());
  /** Tracks the last `initialPageId` this component synced to, so a change in that prop (navigating from one page's builder link to another's, which Next.js re-renders in place rather than remounting) forces the switcher — and the actual content being edited — to follow, instead of staying stuck on whichever page loaded first. */
  const syncedInitialPageIdRef = useRef<string | undefined>(undefined);
  /**
   * Bumped every time the canvas frame announces itself (0 = never yet).
   * A plain boolean raced with the iframe's own `load` event: `load` fires
   * after all subresources settle, which is typically AFTER the frame has
   * mounted and posted READY — so resetting on load clobbered the ready
   * flag and silently blocked every payload from then on. A counter also
   * re-fires the send effect when the frame reloads and re-announces,
   * which a boolean already stuck at `true` would not.
   */
  const [canvasFrameNonce, setCanvasFrameNonce] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantsResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        void tenantsResponse;
        setMe(meResponse);
        if (!meResponse.activeTenant) {
          router.push("/login");
          return;
        }
        const [websiteResponse, themesResponse, draftResponse, pagesResponse] = await Promise.all([
          apiRequest<WebsiteSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}`),
          apiRequest<ThemeInstallationSummary[]>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes`),
          apiRequest<ThemeDraftSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes/${themeId}/draft`),
          apiRequest<PageSummary[]>(`/websites/${websiteId}/pages`),
        ]);
        setWebsite(websiteResponse);
        setTheme(themesResponse.find((item) => item.id === themeId) ?? null);
        setDraft(draftResponse);
        resetSettings(draftResponse.settings);
        setPages(pagesResponse);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Theme customizer failed to load");
      }
    }

    void load();
  }, [router, themeId, websiteId]);

  const { globalSchema, sectionSchemas, getTemplateScope } = useMemo(() => resolveThemeRenderer(theme, draft), [draft, theme]);
  const pageOptions = useMemo(() => getCustomizerPageOptions(pages, draft), [draft, pages]);
  const selectedPage = pageOptions.find((page) => page.id === selectedPageId) ?? pageOptions[0] ?? null;
  const pageKey = selectedPage?.id ?? "template-home";
  const templateId = useMemo(() => resolvePageTemplateId(selectedPage), [selectedPage]);
  const templateScope = useMemo(() => getTemplateScope(templateId), [getTemplateScope, templateId]);
  const groups = useMemo(
    () => getAllGroupSections(settings, pageKey, sectionSchemas, templateScope),
    [pageKey, sectionSchemas, settings, templateScope],
  );
  const selectedItemLabel = useMemo(() => {
    if (selected.kind === "theme") return "Theme settings";
    const allSections = [...groups.header, ...groups.template, ...groups.footer];
    const section = allSections.find((item) => item.id === selected.sectionId);
    if (selected.kind === "block") {
      const block = section?.blocks.find((item) => item.id === selected.blockId);
      return block ? `${section?.name} · ${block.name}` : "Edit block";
    }
    return section?.name ?? "Edit section";
  }, [groups, selected]);

  useEffect(() => {
    // Before the draft/page list has actually loaded, getCustomizerPageOptions
    // returns a one-item PLACEHOLDER ([{ id: "template-home", ... }]), never a
    // true empty array — so `pageOptions.length` alone can't tell "not loaded
    // yet" from "real data". Syncing against that placeholder would resolve
    // initialPageId to nothing, fall back to it, and then (since it already
    // matches syncedInitialPageIdRef) never re-sync once the real pages arrive.
    if (!draft || !pageOptions.length) return;
    const initialPageIdChanged = syncedInitialPageIdRef.current !== initialPageId;
    if (selectedPageId && !initialPageIdChanged) return;
    syncedInitialPageIdRef.current = initialPageId;
    const initial = initialPageId ? pageOptions.find((option) => option.id === initialPageId) : undefined;
    setSelectedPageId((initial ?? pageOptions[0]!).id);
    setSelected({ kind: "theme" });
  }, [draft, initialPageId, pageOptions, selectedPageId]);

  function changePage(nextPageId: string) {
    setSelectedPageId(nextPageId);
    setSelected({ kind: "theme" });
  }

  function exportPageSections() {
    const payload = {
      kind: "stackbuilder-page-sections",
      version: 1,
      pageTitle: selectedPage?.label ?? "Page",
      templateId,
      sections: groups.template,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugifyFileName(selectedPage?.label ?? "page")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Page exported");
  }

  function importPageSectionsFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { sections?: unknown };
        if (!Array.isArray(parsed.sections)) {
          throw new Error("File has no page sections to import");
        }
        updateGroup("template", () => parsed.sections as SectionInstance[]);
        toast.success("Page imported");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Import failed — not a valid page export file");
      }
    };
    reader.onerror = () => toast.error("Could not read the selected file");
    reader.readAsText(file);
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(`/websites/${websiteId}/themes`);
  }

  function updateGroup(group: SectionGroupKey, updater: (sections: SectionInstance[]) => SectionInstance[], options?: { coalesce?: boolean }) {
    commitSettings((current) => {
      // Omitting templateScope here used to silently fall through to "every schema in this
      // group" whenever the page had no sections saved yet (getGroupSections only applies the
      // template's real, often-empty default list when it's given the scope) — so the very
      // first edit on a blank template populated every section at once instead of just the one
      // being added.
      const sections = getGroupSections(current, group, pageKey, sectionSchemas, templateScope);
      return setGroupSections(current, group, pageKey, updater(sections), sectionSchemas);
    }, options);
  }

  function toggleExpand(sectionId: string) {
    setExpandedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function addSection(group: SectionGroupKey, schemaId?: string, afterSectionId?: string) {
    if (group === "template" && !templateScope.supportsSections) {
      toast.error("This page's template doesn't support custom sections");
      return;
    }
    const candidates = groupSchemas(sectionSchemas, group);
    const schema = candidates.find((item) => item.id === schemaId) ?? candidates[0];
    if (!schema) return;
    const section = createSectionInstance(schema);
    updateGroup(group, (sections) => insertSectionAfter(sections, section, afterSectionId));
    setExpandedSectionIds((current) => new Set(current).add(section.id));
    setSelected({ kind: "section", sectionId: section.id });
    toast.success(`${schema.name} section added`);
  }

  function duplicateSectionAction(sectionId: string) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    const index = groups[group].findIndex((item) => item.id === sectionId);
    if (index < 0) return;
    const copy = duplicateSectionInstance(groups[group][index]!);
    updateGroup(group, (sections) => {
      const idx = sections.findIndex((item) => item.id === sectionId);
      if (idx < 0) return sections;
      const next = [...sections];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelected({ kind: "section", sectionId: copy.id });
    toast.success("Section duplicated");
  }

  function deleteSectionAction(sectionId: string) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    updateGroup(group, (sections) => sections.filter((section) => section.id !== sectionId));
    if (selected.kind !== "theme" && selected.sectionId === sectionId) {
      setSelected({ kind: "theme" });
    }
    toast.success("Section deleted");
  }

  function toggleSectionAction(sectionId: string) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    updateGroup(group, (sections) => sections.map((section) => (section.id === sectionId ? { ...section, enabled: !section.enabled } : section)));
  }

  function reorderSectionAction(group: SectionGroupKey, from: number, to: number) {
    updateGroup(group, (sections) => moveItem(sections, from, to));
  }

  function moveSectionAction(sectionId: string, direction: "up" | "down") {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    const index = groups[group].findIndex((item) => item.id === sectionId);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= groups[group].length) return;
    reorderSectionAction(group, index, target);
  }

  function addBlockAction(sectionId: string, blockType?: string) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    const section = groups[group].find((item) => item.id === sectionId);
    const schema = sectionSchemas.find((item) => item.id === section?.schemaId);
    const blockSchema = schema?.blocks?.find((item) => item.type === blockType) ?? schema?.blocks?.[0];
    if (!section || !blockSchema) return;
    if (schema?.maxBlocks && section.blocks.length >= schema.maxBlocks) {
      toast.error("This section is at its block limit");
      return;
    }
    const block = createBlock(blockSchema);
    updateGroup(group, (sections) => sections.map((item) => (item.id === sectionId ? { ...item, blocks: [...item.blocks, block] } : item)));
    setExpandedSectionIds((current) => new Set(current).add(sectionId));
    setSelected({ kind: "block", sectionId, blockId: block.id });
  }

  function duplicateBlockAction(sectionId: string, blockId: string) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    const section = groups[group].find((item) => item.id === sectionId);
    const index = section?.blocks.findIndex((item) => item.id === blockId) ?? -1;
    if (!section || index < 0) return;
    const copy = duplicateBlock(section.blocks[index]!);
    updateGroup(group, (sections) =>
      sections.map((item) => {
        if (item.id !== sectionId) return item;
        const next = [...item.blocks];
        next.splice(index + 1, 0, copy);
        return { ...item, blocks: next };
      }),
    );
    setSelected({ kind: "block", sectionId, blockId: copy.id });
  }

  function deleteBlockAction(sectionId: string, blockId: string) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    updateGroup(group, (sections) => sections.map((section) => (section.id === sectionId ? { ...section, blocks: section.blocks.filter((block) => block.id !== blockId) } : section)));
    if (selected.kind === "block" && selected.sectionId === sectionId && selected.blockId === blockId) {
      setSelected({ kind: "section", sectionId });
    }
  }

  function reorderBlockAction(sectionId: string, from: number, to: number, depth?: number) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    updateGroup(group, (sections) =>
      sections.map((section) => {
        if (section.id !== sectionId) return section;
        const schema = sectionSchemas.find((item) => item.id === section.schemaId);
        // Nestable sections re-parent (and carry any children along); everything else is a plain reorder.
        const blocks = schema?.nestableBlockTypes?.length ? moveBlockWithDepth(section.blocks, from, to, depth, schema) : moveItem(section.blocks, from, to);
        return { ...section, blocks };
      }),
    );
  }

  function changeThemeSetting(controlId: string, value: unknown) {
    commitSettings((current) => setNestedValue(current, controlId, value), { coalesce: true });
  }

  function changeSectionSetting(sectionId: string, controlId: string, value: unknown) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    updateGroup(
      group,
      (sections) => sections.map((section) => (section.id === sectionId ? { ...section, settings: { ...section.settings, [controlId]: value } } : section)),
      { coalesce: true },
    );
  }

  function changeBlockSetting(sectionId: string, blockId: string, controlId: string, value: unknown) {
    const group = findSectionGroup(groups, sectionId);
    if (!group) return;
    updateGroup(
      group,
      (sections) =>
        sections.map((section) =>
          section.id === sectionId
            ? { ...section, blocks: section.blocks.map((block) => (block.id === blockId ? { ...block, settings: { ...block.settings, [controlId]: value } } : block)) }
            : section,
        ),
      { coalesce: true },
    );
  }

  async function saveDraft() {
    if (!me?.activeTenant || !draft) return;
    setSaving(true);
    try {
      const nextDraft = await apiRequest<ThemeDraftSummary>(
        `/tenants/${me.activeTenant.id}/websites/${websiteId}/themes/${themeId}/settings`,
        { method: "PATCH", body: JSON.stringify({ settings, expectedRevision: draft.revision }) },
      );
      setDraft(nextDraft);
      commitSettings(() => nextDraft.settings);
      toast.success("Theme draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Theme save failed");
    } finally {
      setSaving(false);
    }
  }

  async function publishTheme() {
    if (!me?.activeTenant) return;
    setPublishing(true);
    try {
      await saveDraft();
      await apiRequest(`/tenants/${me.activeTenant.id}/websites/${websiteId}/themes/${themeId}/publish`, { method: "POST" });
      setTheme((current) => (current ? { ...current, status: "PUBLISHED" } : current));
      toast.success("Theme published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== canvasFrameRef.current?.contentWindow) return;
      if (!isThemeFrameMessage(event.data)) return;
      const message = event.data;
      if (message.type === THEME_FRAME_READY) {
        setCanvasFrameNonce((current) => current + 1);
        return;
      }
      if (message.type !== THEME_FRAME_ACTION) return;
      if (message.action === "selectSection") setSelected({ kind: "section", sectionId: message.sectionId });
      else if (message.action === "openSettings") {
        setSelected(message.blockId ? { kind: "block", sectionId: message.sectionId, blockId: message.blockId } : { kind: "section", sectionId: message.sectionId });
        // With the sidebar collapsed the inspector isn't on screen, so the
        // gear opens the floating panel instead of just selecting.
        if (sidebarMinimized) setSectionEditPanelOpen(true);
      }
      else if (message.action === "selectBlock") setSelected({ kind: "block", sectionId: message.sectionId, blockId: message.blockId });
      else if (message.action === "toggleSection") toggleSectionAction(message.sectionId);
      else if (message.action === "duplicateSection") duplicateSectionAction(message.sectionId);
      else if (message.action === "deleteSection") deleteSectionAction(message.sectionId);
      else if (message.action === "moveSection") moveSectionAction(message.sectionId, message.direction);
      else if (message.action === "addSection") addSection(message.group, message.schemaId, message.afterSectionId);
      else if (message.action === "changeSectionSetting") changeSectionSetting(message.sectionId, message.controlId, message.value);
      else if (message.action === "deselect") setSelected({ kind: "theme" });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [groups, sectionSchemas, sidebarMinimized, templateScope]);

  useEffect(() => {
    if (!canvasFrameNonce || !website) return;
    let cancelled = false;

    void (async () => {
      // Cached by formId across every re-run (typing elsewhere on the page re-triggers this
      // effect too) so an already-resolved shortcode isn't re-fetched on every unrelated edit.
      const expandedGroups = (await expandFormShortcodes(groups, publicApiBaseUrl, shortcodeCacheRef.current)) as SectionGroups;
      if (cancelled) return;
      postToFrame(canvasFrameRef.current?.contentWindow, {
        type: THEME_FRAME_UPDATE,
        payload: {
          groups: expandedGroups,
          sectionSchemas,
          page: selectedPage,
          templateId,
          settings,
          selected,
          websiteName: website.name,
          editable: true,
          templateSupportsSections: templateScope.supportsSections,
          sidebarMinimized,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasFrameNonce, groups, sectionSchemas, selected, selectedPage, settings, sidebarMinimized, templateId, templateScope, website]);

  // Expanding the sidebar makes the floating panel redundant — its content is
  // already in the inspector, so leaving it open would just duplicate it.
  useEffect(() => {
    if (!sidebarMinimized) setSectionEditPanelOpen(false);
  }, [sidebarMinimized]);

  if (!me || !website || !draft) {
    return <BuilderLoadingState />;
  }

  return (
    <main className="grid h-svh grid-rows-[56px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importPageSectionsFromFile(file);
          event.target.value = "";
        }}
      />
      <TopBar
        canRedo={canRedo}
        canUndo={canUndo}
        lockedToPage={Boolean(initialPageId)}
        onSelectThemeSettings={() => setSelected({ kind: "theme" })}
        onBack={goBack}
        onChangePage={changePage}
        onExportPage={exportPageSections}
        onImportPageClick={() => importInputRef.current?.click()}
        onPublish={() => void publishTheme()}
        onRedo={redo}
        onSave={() => void saveDraft()}
        onUndo={undo}
        page={selectedPage}
        pageOptions={pageOptions}
        publishing={publishing}
        saving={saving}
        settings={settings}
        theme={theme}
        viewport={viewport}
        onViewportChange={setViewport}
      />

      <section className={cn("grid min-h-0 grid-cols-1", sidebarMinimized ? "lg:grid-cols-[44px_minmax(0,1fr)]" : "lg:grid-cols-[336px_minmax(0,1fr)]")}>
        {sidebarMinimized ? (
          <aside className="hidden min-h-0 flex-col items-center border-r bg-surface py-3 lg:flex">
            <IconAction label="Expand sidebar" onClick={() => setSidebarMinimized(false)}>
              <PanelLeftOpen className="size-4" />
            </IconAction>
          </aside>
        ) : (
          <aside className="flex min-h-0 flex-col border-r bg-surface">
            <div className="flex items-center justify-end border-b px-2 py-1.5">
              <IconAction
                label="Minimize sidebar"
                onClick={() => {
                  setSidebarMinimized(true);
                  if (selected.kind !== "theme") setSectionEditPanelOpen(true);
                }}
              >
                <PanelLeftClose className="size-4" />
              </IconAction>
            </div>
            <VerticalSplit
              ratio={splitRatio}
              onRatioChange={setSplitRatio}
              top={
                <CustomizerOutline
                  expandedSectionIds={expandedSectionIds}
                  globalSettingsCount={globalSchema.length}
                  groups={groups}
                  onAddBlock={addBlockAction}
                  onAddSection={addSection}
                  onDeleteBlock={deleteBlockAction}
                  onDeleteSection={deleteSectionAction}
                  onDuplicateBlock={duplicateBlockAction}
                  onDuplicateSection={duplicateSectionAction}
                  onReorderBlock={reorderBlockAction}
                  onReorderSection={reorderSectionAction}
                  onSelect={setSelected}
                  onToggleExpand={toggleExpand}
                  onToggleSection={toggleSectionAction}
                  sectionSchemas={sectionSchemas}
                  selected={selected}
                  templateSupportsSections={templateScope.supportsSections}
                />
              }
              bottom={
                <CustomizerInspector
                  globalSchema={globalSchema}
                  groups={groups}
                  onChangeBlockSetting={changeBlockSetting}
                  onChangeSectionSetting={changeSectionSetting}
                  onChangeThemeSetting={changeThemeSetting}
                  onDeleteBlock={deleteBlockAction}
                  onDeleteSection={deleteSectionAction}
                  onDuplicateBlock={duplicateBlockAction}
                  onDuplicateSection={duplicateSectionAction}
                  onToggleSection={toggleSectionAction}
                  sectionSchemas={sectionSchemas}
                  selected={selected}
                  themeSettings={settings}
                />
              }
            />
          </aside>
        )}

        {/* Collapsing the sidebar is a "show me the real site" gesture, so the
            desktop canvas drops its device-frame chrome and fills edge to edge.
            An explicit mobile/tablet viewport still wins — that cap is the
            whole point of picking one. */}
        <section
          className={cn(
            "flex min-h-0 flex-col bg-surface-secondary transition-all",
            sidebarMinimized && viewport === "desktop" ? "p-0" : "p-4 md:p-6",
          )}
        >
          <div
            className={cn(
              "mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface transition-all",
              sidebarMinimized && viewport === "desktop"
                ? "max-w-none rounded-none border-0 shadow-none"
                : cn("rounded-lg border shadow-xl shadow-slate-950/10", viewportWidthClass(viewport)),
            )}
          >
            <iframe
              ref={canvasFrameRef}
              title="Website canvas"
              src={`/websites/${websiteId}/themes/${themeId}/frame`}
              className="min-h-0 flex-1 border-0 bg-white"
            />
          </div>
        </section>
      </section>

      {sidebarMinimized ? (
        <FloatingPanel
          onClose={() => setSectionEditPanelOpen(false)}
          open={sectionEditPanelOpen}
          storageKey="customizer:section-panel"
          subtitle={selected.kind === "theme" ? undefined : "Drag the header to move · drag the corner to resize"}
          title={selectedItemLabel}
        >
          <CustomizerInspector
            globalSchema={globalSchema}
            groups={groups}
            onChangeBlockSetting={changeBlockSetting}
            onChangeSectionSetting={changeSectionSetting}
            onChangeThemeSetting={changeThemeSetting}
            onDeleteBlock={deleteBlockAction}
            onDeleteSection={deleteSectionAction}
            onDuplicateBlock={duplicateBlockAction}
            onDuplicateSection={duplicateSectionAction}
            onToggleSection={toggleSectionAction}
            sectionSchemas={sectionSchemas}
            selected={selected}
            themeSettings={settings}
          />
        </FloatingPanel>
      ) : null}
    </main>
  );
}



function BuilderLoadingState() {
  return (
    <main className="grid h-svh grid-rows-[56px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
      <header className="flex items-center gap-2 border-b bg-surface px-2.5 shadow-sm shadow-slate-950/5">
        <div className="h-9 w-9 rounded-md bg-slate-100" />
        <div className="flex items-center gap-0.5 border-l pl-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-9 w-9 rounded-md bg-slate-100" />
          ))}
        </div>
        <div className="flex min-w-0 items-center gap-2 border-l pl-2">
          <div className="h-4 w-36 rounded-full bg-slate-100" />
          <div className="h-6 w-20 rounded-full bg-slate-100" />
        </div>
        <div className="mx-auto hidden h-10 w-[min(540px,42vw)] rounded-lg border bg-surface shadow-sm lg:block">
          <div className="mx-4 mt-3 h-3 rounded-full bg-slate-100" />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden h-9 w-28 rounded-md border bg-surface-secondary/60 sm:block" />
          <div className="h-9 w-9 rounded-md bg-slate-100" />
          <div className="h-9 w-9 rounded-md bg-slate-100" />
          <div className="h-9 w-20 rounded-md bg-slate-950" />
        </div>
      </header>

      <section className="grid min-h-0 grid-cols-1 lg:grid-cols-[336px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r bg-surface">
          <div className="min-h-0 flex-[0_0_52%] overflow-hidden">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded-full bg-slate-200" />
                  <div className="h-5 w-32 rounded-full bg-slate-100" />
                </div>
                <div className="h-7 w-14 rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 h-12 rounded-lg border bg-surface shadow-sm">
                <div className="m-3 h-4 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((item) => (
                <motion.div
                  key={item}
                  className="rounded-lg border bg-surface"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: item * 0.07, duration: 0.3 }}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-100" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-28 rounded-full bg-slate-200" />
                      <div className="h-2.5 w-20 rounded-full bg-slate-100" />
                    </div>
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex items-center gap-4 border-t px-5 py-2.5">
                    {[0, 1, 2, 3].map((control) => (
                      <div key={control} className="h-4 w-4 rounded bg-slate-100" />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="h-1.5 border-y bg-slate-100" />
          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <div className="space-y-2">
              <div className="h-3 w-20 rounded-full bg-slate-200" />
              <div className="h-6 w-40 rounded-full bg-slate-100" />
            </div>
            <div className="mt-6 space-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-2">
                  <div className="h-3 w-28 rounded-full bg-slate-200" />
                  <div className="h-10 rounded-md border bg-surface">
                    <div className="m-3 h-3 rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-auto bg-surface-secondary p-4 md:p-6">
          <div className="mx-auto min-h-full overflow-hidden rounded-lg border bg-surface shadow-xl shadow-slate-950/10">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="space-y-2">
                <div className="h-3 w-28 rounded-full bg-slate-200" />
                <div className="h-5 w-44 rounded-full bg-slate-100" />
              </div>
              <div className="h-7 w-24 rounded-full bg-slate-100" />
            </div>
            <div className="space-y-5 p-5">
              <div className="h-[360px] rounded-md bg-slate-100" />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="h-36 rounded-md border bg-surface" />
                <div className="h-36 rounded-md border bg-surface" />
              </div>
              <div className="h-28 rounded-md bg-slate-100" />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function TopBar({
  canRedo,
  canUndo,
  lockedToPage,
  onSelectThemeSettings,
  onBack,
  onChangePage,
  onExportPage,
  onImportPageClick,
  onPublish,
  onRedo,
  onSave,
  onUndo,
  page,
  pageOptions,
  publishing,
  saving,
  settings,
  theme,
  viewport,
  onViewportChange,
}: {
  canRedo: boolean;
  canUndo: boolean;
  /** True when this customizer was opened from a specific page's builder link — the page switcher becomes a static label instead of an invitation to jump elsewhere. */
  lockedToPage: boolean;
  onSelectThemeSettings: () => void;
  onBack: () => void;
  onChangePage: (pageId: string) => void;
  onExportPage: () => void;
  onImportPageClick: () => void;
  onPublish: () => void;
  onRedo: () => void;
  onSave: () => void;
  onUndo: () => void;
  page: CustomizerPageOption | null;
  pageOptions: CustomizerPageOption[];
  publishing: boolean;
  saving: boolean;
  settings: Record<string, unknown>;
  theme: ThemeInstallationSummary | null;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
}) {
  return (
    <header className="flex items-center gap-2 border-b bg-surface px-2.5 shadow-sm shadow-slate-950/5">
      <Button type="button" size="icon" variant="ghost" onClick={onBack} aria-label="Back">
        <ArrowLeft className="size-4" />
      </Button>

      <div className="flex items-center gap-0.5 border-l pl-2">
        <ModeIcon active label="Sections">
          <LayoutGrid className="size-4" />
        </ModeIcon>
        <ModeIcon label="Theme settings" onClick={onSelectThemeSettings}>
          <Settings2 className="size-4" />
        </ModeIcon>
        <ModeIcon label="Section library (coming soon)" disabled>
          <Grid2x2 className="size-4" />
        </ModeIcon>
      </div>

      <div className="flex min-w-0 items-center gap-2 border-l pl-2">
        <p className="truncate text-[13px] font-semibold">{theme?.name ?? "Theme"}</p>
        <Badge tone={theme?.status === "PUBLISHED" ? "success" : "warning"}>{theme?.status.toLowerCase() ?? "draft"}</Badge>
      </div>

      <div className="mx-auto hidden lg:block">
        {lockedToPage ? (
          <div className="flex items-center gap-1.5 rounded-md border bg-surface-secondary/60 px-3 py-1.5 text-[12.5px] font-medium text-foreground">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="max-w-52 truncate">{page?.label ?? "Page"}</span>
          </div>
        ) : (
          <PageSwitcher onChange={onChangePage} page={page} pageOptions={pageOptions} />
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden items-center gap-0.5 rounded-md border bg-surface-secondary/60 p-0.5 sm:flex">
          <ViewportButton active={viewport === "desktop"} label="Desktop" onClick={() => onViewportChange("desktop")}>
            <Laptop className="size-3.5" />
          </ViewportButton>
          <ViewportButton active={viewport === "tablet"} label="Tablet" onClick={() => onViewportChange("tablet")}>
            <Tablet className="size-3.5" />
          </ViewportButton>
          <ViewportButton active={viewport === "mobile"} label="Mobile" onClick={() => onViewportChange("mobile")}>
            <Smartphone className="size-3.5" />
          </ViewportButton>
        </div>

        <Button type="button" size="icon" variant="ghost" disabled={!canUndo} onClick={onUndo} title="Undo">
          <Undo2 className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" disabled={!canRedo} onClick={onRedo} title="Redo">
          <Redo2 className="size-4" />
        </Button>

        <MoreMenu settings={settings} onExportPage={onExportPage} onImportPageClick={onImportPageClick} />

        {lockedToPage ? (
          // Editing one page — publish already saves the draft first (see
          // publishTheme), so a single button that does both reads as one
          // action here instead of a two-step save-then-publish the direct
          // theme-wide customizer still needs.
          <Button type="button" size="sm" disabled={saving || publishing} onClick={onPublish} title="Saves and makes this live">
            {saving || publishing ? "Saving…" : "Save"}
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" disabled={publishing} onClick={onPublish}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

function MoreMenu({
  settings,
  onExportPage,
  onImportPageClick,
}: {
  settings: Record<string, unknown>;
  onExportPage: () => void;
  onImportPageClick: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon" variant="ghost" aria-label="More options">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="10" r="1.7" />
            <circle cx="10" cy="10" r="1.7" />
            <circle cx="16" cy="10" r="1.7" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Page</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onExportPage}>
          <Download className="size-3.5" />
          Export page
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onImportPageClick}>
          <Upload className="size-3.5" />
          Import page
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Draft tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
            toast.success("Theme settings JSON copied");
          }}
        >
          <Clipboard className="size-3.5" />
          Copy settings JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PageSwitcher({ onChange, page, pageOptions }: { onChange: (pageId: string) => void; page: CustomizerPageOption | null; pageOptions: CustomizerPageOption[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-foreground shadow-sm shadow-slate-950/5 transition-colors hover:bg-surface-secondary">
          <span className="max-w-52 truncate">{page?.label ?? "Home page"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-80 min-w-64 overflow-y-auto">
        <DropdownMenuLabel>Pages</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pageOptions.map((option) => (
          <DropdownMenuItem key={option.id} onSelect={() => onChange(option.id)}>
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.id === page?.id ? <span className="size-1.5 shrink-0 rounded-full bg-info" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModeIcon({ active, children, disabled, label, onClick }: { active?: boolean; children: ReactNode; disabled?: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-info/10 text-info" : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ViewportButton({ active, children, label, onClick }: { active: boolean; children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      title={label}
      type="button"
      className={cn("grid size-7 place-items-center rounded transition-colors", active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function VerticalSplit({
  bottom,
  onRatioChange,
  ratio,
  top,
}: {
  bottom: ReactNode;
  onRatioChange: (ratio: number) => void;
  ratio: number;
  top: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    function handleMove(event: MouseEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextRatio = (event.clientY - rect.top) / rect.height;
      onRatioChange(Math.min(0.82, Math.max(0.15, nextRatio)));
    }
    function handleUp() {
      setDragging(false);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, onRatioChange]);

  return (
    <div ref={containerRef} className="grid min-h-0 flex-1" style={{ gridTemplateRows: `minmax(0,${ratio}fr) 5px minmax(0,${1 - ratio}fr)` }}>
      {/*
        overflow-x-hidden is load-bearing, not decorative: per the CSS Overflow spec, setting only
        overflow-y computes the other axis to "auto" too, not "visible" — so any child that
        overflows horizontally (a segmented control with long labels, a long section name, ...)
        was showing a horizontal scrollbar here instead of being contained/truncated by that
        child's own layout. Sidebar content should never need to scroll sideways.
      */}
      <div className="min-h-0 overflow-y-auto overflow-x-hidden">{top}</div>
      <div
        onMouseDown={() => setDragging(true)}
        className={cn("relative flex cursor-row-resize items-center justify-center border-y", dragging ? "bg-info/15" : "hover:bg-surface-secondary")}
      >
        <span className="h-1 w-8 rounded-full bg-border" />
      </div>
      <div className="min-h-0 overflow-y-auto overflow-x-hidden bg-surface-secondary/20">{bottom}</div>
    </div>
  );
}

function viewportWidthClass(viewport: Viewport) {
  if (viewport === "mobile") return "max-w-[390px]";
  if (viewport === "tablet") return "max-w-[820px]";
  return "max-w-[1280px]";
}

function slugifyFileName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "page";
}
