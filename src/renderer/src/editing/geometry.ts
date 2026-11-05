import type { PageSize } from '../store/useAppStore'
import type { EditObject, Point, Rect } from './types'

/** Rotates a vector clockwise (in y-down screen space) by `degrees`, matching CSS rotate(). */
export function rotateVector(v: Point, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

export function normalizeDegrees(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360
}

/**
 * Converts a client (screen) point into the unrotated page frame, given the
 * on-screen rectangle of the page wrapper (which shows the rotated page).
 */
export function clientToPage(
  clientX: number,
  clientY: number,
  wrapper: DOMRect,
  page: PageSize,
  zoom: number
): Point {
  const offset = rotateVector(
    { x: clientX - (wrapper.left + wrapper.width / 2), y: clientY - (wrapper.top + wrapper.height / 2) },
    -page.rotation
  )
  return {
    x: (offset.x + (page.baseWidth * zoom) / 2) / zoom,
    y: (offset.y + (page.baseHeight * zoom) / 2) / zoom
  }
}

/** Converts a screen-space drag delta into a page-frame delta. */
export function clientDeltaToPage(dx: number, dy: number, rotation: number, zoom: number): Point {
  const v = rotateVector({ x: dx, y: dy }, -rotation)
  return { x: v.x / zoom, y: v.y / zoom }
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

export function boundsOfPoints(points: Point[]): Rect {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function boundsOfRects(rects: Rect[]): Rect {
  const points = rects.flatMap((r) => [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y + r.height }
  ])
  return boundsOfPoints(points)
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function pointInRect(p: Point, r: Rect, margin = 0): boolean {
  return (
    p.x >= r.x - margin &&
    p.x <= r.x + r.width + margin &&
    p.y >= r.y - margin &&
    p.y <= r.y + r.height + margin
  )
}

/** Moves any object by a page-frame delta. */
export function translateObject(obj: EditObject, d: Point): EditObject {
  switch (obj.kind) {
    case 'markup':
      return { ...obj, rects: obj.rects.map((r) => ({ ...r, x: r.x + d.x, y: r.y + d.y })) }
    case 'ink':
      return { ...obj, points: obj.points.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) }
    default:
      return { ...obj, x: obj.x + d.x, y: obj.y + d.y }
  }
}

/**
 * Resizes a rotated box by dragging one corner while the opposite corner stays
 * fixed on screen. `corner` is (+-1, +-1) in the box's own frame.
 */
export function resizeBox(
  box: { x: number; y: number; width: number; height: number; rotation: number },
  corner: Point,
  localDelta: Point,
  options: { keepAspect: boolean; minSize: number }
): { x: number; y: number; width: number; height: number } {
  let width = Math.max(options.minSize, box.width + corner.x * localDelta.x)
  let height = Math.max(options.minSize, box.height + corner.y * localDelta.y)
  if (options.keepAspect && box.width > 0 && box.height > 0) {
    const scale = Math.max(width / box.width, height / box.height)
    width = Math.max(options.minSize, box.width * scale)
    height = Math.max(options.minSize, box.height * scale)
  }
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const fixedOffset = rotateVector(
    { x: (-corner.x * box.width) / 2, y: (-corner.y * box.height) / 2 },
    box.rotation
  )
  const fixed = { x: center.x + fixedOffset.x, y: center.y + fixedOffset.y }
  const newOffset = rotateVector({ x: (corner.x * width) / 2, y: (corner.y * height) / 2 }, box.rotation)
  const newCenter = { x: fixed.x + newOffset.x, y: fixed.y + newOffset.y }
  return { x: newCenter.x - width / 2, y: newCenter.y - height / 2, width, height }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value
  const num = Number.parseInt(full, 16)
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 }
  return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}
