import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from './pdfService'

const PRINT_SCALE = 2

export interface PrintPageImage {
  /** 1-based page number in the document. */
  page: number
  src: string
}

/**
 * Rasterizes every page for the in-app preview and for the print stylesheet.
 * The caller must call `revoke` when the images are no longer shown.
 */
export async function renderPrintPages(
  pdf: PDFDocumentProxy
): Promise<{ pages: PrintPageImage[]; revoke: () => void }> {
  const pages: PrintPageImage[] = []
  const canvas = document.createElement('canvas')
  for (let i = 1; i <= pdf.numPages; i++) {
    await renderPageToCanvas(pdf, i, canvas, PRINT_SCALE).promise
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
    if (!blob) continue
    pages.push({ page: i, src: URL.createObjectURL(blob) })
  }
  return {
    pages,
    revoke: () => pages.forEach((page) => URL.revokeObjectURL(page.src))
  }
}

/** Puts the chosen pages into `#print-root` so the print stylesheet sends only those. */
export function mountPrintRoot(pages: PrintPageImage[]): () => void {
  document.getElementById('print-root')?.remove()
  const root = document.createElement('div')
  root.id = 'print-root'
  for (const page of pages) {
    const img = document.createElement('img')
    img.src = page.src
    img.alt = ''
    root.appendChild(img)
  }
  document.body.appendChild(root)
  return () => root.remove()
}
