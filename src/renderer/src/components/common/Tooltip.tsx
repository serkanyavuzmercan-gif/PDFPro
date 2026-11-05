import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  title: string
  description?: string
  shortcut?: string
  children: ReactNode
}

const SHOW_DELAY_MS = 450

export function Tooltip({ title, description, shortcut, children }: TooltipProps): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null)

  const show = (): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120)
      const above = rect.bottom + 70 > window.innerHeight
      setPos({ x, y: above ? rect.top - 6 : rect.bottom + 6, above })
    }, SHOW_DELAY_MS)
  }

  const hide = (): void => {
    window.clearTimeout(timerRef.current)
    setPos(null)
  }

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className={`pointer-events-none fixed z-[1000] max-w-60 -translate-x-1/2 rounded border border-chrome-border bg-white px-2.5 py-1.5 text-[11px] shadow-lg ${pos.above ? '-translate-y-full' : ''}`}
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="flex items-center gap-3 font-semibold text-ink">
              <span>{title}</span>
              {shortcut && (
                <span className="ml-auto font-normal text-ink-muted">({shortcut})</span>
              )}
            </div>
            {description && <div className="mt-0.5 text-ink-muted">{description}</div>}
          </div>,
          document.body
        )}
    </span>
  )
}
