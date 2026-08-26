"use client";

import { ChevronRight, Copy, GripVertical, Plus, Power, Search, Settings2, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Input } from "../../../components/ui/form";
import { Modal } from "../../../components/ui/overlay";
import { cn } from "../../../lib/utils";
import { sectionIcon } from "./section-icons";
import { groupSchemas, MAX_BLOCK_DEPTH } from "./state";
import type { SectionGroupKey, SectionGroups, SectionInstance, SectionSchema, SelectedItem } from "./types";

/** Pixels of horizontal drag that equal one nesting level. */
const NEST_INDENT_PX = 18;

/**
 * Every nav item shares one block type ("Nav link"), so the type name alone
 * would render an unreadable wall of identical rows — show the link's own
 * label instead, falling back to the type name for blocks without one.
 */
function blockRowLabel(block: SectionInstance["blocks"][number]) {
  const label = block.settings?.label;
  return typeof label === "string" && label.trim() ? label.trim() : block.name;
}

const GROUP_LABELS: Record<SectionGroupKey, string> = {
  header: "Header",
  template: "Template",
  footer: "Footer",
};

export function CustomizerOutline({
  expandedSectionIds,
  globalSettingsCount,
  groups,
  onAddBlock,
  onAddSection,
  onDeleteBlock,
  onDeleteSection,
  onDuplicateBlock,
  onDuplicateSection,
  onReorderBlock,
  onReorderSection,
  onSelect,
  onToggleExpand,
  onToggleSection,
  sectionSchemas,
  selected,
  templateSupportsSections,
}: {
  expandedSectionIds: Set<string>;
  globalSettingsCount: number;
  groups: SectionGroups;
  onAddBlock: (sectionId: string, blockType?: string) => void;
  onAddSection: (group: SectionGroupKey, schemaId?: string) => void;
  onDeleteBlock: (sectionId: string, blockId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateBlock: (sectionId: string, blockId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onReorderBlock: (sectionId: string, from: number, to: number, depth?: number) => void;
  onReorderSection: (group: SectionGroupKey, from: number, to: number) => void;
  onSelect: (item: SelectedItem) => void;
  onToggleExpand: (sectionId: string) => void;
  onToggleSection: (sectionId: string) => void;
  sectionSchemas: SectionSchema[];
  selected: SelectedItem;
  templateSupportsSections: boolean;
}) {
  return (
    <div className="grid gap-4 p-3">
      <button
        type="button"
        onClick={() => onSelect({ kind: "theme" })}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] font-medium transition-colors",
          selected.kind === "theme" ? "bg-info/10 text-info" : "text-foreground hover:bg-surface-secondary",
        )}
      >
        <Settings2 className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Theme settings</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{globalSettingsCount}</span>
      </button>

      {(["header", "template", "footer"] as const).map((group) => (
        <SectionGroupList
          key={group}
          group={group}
          sections={groups[group]}
          schemas={groupSchemas(sectionSchemas, group)}
          selected={selected}
          expandedSectionIds={expandedSectionIds}
          onAddBlock={onAddBlock}
          onAddSection={onAddSection}
          onDeleteBlock={onDeleteBlock}
          onDeleteSection={onDeleteSection}
          onDuplicateBlock={onDuplicateBlock}
          onDuplicateSection={onDuplicateSection}
          onReorderBlock={onReorderBlock}
          onReorderSection={onReorderSection}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onToggleSection={onToggleSection}
          supportsSections={group === "template" ? templateSupportsSections : true}
        />
      ))}
    </div>
  );
}

