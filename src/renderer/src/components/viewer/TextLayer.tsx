import { useEffect, useRef } from 'react'
import { TextLayer as PdfTextLayer, type PDFDocumentProxy } from 'pdfjs-dist'

interface TextLayerProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  /** Enables clicking spans (used by "Edit Text"). */
  onSpanPointerDown?: (span: HTMLElement, event: PointerEvent) => void
  className?: string
}

/**
 * Selectable text for one page, laid out in the unrotated page frame. It scales
 * with the parent's --total-scale-factor, so zooming never rebuilds it.
 */
export function TextLayer({ pdf, pageNumber, onSpanPointerDown, className = '' }: TextLayerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const handlerRef = useRef(onSpanPointerDown)
  handlerRef.current = onSpanPointerDown

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let layer: PdfTextLayer | null = null
    container.replaceChildren()

    void pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return
      layer = new PdfTextLayer({
        textContentSource: page.streamTextContent({ includeMarkedContent: true, disableNormalization: true }),
        container,
        viewport: page.getViewport({ scale: 1, rotation: 0 })
      })
      try {
        await layer.render()
      } catch {
        // Cancelled or a page without text.
      }
    })
    return () => {
      cancelled = true
      layer?.cancel()
    }
  }, [pdf, pageNumber])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement
      if (handlerRef.current && target.tagName === 'SPAN' && target.parentElement && container.contains(target)) {
        handlerRef.current(target, event)
      }
    }
    container.addEventListener('pointerdown', onPointerDown)
    return () => container.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return <div ref={containerRef} className={`textLayer ${className}`} />
}
