import type { OpenedFile, Result } from '../../../shared/ipc'
import { openDialog } from '../components/dialogs/dialogStore'
import { commitDraft } from '../editing/draft'
import { exportEdits } from '../editing/exportEdits'
import { isDirty, markSaved } from '../editing/history'
import { useAppStore } from '../store/useAppStore'
import { useEditStore } from '../store/useEditStore'
import { closeTab, openInTab } from './documentTabs'
import { loadPdf, PdfLoadError } from './pdfService'
import { mountPrintRoot, renderPrintPages } from './printService'

const store = useAppStore.getState
const edit = useEditStore.getState

export function reportFailure(result: Extract<Result<unknown>, { ok: false }>): void {
  if (result.code === 'CANCELLED') return
  if (result.message) console.error(result.code, result.message)
  store().showNotice({ kind: 'error', key: `errors.${result.code}` })
}

/** Shows a notice for errors thrown while modifying a document with pdf-lib. */
export function reportEditError(err: unknown): void {
  console.error(err)
  const encrypted = err instanceof Error && /encrypt/i.test(`${err.name} ${err.message}`)
  store().showNotice({ kind: 'error', key: encrypted ? 'errors.ENCRYPTED' : 'errors.editFailed' })
}

/** Commits the open text box and returns the bytes with all edits written into the PDF. */
export async function exportCurrent(): Promise<Uint8Array | null> {
  commitDraft()
  const doc = store().document
  if (!doc) return null
  return exportEdits(doc.bytes, edit().objects, doc.pageSizes)
}

/** Shows a document in its own tab and starts a fresh edit history. */
export async function showDocument(
  file: { path: string | null; name: string; data: Uint8Array },
  options: { unsaved?: boolean } = {}
): Promise<void> {
  const { pdf, pageSizes } = await loadPdf(file.data)
  await openInTab(file, { pdf, pageSizes }, options.unsaved ? null : file.data)
}

async function loadOpenedFile(result: Result<OpenedFile>): Promise<void> {
  if (!result.ok) {
    reportFailure(result)
    return
  }
  const { setLoading, showNotice } = store()
  setLoading(true)
  try {
    await showDocument(result.value)
    showNotice(null)
  } catch (err) {
    console.error(err)
    const code = err instanceof PdfLoadError ? err.code : 'UNKNOWN'
    showNotice({ kind: 'error', key: `errors.${code}` })
  } finally {
    setLoading(false)
  }
}

/** Asks what to do with unsaved changes. Resolves true when it is fine to continue. */
export async function confirmUnsaved(): Promise<boolean> {
  commitDraft()
  const doc = store().document
  if (!doc || !isDirty(store(), edit())) return true
  const choice = await openDialog({ type: 'unsaved', name: doc.name })
  if (choice === 'cancel') return false
  if (choice === 'discard') return true
  return save()
}

export async function openFromDialog(): Promise<void> {
  await loadOpenedFile(await window.api.openFile())
}

export async function openFromPath(path: string): Promise<void> {
  await loadOpenedFile(await window.api.readFile(path))
}

async function exportOrReport(): Promise<Uint8Array | null> {
  try {
    return await exportCurrent()
  } catch (err) {
    reportEditError(err)
    return null
  }
}

export async function saveAs(): Promise<boolean> {
  const doc = store().document
  if (!doc) return false
  const bytes = await exportOrReport()
  if (!bytes) return false
  const result = await window.api.saveFileAs(bytes, doc.name)
  if (!result.ok) {
    reportFailure(result)
    return false
  }
  store().updateDocument({ path: result.value.path, name: result.value.name })
  markSaved()
  store().showNotice({ kind: 'info', key: 'messages.saved', params: { name: result.value.name } })
  return true
}

export async function save(): Promise<boolean> {
  const doc = store().document
  if (!doc) return false
  if (!doc.path) return saveAs()
  const bytes = await exportOrReport()
  if (!bytes) return false
  const result = await window.api.saveFile(doc.path, bytes)
  if (!result.ok) {
    reportFailure(result)
    return false
  }
  markSaved()
  store().showNotice({ kind: 'info', key: 'messages.saved', params: { name: result.value.name } })
  return true
}

export async function print(): Promise<void> {
  const doc = store().document
  if (!doc) return
  const bytes = await exportOrReport()
  if (!bytes) return
  store().setLoading(true)
  let revoke: (() => void) | null = null
  let unmount: (() => void) | null = null
  let printDoc = doc.pdf
  try {
    if (bytes !== doc.bytes) printDoc = (await loadPdf(bytes)).pdf
    const rendered = await renderPrintPages(printDoc)
    revoke = rendered.revoke
    const printers = await window.api.getPrinters().catch(() => [])
    store().setLoading(false)
    const choice = await openDialog({
      type: 'print',
      pageCount: rendered.pages.length,
      currentPage: Math.min(store().currentPage, rendered.pages.length),
      previews: rendered.pages,
      printers
    })
    if (!choice) return
    const selected = rendered.pages.filter((page) => choice.pages.includes(page.page))
    unmount = mountPrintRoot(selected)
    const result = await window.api.print({ deviceName: choice.deviceName, copies: choice.copies })
    if (!result.ok) reportFailure(result)
  } catch (err) {
    console.error(err)
    store().showNotice({ kind: 'error', key: 'errors.printFailed' })
  } finally {
    unmount?.()
    revoke?.()
    if (printDoc !== doc.pdf) void printDoc.loadingTask.destroy()
    store().setLoading(false)
  }
}

export async function closeDocument(id?: string): Promise<void> {
  await closeTab(id)
}

export { confirmEveryUnsaved, anyDocumentDirty } from './documentTabs'