function SectionGroupList({
  expandedSectionIds,
  group,
  onAddBlock,
  onAddSection,
  onDeleteBlock,
  onDeleteSection,
  onDuplicateBlock,
  onDuplicateSection,
  onReorderBlock,
  onReorderSection,
  onSelect,
  onToggleExpand,
  onToggleSection,
  schemas,
  sections,
  selected,
  supportsSections,
}: {
  expandedSectionIds: Set<string>;
  group: SectionGroupKey;
  onAddBlock: (sectionId: string, blockType?: string) => void;
  onAddSection: (group: SectionGroupKey, schemaId?: string) => void;
  onDeleteBlock: (sectionId: string, blockId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateBlock: (sectionId: string, blockId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onReorderBlock: (sectionId: string, from: number, to: number, depth?: number) => void;
  onReorderSection: (group: SectionGroupKey, from: number, to: number) => void;
  onSelect: (item: SelectedItem) => void;
  onToggleExpand: (sectionId: string) => void;
  onToggleSection: (sectionId: string) => void;
  schemas: SectionSchema[];
  sections: SectionInstance[];
  selected: SelectedItem;
  supportsSections: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (!schemas.length) return null;
  if (!supportsSections && !sections.length) {
    return (
      <div className="grid gap-0.5">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">{GROUP_LABELS[group]}</p>
        <p className="px-2 py-1.5 text-[12px] text-muted-foreground">This page's template doesn't support custom sections.</p>
      </div>
    );
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex !== null && dragIndex !== dropIndex) {
      onReorderSection(group, dragIndex, dropIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="grid gap-0.5">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">{GROUP_LABELS[group]}</p>
      {sections.map((section, index) => {
        const schema = schemas.find((item) => item.id === section.schemaId);
        const expanded = expandedSectionIds.has(section.id);
        const hasBlocks = Boolean(schema?.blocks?.length);
        return (
          <div
            key={section.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => {
              event.preventDefault();
              if (overIndex !== index) setOverIndex(index);
            }}
            onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn("rounded-md transition-shadow", overIndex === index && dragIndex !== null && dragIndex !== index ? "shadow-[0_-2px_0_0_theme(colors.info)]" : "")}
          >
            <div
              className={cn(
                "group flex items-center gap-1 rounded-md pr-1 text-[13px]",
                selected.kind === "section" && selected.sectionId === section.id ? "bg-info/10 text-info" : "hover:bg-surface-secondary",
                dragIndex === index ? "opacity-50" : "",
              )}
            >
              <span className="cursor-grab px-1 py-2 text-muted-foreground/50 active:cursor-grabbing" aria-hidden="true">
                <GripVertical className="size-3.5" />
              </span>
              {hasBlocks ? (
                <button type="button" onClick={() => onToggleExpand(section.id)} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted" aria-label={expanded ? "Collapse" : "Expand"}>
                  <ChevronRight className={cn("size-3.5 transition-transform", expanded ? "rotate-90" : "")} />
                </button>
              ) : (
                <span className="size-5 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect({ kind: "section", sectionId: section.id })}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left font-medium"
              >
                <span className={cn("truncate", section.enabled ? "" : "text-muted-foreground line-through decoration-1")}>{section.name}</span>
              </button>
              <RowMenu
                onDelete={() => onDeleteSection(section.id)}
                onDuplicate={() => onDuplicateSection(section.id)}
                onToggle={() => onToggleSection(section.id)}
                visible={section.enabled}
              />
            </div>
            {expanded && schema?.blocks?.length ? (
              <BlockList
                blockSchemas={schema.blocks}
                blocks={section.blocks}
                maxBlocks={schema.maxBlocks}
                onAddBlock={(blockType) => onAddBlock(section.id, blockType)}
                onDeleteBlock={(blockId) => onDeleteBlock(section.id, blockId)}
                onDuplicateBlock={(blockId) => onDuplicateBlock(section.id, blockId)}
                onReorderBlock={(from, to, depth) => onReorderBlock(section.id, from, to, depth)}
                onSelectBlock={(blockId) => onSelect({ kind: "block", sectionId: section.id, blockId })}
                sectionId={section.id}
                selected={selected}
                nestableBlockTypes={schema.nestableBlockTypes}
              />
            ) : null}
          </div>
        );
      })}
      {supportsSections ? <AddSectionButton group={group} schemas={schemas} onAdd={onAddSection} /> : null}
    </div>
  );
}

function BlockList({
  blockSchemas,
  blocks,
  maxBlocks,
  onAddBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onReorderBlock,
  onSelectBlock,
  sectionId,
  selected,
  nestableBlockTypes,
}: {
  blockSchemas: NonNullable<SectionSchema["blocks"]>;
  blocks: SectionInstance["blocks"];
  maxBlocks: number | undefined;
  onAddBlock: (blockType?: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onReorderBlock: (from: number, to: number, depth?: number) => void;
  onSelectBlock: (blockId: string) => void;
  sectionId: string;
  selected: SelectedItem;
  nestableBlockTypes?: string[] | undefined;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragDepth, setDragDepth] = useState<number | null>(null);
  const dragStartX = useRef(0);
  const atLimit = Boolean(maxBlocks && blocks.length >= maxBlocks);
  const canNest = (block: SectionInstance["blocks"][number]) => (nestableBlockTypes ?? []).includes(block.type);

  /**
   * Horizontal drag distance picks the nesting level, vertical picks the
   * position. Only clamped to the 0..MAX range here — `normalizeBlockDepths`
   * is what guarantees the result is a structurally valid tree, so the drag
   * can stay permissive instead of trying to predict the final parent.
   */
  function depthFromPointer(event: { clientX: number }, block: SectionInstance["blocks"][number]) {
    if (!canNest(block)) return undefined;
    const steps = Math.round((event.clientX - dragStartX.current) / NEST_INDENT_PX);
    return Math.max(0, Math.min(MAX_BLOCK_DEPTH, (block.depth ?? 0) + steps));
  }

  return (
    <div className="ml-6 grid gap-0.5 border-l pl-2">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          draggable
          style={{ marginLeft: (dragIndex === index && dragDepth !== null ? dragDepth : (block.depth ?? 0)) * NEST_INDENT_PX }}
          onDragStart={(event) => {
            dragStartX.current = event.clientX;
            setDragIndex(index);
            setDragDepth(block.depth ?? 0);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (overIndex !== index) setOverIndex(index);
            if (dragIndex !== null) {
              const dragged = blocks[dragIndex];
              if (dragged) setDragDepth(depthFromPointer(event, dragged) ?? 0);
            }
          }}
          onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex !== null) {
              const dragged = blocks[dragIndex];
              const depth = dragged ? depthFromPointer(event, dragged) : undefined;
              // A pure sideways drag (same row) still re-parents, so don't skip on equal indexes.
              if (dragIndex !== index || depth !== (dragged?.depth ?? 0)) onReorderBlock(dragIndex, index, depth);
            }
            setDragIndex(null);
            setOverIndex(null);
            setDragDepth(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
            setDragDepth(null);
          }}
          className={cn(
            "group flex items-center gap-1 rounded-md pr-1 text-[12.5px] transition-shadow",
            selected.kind === "block" && selected.sectionId === sectionId && selected.blockId === block.id ? "bg-info/10 text-info" : "hover:bg-surface-secondary",
            dragIndex === index ? "opacity-50" : "",
            overIndex === index && dragIndex !== null && dragIndex !== index ? "shadow-[0_-2px_0_0_theme(colors.info)]" : "",
          )}
        >
          <span className="cursor-grab px-1 py-1.5 text-muted-foreground/40 active:cursor-grabbing" aria-hidden="true">
            <GripVertical className="size-3" />
          </span>
          <button type="button" onClick={() => onSelectBlock(block.id)} className="min-w-0 flex-1 truncate py-1.5 text-left">
            {blockRowLabel(block)}
          </button>
          <RowMenu onDelete={() => onDeleteBlock(block.id)} onDuplicate={() => onDuplicateBlock(block.id)} compact />
        </div>
      ))}
      {blockSchemas.length > 1 ? (
        <AddBlockButton blockSchemas={blockSchemas} atLimit={atLimit} onAdd={onAddBlock} />
      ) : (
        <button
          type="button"
          disabled={atLimit}
          onClick={() => onAddBlock(blockSchemas[0]?.type)}
          className="flex items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-[12px] font-medium text-info transition-colors hover:bg-info/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
        >
          <Plus className="size-3.5" />
          Add block
        </button>
      )}
    </div>
  );
}

/**
 * A section whose schema offers more than one block type (e.g. ontech-theme-zip's CustomSection,
 * whose `blocks` is its whole 15-item customBlockLibrary) previously had no way to add anything
 * but the first type in that list — "+ Add block" always passed blockSchemas[0]. This mirrors
 * AddSectionButton's popup (search + icon grid) so every block type is actually reachable.
 */
function AddBlockButton({
  blockSchemas,
  atLimit,
  onAdd,
}: {
  blockSchemas: NonNullable<SectionSchema["blocks"]>;
  atLimit: boolean;
  onAdd: (blockType?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const presentGroups = useMemo(() => new Set(blockSchemas.map((schema) => schema.group ?? "default")), [blockSchemas]);
  const showTabs = presentGroups.has("default") && presentGroups.has("custom");
  const [activeGroup, setActiveGroup] = useState<"default" | "custom">(presentGroups.has("default") ? "default" : "custom");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const byGroup = showTabs ? blockSchemas.filter((schema) => (schema.group ?? "default") === activeGroup) : blockSchemas;
    return term ? byGroup.filter((schema) => schema.name.toLowerCase().includes(term)) : byGroup;
  }, [blockSchemas, query, showTabs, activeGroup]);

  function handleAdd(blockType: string) {
    onAdd(blockType);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        disabled={atLimit}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-[12px] font-medium text-info transition-colors hover:bg-info/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
      >
        <Plus className="size-3.5" />
        Add block
      </button>
      <Modal open={open} title="Add block" description="Pick a block type to add to this section." onClose={() => setOpen(false)} className="max-w-2xl">
        <div className="grid gap-4 p-5">
          {showTabs ? (
            <div className="inline-flex w-fit gap-1 rounded-lg border bg-surface-secondary/50 p-1">
              <button
                type="button"
                onClick={() => setActiveGroup("default")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  activeGroup === "default" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface",
                )}
              >
                Default
              </button>
              <button
                type="button"
                onClick={() => setActiveGroup("custom")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  activeGroup === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface",
                )}
              >
                Custom
              </button>
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus placeholder="Search block types" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" />
          </div>
          {filtered.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {filtered.map((schema) => {
                const Icon = sectionIcon({ id: schema.type, name: schema.name });
                return (
                  <button
                    key={schema.type}
                    type="button"
                    onClick={() => handleAdd(schema.type)}
                    className="flex flex-col items-start gap-2.5 rounded-lg border bg-surface p-3 text-left transition-colors hover:border-info/40 hover:bg-info/5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info/10 text-info">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 text-[12.5px] font-medium leading-tight text-foreground">{schema.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-[12.5px] text-muted-foreground">No block types match "{query}".</p>
          )}
        </div>
      </Modal>
    </>
  );
}

/**
 * Shared by the sidebar's own "+ Add section" trigger and the canvas toolbar's "Add section
 * after" button — the latter used to add the first schema in the group outright, with no picker
 * at all, which is exactly this component's job to prevent. Fully controlled (no trigger button
 * of its own) so a canvas click can open it too.
 */
export function SectionPickerModal({
  onClose,
  onPick,
  open,
  schemas,
}: {
  onClose: () => void;
  onPick: (schemaId: string) => void;
  open: boolean;
  schemas: SectionSchema[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term ? schemas.filter((schema) => `${schema.name} ${schema.category}`.toLowerCase().includes(term)) : schemas;
    const byCategory = new Map<string, SectionSchema[]>();
    for (const schema of matches) {
      const list = byCategory.get(schema.category) ?? [];
      list.push(schema);
      byCategory.set(schema.category, list);
    }
    return [...byCategory.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [schemas, query]);

  function handlePick(schemaId: string) {
    onPick(schemaId);
    setQuery("");
  }

  return (
    <Modal open={open} title="Add section" description="Pick a section to add to this page." onClose={onClose} className="max-w-2xl">
      <div className="grid gap-4 p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder="Search sections" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" />
        </div>
        {filtered.length ? (
          <div className="grid gap-5">
            {filtered.map(([category, categorySchemas]) => (
              <div key={category} className="grid gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">{category}</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {categorySchemas.map((schema) => {
                    const Icon = sectionIcon(schema);
                    return (
                      <button
                        key={schema.id}
                        type="button"
                        onClick={() => handlePick(schema.id)}
                        className="flex flex-col items-start gap-2.5 rounded-lg border bg-surface p-3 text-left transition-colors hover:border-info/40 hover:bg-info/5"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info/10 text-info">
                          <Icon className="size-4.5" />
                        </span>
                        <span className="min-w-0 text-[12.5px] font-medium leading-tight text-foreground">{schema.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">No sections match "{query}".</p>
        )}
      </div>
    </Modal>
  );
}

function AddSectionButton({ group, onAdd, schemas }: { group: SectionGroupKey; onAdd: (group: SectionGroupKey, schemaId?: string) => void; schemas: SectionSchema[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-info transition-colors hover:bg-info/10"
      >
        <Plus className="size-3.5" />
        Add section
      </button>
      <SectionPickerModal
        open={open}
        onClose={() => setOpen(false)}
        schemas={schemas}
        onPick={(schemaId) => {
          onAdd(group, schemaId);
          setOpen(false);
        }}
      />
    </>
  );
}

function RowMenu({
  compact,
  onDelete,
  onDuplicate,
  onToggle,
  visible,
}: {
  compact?: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggle?: () => void;
  visible?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn("grid shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100", compact ? "size-5" : "size-6")}
          aria-label="More actions"
        >
          <MoreDots />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {onToggle ? (
          <DropdownMenuItem onSelect={onToggle}>
            <Power className="size-3.5" />
            {visible ? "Hide" : "Show"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="size-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <Trash2 className="size-3.5" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreDots() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="16" cy="10" r="1.6" />
    </svg>
  );
}
