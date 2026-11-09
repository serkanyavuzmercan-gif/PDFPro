import { settleEdits, isDirty } from '../editing/history'
import { captureEditSession, useEditStore } from '../store/useEditStore'
import {
  useAppStore,
  type AppState,
  type DocumentSession,
  type DocumentView,
  type OpenDocument
} from '../store/useAppStore'

let tabCounter = 0
let gate: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = gate.then(task, task)
  gate = run.catch(() => undefined)
  return run
}

function newTabId(): string {
  tabCounter += 1
  return `tab${Date.now().toString(36)}${tabCounter}`
}

function samePath(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase()
}

function captureView(state: AppState): DocumentView {
  return {
    zoom: state.zoom,
    zoomMode: state.zoomMode,
    scrollMode: state.scrollMode,
    currentPage: state.currentPage,
    selectedPages: state.selectedPages,
    selectionAnchor: state.selectionAnchor
  }
}

function captureCurrent(state: AppState): DocumentSession | null {
  if (!state.document || !state.activeDocumentId) return null
  return {
    id: state.activeDocumentId,
    document: state.document,
    view: captureView(state),
    edit: captureEditSession()
  }
}

export function sessionDirty(session: Pick<DocumentSession, 'document' | 'edit'>): boolean {
  const { document, edit } = session
  return document.bytes !== edit.saved.bytes || edit.objects !== edit.saved.objects || edit.draft !== null
}

export function anyDocumentDirty(): boolean {
  const state = useAppStore.getState()
  if (isDirty(state, useEditStore.getState())) return true
  return state.parked.some(sessionDirty)
}

/** Id of an already open file, active or parked. */
export function findOpenDocument(path: string | null): string | null {
  if (!path) return null
  const state = useAppStore.getState()
  if (samePath(state.document?.path ?? null, path)) return state.activeDocumentId
  return state.parked.find((session) => samePath(session.document.path, path))?.id ?? null
}

function showSession(session: DocumentSession, parked: DocumentSession[], order: string[]): void {
  useEditStore.getState().restoreSession(session.edit)
  const state = useAppStore.getState()
  useAppStore.setState({
    parked,
    documentOrder: order,
    activeDocumentId: session.id,
    document: session.document,
    zoom: session.view.zoom,
    zoomMode: session.view.zoomMode,
    scrollMode: session.view.scrollMode,
    currentPage: session.view.currentPage,
    selectedPages: session.view.selectedPages,
    selectionAnchor: session.view.selectionAnchor,
    navRequest: { page: session.view.currentPage, nonce: state.navRequest.nonce + 1 }
  })
}

/** Puts `id` in front, keeping the document that was in front open behind it. */
async function switchNow(id: string): Promise<void> {
  await settleEdits()
  const state = useAppStore.getState()
  if (state.activeDocumentId === id) return
  const target = state.parked.find((session) => session.id === id)
  const current = captureCurrent(state)
  if (!target || !current) return
  showSession(
    target,
    [...state.parked.filter((session) => session.id !== id), current],
    state.documentOrder
  )
}

export function switchDocument(id: string): Promise<void> {
  return enqueue(() => switchNow(id))
}

/** Opens a document in a new tab, or focuses the tab that already has this path. */
export function openInTab(
  file: { path: string | null; name: string; data: Uint8Array },
  loaded: Pick<OpenDocument, 'pdf' | 'pageSizes'>,
  savedBytes: Uint8Array | null
): Promise<void> {
  return enqueue(() => openNow(file, loaded, savedBytes))
}

async function openNow(
  file: { path: string | null; name: string; data: Uint8Array },
  loaded: Pick<OpenDocument, 'pdf' | 'pageSizes'>,
  savedBytes: Uint8Array | null
): Promise<void> {
  await settleEdits()
  const existing = findOpenDocument(file.path)
  if (existing) {
    void loaded.pdf.loadingTask.destroy()
    if (existing !== useAppStore.getState().activeDocumentId) await switchNow(existing)
    return
  }
  const state = useAppStore.getState()
  const current = captureCurrent(state)
  const id = newTabId()
  useEditStore.getState().reset(savedBytes)
  useAppStore.setState({
    parked: current ? [...state.parked, current] : state.parked,
    documentOrder: [...state.documentOrder, id],
    activeDocumentId: id,
    document: { path: file.path, name: file.name, bytes: file.data, pdf: loaded.pdf, pageSizes: loaded.pageSizes },
    currentPage: 1,
    selectedPages: [],
    selectionAnchor: null,
    navRequest: { page: 1, nonce: state.navRequest.nonce + 1 }
  })
}

function dropParked(id: string): void {
  const state = useAppStore.getState()
  const session = state.parked.find((item) => item.id === id)
  if (!session) return
  void session.document.pdf.loadingTask.destroy()
  useAppStore.setState({
    parked: state.parked.filter((item) => item.id !== id),
    documentOrder: state.documentOrder.filter((item) => item !== id)
  })
}

function closeActive(): void {
  const state = useAppStore.getState()
  const id = state.activeDocumentId
  const closing = state.document
  if (!id || !closing) return
  const index = state.documentOrder.indexOf(id)
  const order = state.documentOrder.filter((item) => item !== id)
  const neighborId = order[index - 1] ?? order[0]
  const neighbor = neighborId ? state.parked.find((session) => session.id === neighborId) : undefined
  if (!neighbor) {
    useAppStore.setState({ documentOrder: [], activeDocumentId: null })
    state.setDocument(null)
    useEditStore.getState().reset(null)
    return
  }
  showSession(
    neighbor,
    state.parked.filter((session) => session.id !== neighbor.id),
    order
  )
  void closing.pdf.loadingTask.destroy()
}

/** Closes one tab. A dirty parked tab is brought forward so save still works. */
export function closeTab(id?: string): Promise<void> {
  return enqueue(() => closeNow(id))
}

async function closeNow(id?: string): Promise<void> {
  await settleEdits()
  const state = useAppStore.getState()
  const target = id ?? state.activeDocumentId
  if (!target) return
  if (target !== state.activeDocumentId) {
    const session = state.parked.find((item) => item.id === target)
    if (!session) return
    if (sessionDirty(session)) {
      await switchNow(target)
      const { confirmUnsaved } = await import('./fileService')
      if (!(await confirmUnsaved())) return
      closeActive()
      return
    }
    dropParked(target)
    return
  }
  const { confirmUnsaved } = await import('./fileService')
  if (!(await confirmUnsaved())) return
  closeActive()
}

/** Asks about every dirty tab. Cancel leaves that tab in front and keeps the window open. */
export function confirmEveryUnsaved(): Promise<boolean> {
  return enqueue(confirmNow)
}

async function confirmNow(): Promise<boolean> {
  await settleEdits()
  const ids = [...useAppStore.getState().documentOrder]
  const { confirmUnsaved } = await import('./fileService')
  for (const id of ids) {
    const state = useAppStore.getState()
    if (!state.documentOrder.includes(id)) continue
    const parked = state.parked.find((session) => session.id === id)
    const dirty =
      state.activeDocumentId === id ? isDirty(state, useEditStore.getState()) : parked ? sessionDirty(parked) : false
    if (!dirty) continue
    if (state.activeDocumentId !== id) await switchNow(id)
    if (!(await confirmUnsaved())) return false
  }
  return true
}
