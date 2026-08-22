"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../../../lib/utils";

/** Pixels of horizontal drag that equal one nesting level — matches section-tree.tsx's block nesting. */
const NEST_INDENT_PX = 18;
/** Matches this convention's own real-world depth (e.g. Copora's "Company > Our Team > Leadership"). */
const MAX_LINK_DEPTH = 3;

export type LinkNode = { label?: string; href?: string; children?: LinkNode[] };
type LinkRow = { id: string; label: string; href: string; depth: number };

function createId() {
  return Math.random().toString(36).slice(2, 9);
}

function safeParseLinkTree(value: string): LinkNode[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function flattenTree(nodes: LinkNode[], depth = 0): LinkRow[] {
  const rows: LinkRow[] = [];
  for (const node of nodes) {
    rows.push({ id: createId(), label: node.label ?? "", href: node.href ?? "", depth });
    if (node.children?.length) rows.push(...flattenTree(node.children, depth + 1));
  }
  return rows;
}

/** Inverse of flattenTree: each row's depth says how deeply it nests under the rows before it. */
function nestRows(rows: LinkRow[]): LinkNode[] {
  const root: LinkNode[] = [];
  const childrenByDepth: LinkNode[][] = [root];
  for (const row of rows) {
    const node: LinkNode = { label: row.label, href: row.href };
    const parent = childrenByDepth[row.depth] ?? root;
    parent.push(node);
    const children: LinkNode[] = [];
    node.children = children;
    childrenByDepth.length = row.depth + 1;
    childrenByDepth[row.depth + 1] = children;
  }
  prune(root);
  return root;

  function prune(nodes: LinkNode[]) {
    for (const node of nodes) {
      if (!node.children) continue;
      if (node.children.length === 0) delete node.children;
      else prune(node.children);
    }
  }
}

/** First is always top level; nothing may sit more than one level deeper than the row above it. */
function normalizeDepths(rows: LinkRow[]): LinkRow[] {
  let previousDepth = -1;
  return rows.map((row) => {
    const depth = Math.min(Math.max(0, row.depth), previousDepth + 1, MAX_LINK_DEPTH);
    previousDepth = depth;
    return depth === row.depth ? row : { ...row, depth };
  });
}

/** Moves a row (and, if it has any, its nested children) and optionally re-parents it to a new depth. */
function moveRowWithDepth(rows: LinkRow[], from: number, to: number, depth: number | undefined): LinkRow[] {
  const moving = rows[from];
  if (!moving) return rows;
  let subtreeEnd = from + 1;
  while (subtreeEnd < rows.length && (rows[subtreeEnd]?.depth ?? 0) > moving.depth) subtreeEnd += 1;

  const subtree = rows.slice(from, subtreeEnd);
  const rest = [...rows.slice(0, from), ...rows.slice(subtreeEnd)];
  const insertAt = to > from ? Math.max(0, to - subtree.length + 1) : to;
  const shift = depth === undefined ? 0 : depth - moving.depth;
  const shifted = shift === 0 ? subtree : subtree.map((row) => ({ ...row, depth: Math.max(0, row.depth + shift) }));

  return normalizeDepths([...rest.slice(0, insertAt), ...shifted, ...rest.slice(insertAt)]);
}

function subtreeLength(rows: LinkRow[], index: number): number {
  const depth = rows[index]?.depth ?? 0;
  let end = index + 1;
  while (end < rows.length && (rows[end]?.depth ?? 0) > depth) end += 1;
  return end - index;
}

/**
 * A theme whose nav/link blocks store an unlimited-depth menu tree as one JSON-string setting
 * (`itemsJson`/`linksJson` — see schema-parser.ts's isNestedLinksField) has no way to expose that
 * as the dashboard's existing block-list nesting (that operates on separate blocks with a depth
 * field, not JSON inside one field). This edits the same tree shape with the same drag-to-nest
 * interaction as that block list: vertical drag reorders, horizontal drag changes nesting depth.
 */
export function NestedLinksEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [rows, setRows] = useState<LinkRow[]>(() => flattenTree(safeParseLinkTree(value)));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragDepth, setDragDepth] = useState<number | null>(null);
  const dragStartX = useRef(0);

  function commit(next: LinkRow[]) {
    setRows(next);
    onChange(JSON.stringify(nestRows(next)));
  }

  function updateRow(id: string, patch: Partial<Pick<LinkRow, "label" | "href">>) {
    commit(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow(afterIndex: number, depth: number) {
    const next = [...rows];
    next.splice(afterIndex + 1, 0, { id: createId(), label: "New link", href: "#", depth });
    commit(normalizeDepths(next));
  }

  function deleteRow(index: number) {
    const length = subtreeLength(rows, index);
    commit([...rows.slice(0, index), ...rows.slice(index + length)]);
  }

  function depthFromPointer(event: { clientX: number }, row: LinkRow) {
    const steps = Math.round((event.clientX - dragStartX.current) / NEST_INDENT_PX);
    return Math.max(0, Math.min(MAX_LINK_DEPTH, row.depth + steps));
  }

  return (
    <div className="grid gap-1">
      {rows.map((row, index) => (
        <div
          key={row.id}
          draggable
          style={{ marginLeft: (dragIndex === index && dragDepth !== null ? dragDepth : row.depth) * NEST_INDENT_PX }}
          onDragStart={(event) => {
            dragStartX.current = event.clientX;
            setDragIndex(index);
            setDragDepth(row.depth);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (overIndex !== index) setOverIndex(index);
            if (dragIndex !== null) {
              const dragged = rows[dragIndex];
              if (dragged) setDragDepth(depthFromPointer(event, dragged));
            }
          }}
          onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex !== null) {
              const dragged = rows[dragIndex];
              const depth = dragged ? depthFromPointer(event, dragged) : undefined;
              if (dragIndex !== index || depth !== dragged?.depth) commit(moveRowWithDepth(rows, dragIndex, index, depth));
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
            "group flex items-center gap-1.5 rounded-md border bg-surface p-1.5 transition-shadow",
            dragIndex === index ? "opacity-50" : "",
            overIndex === index && dragIndex !== null && dragIndex !== index ? "shadow-[0_-2px_0_0_theme(colors.info)]" : "",
          )}
        >
          <span className="cursor-grab px-0.5 text-muted-foreground/40 active:cursor-grabbing" aria-hidden="true">
            <GripVertical className="size-3.5" />
          </span>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
            <input
              className="min-w-0 rounded border border-input bg-surface px-2 py-1 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
              value={row.label}
              placeholder="Label"
              onChange={(event) => updateRow(row.id, { label: event.target.value })}
            />
            <input
              className="min-w-0 rounded border border-input bg-surface px-2 py-1 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
              value={row.href}
              placeholder="/link"
              onChange={(event) => updateRow(row.id, { href: event.target.value })}
            />
          </div>
          <button
            type="button"
            title="Add sub-link"
            disabled={row.depth >= MAX_LINK_DEPTH}
            onClick={() => addRow(index + subtreeLength(rows, index) - 1, Math.min(MAX_LINK_DEPTH, row.depth + 1))}
            className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={() => deleteRow(index)}
            className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addRow(rows.length - 1, 0)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-info transition-colors hover:bg-info/10"
      >
        <Plus className="size-3.5" />
        Add link
      </button>
    </div>
  );
}

export function isNestedLinksField(id: string): boolean {
  const lower = id.toLowerCase();
  return lower.endsWith("json") && (lower.includes("link") || lower.includes("item") || lower.includes("menu") || lower.includes("nav"));
}
