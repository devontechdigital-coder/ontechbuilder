import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 100;
/** Field edits within this window collapse into a single undo step instead of one per keystroke. */
const COALESCE_WINDOW_MS = 800;

type HistoryState<T> = { history: T[]; index: number };

/**
 * Undo/redo stack for the customizer's settings object. Structural edits
 * (add/delete/reorder a section or block) always create a discrete step;
 * field edits (typing, dragging a slider) coalesce into one step per burst
 * so undo doesn't require one press per keystroke.
 */
export function useHistoryState<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>({ history: [initial], index: 0 });
  const lastEdit = useRef<{ time: number; coalesce: boolean }>({ time: 0, coalesce: false });

  const value = state.history[state.index] as T;

  const commit = useCallback((updater: (current: T) => T, options?: { coalesce?: boolean }) => {
    const coalesce = options?.coalesce ?? false;
    const now = Date.now();
    setState((current) => {
      const currentValue = current.history[current.index] as T;
      const nextValue = updater(currentValue);
      if (nextValue === currentValue) return current;

      const atHead = current.index === current.history.length - 1;
      const shouldReplaceTop = coalesce && atHead && lastEdit.current.coalesce && now - lastEdit.current.time < COALESCE_WINDOW_MS;
      lastEdit.current = { time: now, coalesce };

      if (shouldReplaceTop) {
        const nextHistory = [...current.history];
        nextHistory[current.index] = nextValue;
        return { history: nextHistory, index: current.index };
      }

      const truncated = current.history.slice(0, current.index + 1);
      const nextHistory = [...truncated, nextValue].slice(-MAX_HISTORY);
      return { history: nextHistory, index: nextHistory.length - 1 };
    });
  }, []);

  const reset = useCallback((next: T) => {
    lastEdit.current = { time: 0, coalesce: false };
    setState({ history: [next], index: 0 });
  }, []);

  const undo = useCallback(() => {
    lastEdit.current = { time: 0, coalesce: false };
    setState((current) => (current.index > 0 ? { ...current, index: current.index - 1 } : current));
  }, []);

  const redo = useCallback(() => {
    lastEdit.current = { time: 0, coalesce: false };
    setState((current) => (current.index < current.history.length - 1 ? { ...current, index: current.index + 1 } : current));
  }, []);

  return {
    value,
    commit,
    reset,
    undo,
    redo,
    canUndo: state.index > 0,
    canRedo: state.index < state.history.length - 1,
  };
}
