import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface PanState {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Drag-to-pan for the scroll container: active with the Hand tool, while
 * Space is held, or with the middle mouse button in any tool.
 */
export function usePanning(scrollRef: RefObject<HTMLDivElement | null>): {
  panning: boolean
  panEnabled: boolean
  panHandlers: {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void
  }
} {
  const handTool = useAppStore((s) => s.activeTool === 'hand')
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const panRef = useRef<PanState | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return
      event.preventDefault()
      setSpaceHeld(true)
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    const onBlur = (): void => setSpaceHeld(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const panEnabled = handTool || spaceHeld

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current
    const middle = e.button === 1
    if (!el || !(middle || (panEnabled && e.button === 0))) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop
    }
    setPanning(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current
    const pan = panRef.current
    if (!el || !pan || pan.pointerId !== e.pointerId) return
    el.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX)
    el.scrollTop = pan.scrollTop - (e.clientY - pan.startY)
  }

  const endPan = (e: PointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    scrollRef.current?.releasePointerCapture(e.pointerId)
    panRef.current = null
    setPanning(false)
  }

  return {
    panning,
    panEnabled,
    panHandlers: { onPointerDown, onPointerMove, onPointerUp: endPan, onPointerCancel: endPan }
  }
}
