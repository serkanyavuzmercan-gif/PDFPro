import { useAppStore, type PageSize, type ToolId } from '../store/useAppStore'
import { useEditStore } from '../store/useEditStore'
import { commitDraft } from './draft'
import { measureText } from './fonts'
import { boundsOfPoints, clientToPage, rgbToHex } from './geometry'
import { changeObjects } from './history'
import { newId, type FontFamily, type MarkupObject, type MarkupType, type Rect } from './types'

export const MARKUP_TOOLS: Partial<Record<ToolId, MarkupType>> = {
  underline: 'underline',
  strikeout: 'strikeout'
}

/** Page wrapper element (`[data-page]`) for a viewer page. */
export function pageWrapper(pageNumber: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-viewer] [data-page="${pageNumber}"]`)
}

/** Maps a client rectangle into the page frame (bounding box of its four corners). */
export function clientRectToPage(rect: DOMRect, wrapper: DOMRect, size: PageSize, zoom: number): Rect {
  const corners = [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.left, rect.bottom],
    [rect.right, rect.bottom]
  ].map(([x, y]) => clientToPage(x, y, wrapper, size, zoom))
  return boundsOfPoints(corners)
}

/** Merges rects on the same line that touch or overlap, so a selection becomes one bar per line. */
export function mergeLineRects(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const result: Rect[] = []
  for (const r of sorted) {
    const last = result.find((m) => {
      const overlap = Math.min(m.y + m.height, r.y + r.height) - Math.max(m.y, r.y)
      const sameLine = overlap > Math.min(m.height, r.height) * 0.5
      const gap = Math.max(m.x, r.x) - Math.min(m.x + m.width, r.x + r.width)
      return sameLine && gap < Math.max(2, Math.min(m.height, r.height) * 0.6)
    })
    if (!last) {
      result.push({ ...r })
      continue
    }
    const x = Math.min(last.x, r.x)
    const y = Math.min(last.y, r.y)
    last.width = Math.max(last.x + last.width, r.x + r.width) - x
    last.height = Math.max(last.y + last.height, r.y + r.height) - y
    last.x = x
    last.y = y
  }
  return result
}

/** Creates markup objects from the current text selection. Returns true when something was added. */
export function markupFromSelection(type: MarkupType): boolean {
  const selection = window.getSelection()
  const doc = useAppStore.getState().document
  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !doc) return false
  const { zoom } = useAppStore.getState()
  const wrappers = [...document.querySelectorAll<HTMLElement>('[data-viewer] [data-page]')]
  const byPage = new Map<number, Rect[]>()

  for (let i = 0; i < selection.rangeCount; i++) {
    for (const rect of selection.getRangeAt(i).getClientRects()) {
      if (rect.width < 1 || rect.height < 1) continue
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      for (const wrapper of wrappers) {
        const box = wrapper.getBoundingClientRect()
        if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue
        const pageIndex = Number(wrapper.dataset.page) - 1
        const size = doc.pageSizes[pageIndex]
        const pageRect = clientRectToPage(rect, box, size, zoom)
        // Skip whole-layer rects (e.g. the end-of-content element).
        if (pageRect.height > size.baseHeight * 0.5) break
        byPage.set(pageIndex, [...(byPage.get(pageIndex) ?? []), pageRect])
        break
      }
    }
  }
  if (byPage.size === 0) return false

  const style = useEditStore.getState().settings.markup[type]
  const created: MarkupObject[] = [...byPage].map(([pageIndex, rects]) => ({
    id: newId(),
    kind: 'markup',
    pageIndex,
    type,
    rects: mergeLineRects(rects),
    color: style.color,
    opacity: style.opacity
  }))
  changeObjects((objects) => [...objects, ...created])
  selection.removeAllRanges()
  return true
}

function sampleCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number, number] | null {
  const rect = canvas.getBoundingClientRect()
  const x = Math.round(((clientX - rect.left) / rect.width) * canvas.width)
  const y = Math.round(((clientY - rect.top) / rect.height) * canvas.height)
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
  const data = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(x, y, 1, 1).data
  return data ? [data[0], data[1], data[2]] : null
}

const luminance = ([r, g, b]: [number, number, number]): number => 0.299 * r + 0.587 * g + 0.114 * b

/** Background color around a client rect: the most common color on a ring just outside it. */
function backgroundAround(canvas: HTMLCanvasElement, r: DOMRect): string {
  const samples: [number, number, number][] = []
  const pad = 2
  for (let i = 0; i <= 6; i++) {
    const fx = r.left + (r.width * i) / 6
    const fy = r.top + (r.height * i) / 6
    for (const [x, y] of [
      [fx, r.top - pad],
      [fx, r.bottom + pad],
      [r.left - pad, fy],
      [r.right + pad, fy]
    ]) {
      const s = sampleCanvas(canvas, x, y)
      if (s) samples.push(s)
    }
  }
  if (samples.length === 0) return '#ffffff'
  const counts = new Map<string, number>()
  for (const [red, green, blue] of samples) {
    const key = rgbToHex(red, green, blue)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0]
}

/** Darkest pixel inside the rect, used as the text color. */
function inkInside(canvas: HTMLCanvasElement, r: DOMRect): string {
  let darkest: [number, number, number] = [31, 41, 55]
  let best = Number.POSITIVE_INFINITY
  for (let i = 1; i < 20; i++) {
    for (let j = 1; j < 6; j++) {
      const s = sampleCanvas(canvas, r.left + (r.width * i) / 20, r.top + (r.height * j) / 6)
      if (s && luminance(s) < best) {
        best = luminance(s)
        darkest = s
      }
    }
  }
  return rgbToHex(...darkest)
}

function fontFromCss(fontFamily: string): FontFamily {
  const f = fontFamily.toLowerCase()
  if (f.includes('mono') || f.includes('courier')) return 'mono'
  if (f.includes('serif') && !f.includes('sans')) return 'serif'
  return 'sans'
}

/** "Edit Text": covers a text run on the page and opens it as an editable box. */
export function editPageText(span: HTMLElement, pageIndex: number): void {
  const text = span.textContent ?? ''
  const wrapper = pageWrapper(pageIndex + 1)
  const doc = useAppStore.getState().document
  if (!wrapper || !doc || text.trim() === '') return
  commitDraft()
  const { zoom } = useAppStore.getState()
  const size = doc.pageSizes[pageIndex]
  const clientRect = span.getBoundingClientRect()
  const rect = clientRectToPage(clientRect, wrapper.getBoundingClientRect(), size, zoom)
  const canvas = wrapper.querySelector('canvas')
  const fontSize = Math.max(4, Math.round(rect.height * 10) / 10)
  const { settings } = useEditStore.getState()
  const style = {
    ...settings.text,
    font: fontFromCss(span.style.fontFamily),
    size: fontSize,
    color: canvas ? inkInside(canvas, clientRect) : settings.text.color,
    bold: false,
    italic: false,
    align: 'left' as const
  }
  const width = Math.max(rect.width, measureText(text, style)) + fontSize * 0.5
  const lineH = fontSize * 1.2
  useEditStore.getState().select(null)
  useEditStore.getState().setDraft({
    kind: 'text',
    id: null,
    pageIndex,
    x: rect.x,
    y: rect.y - (lineH - rect.height) / 2,
    width,
    rotation: 0,
    text,
    originalText: text,
    style,
    fill: settings.comment.fill,
    border: settings.comment.border,
    cover: {
      x: rect.x - 1,
      y: rect.y - 1,
      width: rect.width + 2,
      height: rect.height + 2,
      color: canvas ? backgroundAround(canvas, clientRect) : '#ffffff'
    }
  })
}
