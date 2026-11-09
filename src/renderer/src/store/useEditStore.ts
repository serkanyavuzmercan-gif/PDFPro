import { create } from 'zustand'
import type { EditObject, Rect, TextAlign, TextStyle } from '../editing/types'

export interface Snapshot {
  bytes: Uint8Array | null
  objects: EditObject[]
}

/** A text or comment box being typed into; it becomes an object (or updates one) on commit. */
export interface TextDraft {
  kind: 'text' | 'comment'
  /** Set when editing an existing object. */
  id: string | null
  pageIndex: number
  x: number
  y: number
  width: number
  rotation: number
  text: string
  style: TextStyle
  fill: string
  border: string
  cover?: Rect & { color: string }
  /** For "edit existing text": unchanged text is discarded instead of committed. */
  originalText?: string
  /** Changes only when a new box is opened, not when that box is moved. */
  token: number
}

export interface ToolSettings {
  text: TextStyle
  comment: { fill: string; border: string }
  markup: {
    highlight: { color: string; opacity: number; width: number }
    underline: { color: string; opacity: number; width: number }
    strikeout: { color: string; opacity: number; width: number }
  }
  ink: { color: string; width: number; opacity: number }
  note: { color: string }
}

const HISTORY_LIMIT = 40
const COALESCE_MS = 1500
const EMPTY: EditObject[] = []

const defaultSettings: ToolSettings = {
  text: { font: 'sans', size: 14, color: '#1f2937', bold: false, italic: false, align: 'left' as TextAlign },
  comment: { fill: '#fff8c5', border: '#d4a72c' },
  markup: {
    highlight: { color: '#ffd400', opacity: 0.55, width: 18 },
    underline: { color: '#2563eb', opacity: 1, width: 1.25 },
    strikeout: { color: '#d71920', opacity: 1, width: 1.25 }
  },
  ink: { color: '#d71920', width: 2, opacity: 1 },
  note: { color: '#f5c518' }
}

export interface EditSession {
  objects: EditObject[]
  selectedId: string | null
  draft: TextDraft | null
  openNoteId: string | null
  past: Snapshot[]
  future: Snapshot[]
  lastCoalesce: { key: string; time: number } | null
  saved: Snapshot
}

export interface EditState {
  objects: EditObject[]
  selectedId: string | null
  draft: TextDraft | null
  /** Sticky note whose popup is open. */
  openNoteId: string | null
  settings: ToolSettings
  past: Snapshot[]
  future: Snapshot[]
  lastCoalesce: { key: string; time: number } | null
  saved: Snapshot

  setObjects: (objects: EditObject[]) => void
  pushHistory: (snapshot: Snapshot, coalesceKey?: string) => void
  takeUndo: (current: Snapshot) => Snapshot | null
  takeRedo: (current: Snapshot) => Snapshot | null
  select: (id: string | null) => void
  setDraft: (draft: TextDraft | null) => void
  updateDraft: (patch: Partial<TextDraft>) => void
  setOpenNote: (id: string | null) => void
  updateSettings: (fn: (s: ToolSettings) => ToolSettings) => void
  reset: (bytes: Uint8Array | null) => void
  markSaved: (snapshot: Snapshot) => void
  restoreSession: (session: EditSession) => void
}

export function captureEditSession(state: EditState = useEditStore.getState()): EditSession {
  return {
    objects: state.objects,
    selectedId: state.selectedId,
    draft: state.draft,
    openNoteId: state.openNoteId,
    past: state.past,
    future: state.future,
    lastCoalesce: state.lastCoalesce,
    saved: state.saved
  }
}

export const useEditStore = create<EditState>((set, get) => ({
  objects: EMPTY,
  selectedId: null,
  draft: null,
  openNoteId: null,
  settings: defaultSettings,
  past: [],
  future: [],
  lastCoalesce: null,
  saved: { bytes: null, objects: EMPTY },

  setObjects: (objects) => {
    const { selectedId, openNoteId } = get()
    set({
      objects,
      selectedId: selectedId && objects.some((o) => o.id === selectedId) ? selectedId : null,
      openNoteId: openNoteId && objects.some((o) => o.id === openNoteId) ? openNoteId : null
    })
  },
  pushHistory: (snapshot, coalesceKey) => {
    const { lastCoalesce, past } = get()
    const now = Date.now()
    if (coalesceKey && lastCoalesce?.key === coalesceKey && now - lastCoalesce.time < COALESCE_MS) {
      set({ lastCoalesce: { key: coalesceKey, time: now }, future: [] })
      return
    }
    set({
      past: [...past, snapshot].slice(-HISTORY_LIMIT),
      future: [],
      lastCoalesce: coalesceKey ? { key: coalesceKey, time: now } : null
    })
  },
  takeUndo: (current) => {
    const { past, future } = get()
    const previous = past.at(-1)
    if (!previous) return null
    set({ past: past.slice(0, -1), future: [...future, current], lastCoalesce: null })
    return previous
  },
  takeRedo: (current) => {
    const { past, future } = get()
    const next = future.at(-1)
    if (!next) return null
    set({ future: future.slice(0, -1), past: [...past, current], lastCoalesce: null })
    return next
  },
  select: (selectedId) => set({ selectedId }),
  setDraft: (draft) => set({ draft }),
  updateDraft: (patch) => {
    const { draft } = get()
    if (draft) set({ draft: { ...draft, ...patch } })
  },
  setOpenNote: (openNoteId) => set({ openNoteId }),
  updateSettings: (fn) => set({ settings: fn(get().settings) }),
  reset: (bytes) =>
    set({
      objects: EMPTY,
      selectedId: null,
      draft: null,
      openNoteId: null,
      past: [],
      future: [],
      lastCoalesce: null,
      saved: { bytes, objects: EMPTY }
    }),
  markSaved: (snapshot) => set({ saved: snapshot }),
  restoreSession: (session) => set({ ...session })
}))
