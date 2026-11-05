import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from '../../services/pdfService'
import type { PageSize } from '../../store/useAppStore'

interface PageCanvasProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  size: PageSize
  scale: number
  /** Delay before re-rendering after a scale change, so rapid zooming stays smooth. */
  renderDelayMs?: number
  className?: string
}

/**
 * A page placeholder sized from the page dimensions that only rasterizes while
 * near the visible area. During zoom the previous bitmap is stretched by CSS
 * until the sharper render completes.
 */
export function PageCanvas({
  pdf,
  pageNumber,
  size,
  scale,
  renderDelayMs = 0,
  className = ''
}: PageCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const renderedRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '600px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!visible || !canvas) return
    let job: ReturnType<typeof renderPageToCanvas> | null = null
    const timer = window.setTimeout(
      () => {
        job = renderPageToCanvas(pdf, pageNumber, canvas, scale)
        job.promise
          .then(() => {
            renderedRef.current = true
          })
          .catch((err) => console.error(err))
      },
      renderedRef.current ? renderDelayMs : 0
    )
    return () => {
      window.clearTimeout(timer)
      job?.cancel()
    }
  }, [pdf, pageNumber, scale, visible, renderDelayMs])

  const width = Math.floor(size.width * scale)
  const height = Math.floor(size.height * scale)

  return (
    <div
      ref={containerRef}
      className={`relative bg-white ${className}`}
      style={{ width, height }}
      data-page={pageNumber}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
