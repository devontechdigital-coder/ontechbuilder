import type { BuilderDocument, BuilderViewport } from "../schema/types";

export interface BuilderEditorState {
  document: BuilderDocument;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  viewport: BuilderViewport;
  dirty: boolean;
  undoStack: BuilderDocument[];
  redoStack: BuilderDocument[];
}

const historyLimit = 30;

export function createEditorState(document: BuilderDocument): BuilderEditorState {
  return {
    document,
    selectedNodeId: document.rootNodeId,
    hoveredNodeId: null,
    viewport: "desktop",
    dirty: false,
    undoStack: [],
    redoStack: [],
  };
}

export function commitDocument(state: BuilderEditorState, document: BuilderDocument): BuilderEditorState {
  return {
    ...state,
    document,
    dirty: true,
    undoStack: [...state.undoStack.slice(-(historyLimit - 1)), state.document],
    redoStack: [],
  };
}

export function undo(state: BuilderEditorState): BuilderEditorState {
  const previous = state.undoStack[state.undoStack.length - 1];
  if (!previous) {
    return state;
  }
  return {
    ...state,
    document: previous,
    dirty: true,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [state.document, ...state.redoStack].slice(0, historyLimit),
  };
}

export function redo(state: BuilderEditorState): BuilderEditorState {
  const next = state.redoStack[0];
  if (!next) {
    return state;
  }
  return {
    ...state,
    document: next,
    dirty: true,
    undoStack: [...state.undoStack.slice(-(historyLimit - 1)), state.document],
    redoStack: state.redoStack.slice(1),
  };
}
