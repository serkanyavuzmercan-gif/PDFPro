import { useSyncExternalStore } from 'react'
import { loadPdf } from '../services/pdfService'
import { useAppStore, type AppState, type DocumentSession } from '../store/useAppStore'
import { useEditStore, type EditState, type Snapshot } from '../store/useEditStore'
import type { EditObject } from './types'

const app = useAppStore.getState
const edit = useEditStore.getState

const HISTORY_LIMIT = 40

/** Serializes document reloads so rapid undo/redo cannot interleave. */
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

/** Resolves when the current undo, redo, or page change has finished. */
export function settleEdits(): Promise<void> {
  return queue.then(() => undefined)
}

function currentSnapshot(): Snapshot {
  return { bytes: app().document?.bytes ?? null, objects: edit().objects }
}

function writeParked(tabId: string, update: (session: DocumentSession) => DocumentSession): void {
  const parked = app().parked
  useAppStore.setState({ parked: parked.map((session) => (session.id === tabId ? update(session) : session)) })
}

async function reloadBytes(bytes: Uint8Array, page: number | undefined, tabId: string | null): Promise<void> {
  const { pdf, pageSizes } = await loadPdf(bytes)
  const state = app()
  if (!tabId || state.activeDocumentId === tabId) {
    if (!state.document) {
      void pdf.loadingTask.destroy()
      return
    }
    state.replaceDocumentContent({ bytes, pdf, pageSizes }, page)
    return
  }
  const session = state.parked.find((item) => item.id === tabId)
  if (!session) {
    void pdf.loadingTask.destroy()
    return
  }
  if (session.document.pdf !== pdf) void session.document.pdf.loadingTask.destroy()
  const count = pageSizes.length
  const target = Math.min(count, Math.max(1, page ?? session.view.currentPage))
  writeParked(tabId, (current) => ({
    ...current,
    document: { ...current.document, bytes, pdf, pageSizes },
    view: {
      ...current.view,
      currentPage: target,
      selectedPages: current.view.selectedPages.filter((item) => item <= count)
    }
  }))
}

function pushParkedHistory(tabId: string, before: Snapshot, objects: EditObject[]): void {
  writeParked(tabId, (session) => ({
    ...session,
    edit: {
      ...session.edit,
      objects,
      past: [...session.edit.past, before].slice(-HISTORY_LIMIT),
      future: [],
      lastCoalesce: null,
      selectedId: session.edit.selectedId && objects.some((obj) => obj.id === session.edit.selectedId) ? session.edit.selectedId : null,
      openNoteId:
        session.edit.openNoteId && objects.some((obj) => obj.id === session.edit.openNoteId) ? session.edit.openNoteId : null
    }
  }))
}

export function changeObjects(
  fn: (objects: EditObject[]) => EditObject[],
  options: { coalesceKey?: string } = {}
): void {
  const before = currentSnapshot()
  const next = fn(before.objects)
  if (next === before.objects) return
  edit().pushHistory(before, options.coalesceKey)
  edit().setObjects(next)
}

export function addObject(obj: EditObject, select = true): void {
  changeObjects((objects) => [...objects, obj])
  if (select) edit().select(obj.id)
}

export function updateObject(id: string, patch: Partial<EditObject>, coalesceKey?: string): void {
  changeObjects(
    (objects) => objects.map((o) => (o.id === id ? ({ ...o, ...patch } as EditObject) : o)),
    { coalesceKey }
  )
}

export function replaceObject(obj: EditObject, coalesceKey?: string): void {
  changeObjects((objects) => objects.map((o) => (o.id === obj.id ? obj : o)), { coalesceKey })
}

export function removeObjects(ids: string[], coalesceKey?: string): void {
  if (ids.length === 0) return
  changeObjects((objects) => objects.filter((o) => !ids.includes(o.id)), { coalesceKey })
}

/** Applies new document bytes (page operations) as one undoable step. */
export function changeBytes(
  bytes: Uint8Array,
  mapObjects: (objects: EditObject[]) => EditObject[] = (o) => o,
  page?: number
): Promise<void> {
  return enqueue(async () => {
    const tabId = app().activeDocumentId
    const before = currentSnapshot()
    await reloadBytes(bytes, page, tabId)
    const objects = mapObjects(before.objects)
    if (app().activeDocumentId === tabId) {
      edit().pushHistory(before)
      edit().setObjects(objects)
      return
    }
    if (tabId) pushParkedHistory(tabId, before, objects)
  })
}

async function restore(snapshot: Snapshot, tabId: string | null): Promise<void> {
  const live = app().activeDocumentId === tabId
  const doc = live ? app().document : app().parked.find((session) => session.id === tabId)?.document
  if (snapshot.bytes && doc && snapshot.bytes !== doc.bytes) await reloadBytes(snapshot.bytes, undefined, tabId)
  if (app().activeDocumentId === tabId) {
    edit().setObjects(snapshot.objects)
    return
  }
  if (tabId) writeParked(tabId, (session) => ({ ...session, edit: { ...session.edit, objects: snapshot.objects } }))
}

export function undo(): Promise<void> {
  return enqueue(async () => {
    const tabId = app().activeDocumentId
    const previous = edit().takeUndo(currentSnapshot())
    if (previous) await restore(previous, tabId)
  })
}

export function redo(): Promise<void> {
  return enqueue(async () => {
    const tabId = app().activeDocumentId
    const next = edit().takeRedo(currentSnapshot())
    if (next) await restore(next, tabId)
  })
}

export function markSaved(): void {
  edit().markSaved(currentSnapshot())
}

export function isDirty(a: AppState, e: EditState): boolean {
  if (!a.document) return false
  return a.document.bytes !== e.saved.bytes || e.objects !== e.saved.objects || e.draft !== null
}

/** Subscribes to both stores and re-renders only when the derived value changes. */
export function useBothStores<T>(selector: (a: AppState, e: EditState) => T): T {
  return useSyncExternalStore(
    (onChange) => {
      const unsubApp = useAppStore.subscribe(onChange)
      const unsubEdit = useEditStore.subscribe(onChange)
      return () => {
        unsubApp()
        unsubEdit()
      }
    },
    () => selector(app(), edit())
  )
}
