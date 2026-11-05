import { useSyncExternalStore } from 'react'
import { loadPdf } from '../services/pdfService'
import { useAppStore, type AppState } from '../store/useAppStore'
import { useEditStore, type EditState, type Snapshot } from '../store/useEditStore'
import type { EditObject } from './types'

const app = useAppStore.getState
const edit = useEditStore.getState

/** Serializes document reloads so rapid undo/redo cannot interleave. */
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

function currentSnapshot(): Snapshot {
  return { bytes: app().document?.bytes ?? null, objects: edit().objects }
}

async function reloadBytes(bytes: Uint8Array, page?: number): Promise<void> {
  const { pdf, pageSizes } = await loadPdf(bytes)
  app().replaceDocumentContent({ bytes, pdf, pageSizes }, page)
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
    const before = currentSnapshot()
    await reloadBytes(bytes, page)
    edit().pushHistory(before)
    edit().setObjects(mapObjects(before.objects))
  })
}

async function restore(snapshot: Snapshot): Promise<void> {
  const doc = app().document
  if (snapshot.bytes && doc && snapshot.bytes !== doc.bytes) await reloadBytes(snapshot.bytes)
  edit().setObjects(snapshot.objects)
}

export function undo(): Promise<void> {
  return enqueue(async () => {
    const previous = edit().takeUndo(currentSnapshot())
    if (previous) await restore(previous)
  })
}

export function redo(): Promise<void> {
  return enqueue(async () => {
    const next = edit().takeRedo(currentSnapshot())
    if (next) await restore(next)
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
