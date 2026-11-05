import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from './pdfService'

const PRINT_SCALE = 2

/**
 * Renders every page into a print-only container (see `#print-root` styles),
 * so the system print dialog receives the document rather than the app UI.
 */
export async function preparePrintPages(pdf: PDFDocumentProxy): Promise<() => void> {
  const root = document.createElement('div')
  root.id = 'print-root'
  document.body.appendChild(root)

  const canvas = document.createElement('canvas')
  for (let i = 1; i <= pdf.numPages; i++) {
    await renderPageToCanvas(pdf, i, canvas, PRINT_SCALE).promise
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
    if (!blob) continue
    const img = document.createElement('img')
    img.src = URL.createObjectURL(blob)
    await img.decode()
    root.appendChild(img)
  }

  return () => {
    root.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src))
    root.remove()
  }
}
