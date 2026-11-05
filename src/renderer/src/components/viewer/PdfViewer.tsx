import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { commitDraft } from '../../editing/draft'
import { MARKUP_TOOLS, markupFromSelection } from '../../editing/pageTools'
import { useAppStore, type OpenDocument } from '../../store/useAppStore'
import { useEditStore } from '../../store/useEditStore'
import { PageCanvas } from './PageCanvas'
import { closeNote } from '../../editing/notes'
import { PageLayers } from './PageLayers'
import { usePanning } from './usePanning'

const PAGE_GAP = 12
const VIEW_PADDING = 24

interface ZoomAnchor {
  /** Anchor point relative to the scroll container's visible area. */
  x: number
  y: number
}

export function PdfViewer({ doc }: { doc: OpenDocument }): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const zoom = useAppStore((s) => s.zoom)
  const zoomMode = useAppStore((s) => s.zoomMode)
  const scrollMode = useAppStore((s) => s.scrollMode)
  const currentPage = useAppStore((s) => s.currentPage)
  const navRequest = useAppStore((s) => s.navRequest)
  const markupType = useAppStore((s) => MARKUP_TOOLS[s.activeTool])
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null)
  const prevZoomRef = useRef(zoom)
  const { panning, panEnabled, panHandlers } = usePanning(scrollRef)

  const pages =
    scrollMode === 'single'
      ? [currentPage]
      : Array.from({ length: doc.pageSizes.length }, (_, i) => i + 1)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      setViewportSize({ width: el.clientWidth, height: el.clientHeight })
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Fit modes derive the zoom from the available space.
  useEffect(() => {
    if (zoomMode === 'custom' || viewportSize.width === 0) return
    const size = doc.pageSizes[currentPage - 1] ?? doc.pageSizes[0]
    const availableWidth = viewportSize.width - VIEW_PADDING * 2
    const availableHeight = viewportSize.height - VIEW_PADDING * 2
    const widest = Math.max(...doc.pageSizes.map((p) => p.width))
    const fit =
      zoomMode === 'fitWidth'
        ? availableWidth / widest
        : Math.min(availableWidth / size.width, availableHeight / size.height)
    useAppStore.getState().applyFitZoom(fit)
  }, [zoomMode, viewportSize, doc, currentPage])

  // Keep the point under the cursor (or the view center) fixed while zooming.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const previous = prevZoomRef.current
    prevZoomRef.current = zoom
    if (!el || previous === zoom) return
    const anchor = zoomAnchorRef.current ?? {
      x: el.clientWidth / 2,
      // Stay pinned to the top when at the top (e.g. the initial fit after opening).
      y: el.scrollTop === 0 ? 0 : el.clientHeight / 2
    }
    zoomAnchorRef.current = null
    const ratio = zoom / previous
    el.scrollLeft = (el.scrollLeft + anchor.x) * ratio - anchor.x
    el.scrollTop = (el.scrollTop + anchor.y) * ratio - anchor.y
  }, [zoom])

  // Ctrl + wheel zoom; registered natively because React wheel listeners are passive.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (event: WheelEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAnchorRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const { zoom: current, setZoom } = useAppStore.getState()
      setZoom(current * (event.deltaY < 0 ? 1.1 : 1 / 1.1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Explicit navigation (thumbnails, page box, shortcuts).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (scrollMode === 'single') {
      el.scrollTop = 0
      return
    }
    const target = el.querySelector<HTMLElement>(`[data-page="${navRequest.page}"]`)
    if (target) el.scrollTop = navRequest.page === 1 ? 0 : target.offsetTop - PAGE_GAP
  }, [navRequest, scrollMode])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || scrollMode === 'single') return
    const probe = el.scrollTop + el.clientHeight * 0.35
    const nodes = el.querySelectorAll<HTMLElement>('[data-page]')
    let page = 1
    for (const node of nodes) {
      if (node.offsetTop <= probe) page = Number(node.dataset.page)
      else break
    }
    if (page !== useAppStore.getState().currentPage) useAppStore.getState().setCurrentPage(page)
  }, [scrollMode])

  // In single-page mode, scrolling past either edge flips the page.
  const onWheelSingle = (event: React.WheelEvent<HTMLDivElement>): void => {
    if (scrollMode !== 'single' || event.ctrlKey || event.metaKey) return
    const el = event.currentTarget
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const atTop = el.scrollTop <= 0
    const { goToPage, currentPage: page } = useAppStore.getState()
    if (event.deltaY > 0 && atBottom) goToPage(page + 1)
    else if (event.deltaY < 0 && atTop) goToPage(page - 1)
  }

  // Clicking anywhere outside the open text box, selection or note commits / clears them.
  const onPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    if (!target.closest('[data-draft]')) commitDraft()
    if (!target.closest('[data-object]')) useEditStore.getState().select(null)
    if (!target.closest('[data-note-popup]') && !target.closest('[data-object]')) closeNote()
  }

  // Markup tools turn a finished text selection into highlight / underline / strikeout.
  useEffect(() => {
    if (!markupType) return
    const onPointerUp = (): void => {
      // Let the browser finalize the selection first.
      window.setTimeout(() => markupFromSelection(markupType), 0)
    }
    document.addEventListener('pointerup', onPointerUp)
    return () => document.removeEventListener('pointerup', onPointerUp)
  }, [markupType])

  const cursor = panning ? 'cursor-grabbing' : panEnabled ? 'cursor-grab' : ''

  return (
    <div
      ref={scrollRef}
      data-viewer
      className={`relative h-full w-full overflow-auto bg-workspace ${cursor}`}
      onScroll={onScroll}
      onWheel={onWheelSingle}
      onPointerDownCapture={onPointerDownCapture}
      {...panHandlers}
    >
      <div
        className="flex min-h-full min-w-fit flex-col items-center"
        style={{ padding: VIEW_PADDING, gap: PAGE_GAP }}
      >
        {pages.map((pageNumber) => (
          <PageCanvas
            key={pageNumber}
            pdf={doc.pdf}
            pageNumber={pageNumber}
            size={doc.pageSizes[pageNumber - 1]}
            scale={zoom}
            renderDelayMs={120}
            className={`shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.25)] ${panEnabled ? 'pointer-events-none' : ''}`}
            layers={(visible) => (
              <PageLayers
                pdf={doc.pdf}
                pageIndex={pageNumber - 1}
                size={doc.pageSizes[pageNumber - 1]}
                zoom={zoom}
                visible={visible}
              />
            )}
          />
        ))}
      </div>
    </div>
  )
}
