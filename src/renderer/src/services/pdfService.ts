import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PageSize } from '../store/useAppStore'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const assetBase = new URL('./pdfjs/', document.baseURI).href
const MAX_CANVAS_PIXELS = 16_777_216

export type PdfLoadErrorCode = 'CORRUPT' | 'PASSWORD' | 'UNKNOWN'

export class PdfLoadError extends Error {
  constructor(
    readonly code: PdfLoadErrorCode,
    cause?: unknown
  ) {
    super(code, { cause })
  }
}

export interface LoadedPdf {
  pdf: PDFDocumentProxy
  pageSizes: PageSize[]
}

export async function loadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  const task = pdfjs.getDocument({
    // pdf.js transfers (detaches) the buffer it receives, so keep the original intact.
    data: bytes.slice(),
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    wasmUrl: `${assetBase}wasm/`,
    iccUrl: `${assetBase}iccs/`,
    enableXfa: false
  })

  let pdf: PDFDocumentProxy
  try {
    pdf = await task.promise
  } catch (err) {
    const name = (err as { name?: string } | undefined)?.name
    if (name === 'PasswordException') throw new PdfLoadError('PASSWORD', err)
    if (name === 'InvalidPDFException' || name === 'FormatError') {
      throw new PdfLoadError('CORRUPT', err)
    }
    throw new PdfLoadError('UNKNOWN', err)
  }

  try {
    const pageSizes: PageSize[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const { width, height } = page.getViewport({ scale: 1 })
      pageSizes.push({ width, height })
    }
    return { pdf, pageSizes }
  } catch (err) {
    void pdf.loadingTask.destroy()
    throw new PdfLoadError('CORRUPT', err)
  }
}

/** Resolves an outline destination (named or explicit) to a 1-based page number. */
export async function resolveDestinationPage(
  pdf: PDFDocumentProxy,
  dest: string | unknown[] | null
): Promise<number | null> {
  const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
  if (!Array.isArray(explicit) || explicit.length === 0) return null
  const ref = explicit[0]
  if (typeof ref === 'number') return ref + 1
  if (ref && typeof ref === 'object' && 'num' in ref && 'gen' in ref) {
    return (await pdf.getPageIndex(ref as { num: number; gen: number })) + 1
  }
  return null
}

/** Bytes to write on save. Editing phases will apply their changes here via pdf-lib. */
export async function exportPdf(bytes: Uint8Array): Promise<Uint8Array> {
  return bytes
}

/** Renders a page into a canvas at the given CSS scale, honoring device pixel ratio. */
export function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number
): { promise: Promise<void>; cancel: () => void } {
  let cancelled = false
  let cancelTask: (() => void) | null = null

  const promise = (async () => {
    const page = await pdf.getPage(pageNumber)
    if (cancelled) return
    const base = page.getViewport({ scale })
    // Cap the backing store so very high zoom levels don't exhaust GPU memory.
    const maxPixelRatio = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height))
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio)
    const viewport = page.getViewport({ scale: scale * pixelRatio })
    // Render offscreen: resizing the visible canvas would blank it until the render finishes.
    const offscreen = document.createElement('canvas')
    offscreen.width = Math.floor(viewport.width)
    offscreen.height = Math.floor(viewport.height)
    const task = page.render({ canvas: offscreen, viewport })
    cancelTask = () => task.cancel()
    try {
      await task.promise
    } catch (err) {
      if ((err as { name?: string }).name === 'RenderingCancelledException') return
      throw err
    }
    if (cancelled) return
    canvas.width = offscreen.width
    canvas.height = offscreen.height
    canvas.getContext('2d')?.drawImage(offscreen, 0, 0)
    offscreen.width = 0
    offscreen.height = 0
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      cancelTask?.()
    }
  }
}
