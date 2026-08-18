"use client";

import { GripHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils";

type Rect = { x: number; y: number; width: number; height: number };

const MIN_WIDTH = 300;
const MIN_HEIGHT = 240;
const EDGE_MARGIN = 8;

function clampToViewport(rect: Rect): Rect {
  if (typeof window === "undefined") return rect;
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), window.innerWidth - EDGE_MARGIN * 2);
  const height = Math.min(Math.max(rect.height, MIN_HEIGHT), window.innerHeight - EDGE_MARGIN * 2);
  return {
    width,
    height,
    // Keep at least the header reachable — a panel dragged fully off-screen
    // would otherwise be impossible to grab again.
    x: Math.min(Math.max(rect.x, EDGE_MARGIN - width + 120), window.innerWidth - 120),
    y: Math.min(Math.max(rect.y, EDGE_MARGIN), window.innerHeight - 48),
  };
}

/**
 * A non-modal, draggable, resizable panel — deliberately not a Radix Dialog:
 * a dialog traps focus behind a dimming overlay, which would block the canvas
 * the panel is meant to be edited against. This stays out of the way, so the
 * section stays visible and clickable while its settings are open.
 *
 * Position and size persist for the session via `storageKey`, so the panel
 * reopens where it was last parked.
 */
export function FloatingPanel({
  children,
  className,
  onClose,
  open,
  storageKey,
  subtitle,
  title,
}: {
  children: ReactNode;
  className?: string | undefined;
  onClose: () => void;
  open: boolean;
  storageKey?: string | undefined;
  subtitle?: string | undefined;
  title: string;
}) {
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, width: 380, height: 520 });
  const [ready, setReady] = useState(false);
  const gesture = useRef<{ mode: "move" | "resize"; startX: number; startY: number; origin: Rect } | null>(null);

  // First open: restore the parked position, else dock to the right edge.
  useEffect(() => {
    if (!open || ready) return;
    const stored = storageKey ? window.sessionStorage.getItem(storageKey) : null;
    const parsed = stored ? (JSON.parse(stored) as Partial<Rect>) : null;
    const width = parsed?.width ?? 380;
    const height = parsed?.height ?? Math.min(560, window.innerHeight - 120);
    setRect(
      clampToViewport({
        width,
        height,
        x: parsed?.x ?? window.innerWidth - width - 24,
        y: parsed?.y ?? 84,
      }),
    );
    setReady(true);
  }, [open, ready, storageKey]);

  useEffect(() => {
    if (!open) setReady(false);
  }, [open]);

  useEffect(() => {
    if (!ready || !storageKey) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(rect));
  }, [rect, ready, storageKey]);

  const startGesture = useCallback(
    (mode: "move" | "resize") => (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as Element).setPointerCapture?.(event.pointerId);
      gesture.current = { mode, startX: event.clientX, startY: event.clientY, origin: rect };
    },
    [rect],
  );

  useEffect(() => {
    if (!open) return;
    function handleMove(event: PointerEvent) {
      const active = gesture.current;
      if (!active) return;
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      setRect(
        clampToViewport(
          active.mode === "move"
            ? { ...active.origin, x: active.origin.x + dx, y: active.origin.y + dy }
            : { ...active.origin, width: active.origin.width + dx, height: active.origin.height + dy },
        ),
      );
    }
    function handleUp() {
      gesture.current = null;
    }
    function handleResize() {
      setRect((current) => clampToViewport(current));
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  if (!open || !ready) return null;

  return (
    <section
      aria-label={title}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border/80 bg-surface shadow-2xl shadow-slate-950/25 ring-1 ring-slate-950/5",
        className,
      )}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      <header
        onPointerDown={startGesture("move")}
        className="flex cursor-grab select-none items-center gap-2 border-b bg-surface-secondary/60 px-3 py-2 active:cursor-grabbing"
      >
        <GripHorizontal className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold leading-4">{title}</p>
          {subtitle ? <p className="truncate text-[11px] leading-4 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-label="Close settings"
          title="Close"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

      <button
        type="button"
        aria-label="Resize panel"
        title="Drag to resize"
        onPointerDown={startGesture("resize")}
        className="absolute bottom-0 right-0 size-4 cursor-nwse-resize rounded-tl-md text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        <svg viewBox="0 0 16 16" className="size-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M11 15L15 11M6 15L15 6" />
        </svg>
      </button>
    </section>
  );
}
