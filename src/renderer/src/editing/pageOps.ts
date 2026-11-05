import { degrees, PDFDocument } from 'pdf-lib'
import { formatPageRanges, openDialog } from '../components/dialogs/dialogStore'
import { exportCurrent, reportEditError, reportFailure, showDocument } from '../services/fileService'
import { targetPages, useAppStore } from '../store/useAppStore'
import { commitDraft } from './draft'
import { changeBytes } from './history'
import type { EditObject } from './types'

const store = useAppStore.getState

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

/** Runs a document modification, reporting pdf-lib failures (e.g. encrypted files). */
async function guarded(task: () => Promise<void>): Promise<void> {
  commitDraft()
  if (!store().document) return
  try {
    await task()
  } catch (err) {
    reportEditError(err)
  }
}

export function rotatePages(delta: 90 | -90): Promise<void> {
  return guarded(async () => {
    const doc = store().document!
    const pdf = await PDFDocument.load(doc.bytes)
    for (const pageNumber of targetPages()) {
      const page = pdf.getPage(pageNumber - 1)
      page.setRotation(degrees((((page.getRotation().angle + delta) % 360) + 360) % 360))
    }
    await changeBytes(await pdf.save())
  })
}

export function deletePages(): Promise<void> {
  return guarded(async () => {
    const doc = store().document!
    const pages = targetPages()
    const count = doc.pageSizes.length
    if (pages.length >= count) {
      store().showNotice({ kind: 'error', key: 'errors.deleteAllPages' })
      return
    }
    const confirmed = await openDialog({
      type: 'confirm',
      titleKey: 'dialogs.deletePages.title',
      messageKey: 'dialogs.deletePages.message',
      params: { pages: formatPageRanges(pages) },
      confirmKey: 'dialogs.deletePages.confirm',
      danger: true
    })
    if (!confirmed) return
    const pdf = await PDFDocument.load(doc.bytes)
    for (const pageNumber of [...pages].sort((a, b) => b - a)) pdf.removePage(pageNumber - 1)
    const removed = new Set(pages.map((p) => p - 1))
    const shift = (index: number): number => index - [...removed].filter((r) => r < index).length
    await changeBytes(
      await pdf.save(),
      (objects) =>
        objects.filter((o) => !removed.has(o.pageIndex)).map((o) => ({ ...o, pageIndex: shift(o.pageIndex) })),
      Math.min(count - pages.length, shift(Math.min(...pages) - 1) + 1)
    )
    useAppStore.setState({ selectedPages: [], selectionAnchor: null })
  })
}

/** Applies a new page order, given as old 0-based indices in their new positions. */
export function reorderPages(order: number[]): Promise<void> {
  return guarded(async () => {
    const doc = store().document!
    if (order.every((old, i) => old === i)) return
    const source = await PDFDocument.load(doc.bytes)
    const pdf = await PDFDocument.create()
    for (const page of await pdf.copyPages(source, order)) pdf.addPage(page)
    const newIndex = new Map(order.map((old, i) => [old, i]))
    const selected = store().selectedPages.map((p) => (newIndex.get(p - 1) ?? 0) + 1)
    const current = (newIndex.get(store().currentPage - 1) ?? 0) + 1
    await changeBytes(
      await pdf.save(),
      (objects) => objects.map((o): EditObject => ({ ...o, pageIndex: newIndex.get(o.pageIndex) ?? o.pageIndex })),
      current
    )
    useAppStore.setState({ selectedPages: selected.sort((a, b) => a - b) })
  })
}

/** Moves the given 1-based pages so they start at 0-based position `target` (in the original order). */
export function movePages(pages: number[], target: number): Promise<void> {
  const count = store().document?.pageSizes.length ?? 0
  const moving = new Set(pages.map((p) => p - 1))
  const rest = Array.from({ length: count }, (_, i) => i).filter((i) => !moving.has(i))
  const insertAt = rest.filter((i) => i < target).length
  const order = [...rest.slice(0, insertAt), ...[...moving].sort((a, b) => a - b), ...rest.slice(insertAt)]
  return reorderPages(order)
}

/** Shifts the selected pages one position up or down. */
export function nudgePages(direction: -1 | 1): Promise<void> {
  const pages = targetPages()
  const count = store().document?.pageSizes.length ?? 0
  const first = Math.min(...pages)
  const last = Math.max(...pages)
  if ((direction < 0 && first <= 1) || (direction > 0 && last >= count)) return Promise.resolve()
  return movePages(pages, direction < 0 ? first - 2 : last + 1)
}

async function copyToNewDocument(source: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const page of await out.copyPages(source, indices)) out.addPage(page)
  return out.save()
}

export function extractPages(): Promise<void> {
  return guarded(async () => {
    const doc = store().document!
    const indices = await openDialog({
      type: 'pageRange',
      titleKey: 'dialogs.extract.title',
      confirmKey: 'dialogs.extract.confirm',
      initial: formatPageRanges(targetPages()),
      pageCount: doc.pageSizes.length
    })
    if (!indices) return
    const bytes = await exportCurrent()
    if (!bytes) return
    const out = await copyToNewDocument(await PDFDocument.load(bytes), indices)
    const suffix = formatPageRanges(indices.map((i) => i + 1)).replace(/\s/g, '').replace(/,/g, '_')
    const result = await window.api.saveFileAs(out, `${baseName(doc.name)}-${suffix}.pdf`)
    if (!result.ok) return reportFailure(result)
    store().showNotice({ kind: 'info', key: 'messages.extracted', params: { name: result.value.name } })
  })
}

export async function mergePdfs(): Promise<void> {
  commitDraft()
  const result = await window.api.openFiles()
  if (!result.ok) return reportFailure(result)
  const files = result.value
  const doc = store().document
  try {
    store().setLoading(true)
    const base = doc ? await PDFDocument.load(doc.bytes) : await PDFDocument.create()
    for (const file of files) {
      const source = await PDFDocument.load(file.data)
      for (const page of await base.copyPages(source, source.getPageIndices())) base.addPage(page)
    }
    const bytes = await base.save()
    if (doc) {
      await changeBytes(bytes, undefined, doc.pageSizes.length + 1)
    } else {
      await showDocument({ path: null, name: files.length === 1 ? files[0].name : 'Merged.pdf', data: bytes }, { unsaved: true })
    }
    store().showNotice({ kind: 'info', key: 'messages.merged', params: { count: String(files.length) } })
  } catch (err) {
    reportEditError(err)
  } finally {
    store().setLoading(false)
  }
}

export function splitPdf(): Promise<void> {
  return guarded(async () => {
    const doc = store().document!
    const groups = await openDialog({ type: 'split', pageCount: doc.pageSizes.length })
    if (!groups) return
    const dir = await window.api.pickDirectory()
    if (!dir.ok) return reportFailure(dir)
    store().setLoading(true)
    try {
      const bytes = await exportCurrent()
      if (!bytes) return
      const source = await PDFDocument.load(bytes)
      const digits = String(groups.length).length
      for (const [i, group] of groups.entries()) {
        const out = await copyToNewDocument(source, group)
        const name = `${baseName(doc.name)}-${String(i + 1).padStart(digits, '0')}.pdf`
        const written = await window.api.writeInDirectory(dir.value, name, out)
        if (!written.ok) return reportFailure(written)
      }
      store().showNotice({ kind: 'info', key: 'messages.split', params: { count: String(groups.length) } })
    } finally {
      store().setLoading(false)
    }
  })
}
