import type { OpenedFile, Result } from '../../../shared/ipc'
import { useAppStore } from '../store/useAppStore'
import { exportPdf, loadPdf, PdfLoadError } from './pdfService'
import { preparePrintPages } from './printService'

const store = useAppStore.getState

function reportFailure(result: Extract<Result<unknown>, { ok: false }>): void {
  if (result.code === 'CANCELLED') return
  if (result.message) console.error(result.code, result.message)
  store().showNotice({ kind: 'error', key: `errors.${result.code}` })
}

async function loadOpenedFile(result: Result<OpenedFile>): Promise<void> {
  if (!result.ok) {
    reportFailure(result)
    return
  }
  const { path, name, data } = result.value
  const { setLoading, setDocument, showNotice } = store()
  setLoading(true)
  try {
    const { pdf, pageSizes } = await loadPdf(data)
    setDocument({ path, name, bytes: data, pdf, pageSizes })
    showNotice(null)
  } catch (err) {
    console.error(err)
    const code = err instanceof PdfLoadError ? err.code : 'UNKNOWN'
    showNotice({ kind: 'error', key: `errors.${code}` })
  } finally {
    setLoading(false)
  }
}

export async function openFromDialog(): Promise<void> {
  await loadOpenedFile(await window.api.openFile())
}

export async function openFromPath(path: string): Promise<void> {
  await loadOpenedFile(await window.api.readFile(path))
}

export async function saveAs(): Promise<void> {
  const doc = store().document
  if (!doc) return
  const result = await window.api.saveFileAs(await exportPdf(doc.bytes), doc.name)
  if (!result.ok) return reportFailure(result)
  store().updateDocument({ path: result.value.path, name: result.value.name })
  store().showNotice({ kind: 'info', key: 'messages.saved', params: { name: result.value.name } })
}

export async function save(): Promise<void> {
  const doc = store().document
  if (!doc) return
  if (!doc.path) return saveAs()
  const result = await window.api.saveFile(doc.path, await exportPdf(doc.bytes))
  if (!result.ok) return reportFailure(result)
  store().showNotice({ kind: 'info', key: 'messages.saved', params: { name: result.value.name } })
}

export async function print(): Promise<void> {
  const doc = store().document
  if (!doc) return
  store().setLoading(true)
  let cleanup: (() => void) | null = null
  try {
    cleanup = await preparePrintPages(doc.pdf)
    store().setLoading(false)
    const result = await window.api.print()
    if (!result.ok) reportFailure(result)
  } catch (err) {
    console.error(err)
    store().showNotice({ kind: 'error', key: 'errors.printFailed' })
  } finally {
    cleanup?.()
    store().setLoading(false)
  }
}

export function closeDocument(): void {
  store().setDocument(null)
}
