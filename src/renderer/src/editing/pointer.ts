/**
 * Follows a pointer drag started by `event` until release. Deltas are in
 * client pixels relative to the start. Returns false from onUp when the
 * pointer barely moved (a click).
 */
export function trackPointer(
  event: { clientX: number; clientY: number; pointerId: number },
  handlers: {
    onMove?: (dx: number, dy: number, e: PointerEvent) => void
    onUp?: (dx: number, dy: number, moved: boolean, e: PointerEvent) => void
  }
): void {
  const startX = event.clientX
  const startY = event.clientY
  let moved = false
  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== event.pointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!moved && Math.hypot(dx, dy) < 3) return
    moved = true
    handlers.onMove?.(dx, dy, e)
  }
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== event.pointerId) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    handlers.onUp?.(e.clientX - startX, e.clientY - startY, moved, e)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
