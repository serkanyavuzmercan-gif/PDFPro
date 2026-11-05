import { useEffect, useState, type FormEvent } from 'react'
import { Maximize, Minus, MoveHorizontal, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MAX_ZOOM, MIN_ZOOM, useAppStore } from '../../store/useAppStore'
import { formatShortcut } from '../common/ActionButton'
import { Tooltip } from '../common/Tooltip'

const toPercent = (zoom: number): number => Math.round(zoom * 100)

function IconButton({
  label,
  shortcut,
  active = false,
  onClick,
  children
}: {
  label: string
  shortcut?: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <Tooltip title={label} shortcut={formatShortcut(shortcut)}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={`flex h-6 w-6 items-center justify-center rounded ${active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-chrome'}`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function ZoomControls(): JSX.Element {
  const { t } = useTranslation()
  const zoom = useAppStore((s) => s.zoom)
  const zoomMode = useAppStore((s) => s.zoomMode)
  const { setZoom, zoomIn, zoomOut, setZoomMode } = useAppStore.getState()
  const [draft, setDraft] = useState(String(toPercent(zoom)))

  useEffect(() => setDraft(String(toPercent(zoom))), [zoom])

  const commitDraft = (e?: FormEvent): void => {
    e?.preventDefault()
    const value = Number.parseFloat(draft)
    if (Number.isFinite(value) && value > 0) setZoom(value / 100)
    else setDraft(String(toPercent(zoom)))
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('zoom.slider')}>
      <IconButton
        label={t('tools.fitPage')}
        shortcut="Ctrl+1"
        active={zoomMode === 'fitPage'}
        onClick={() => setZoomMode('fitPage')}
      >
        <Maximize size={14} />
      </IconButton>
      <IconButton
        label={t('tools.fitWidth')}
        shortcut="Ctrl+2"
        active={zoomMode === 'fitWidth'}
        onClick={() => setZoomMode('fitWidth')}
      >
        <MoveHorizontal size={14} />
      </IconButton>
      <span className="mx-1 h-4 w-px bg-chrome-border" />
      <IconButton label={t('tools.zoomOut')} shortcut="Ctrl+-" onClick={zoomOut}>
        <Minus size={14} />
      </IconButton>
      <input
        type="range"
        min={MIN_ZOOM * 100}
        max={MAX_ZOOM * 100}
        step={5}
        value={toPercent(zoom)}
        aria-label={t('zoom.slider')}
        onChange={(e) => setZoom(Number(e.target.value) / 100)}
        className="h-1 w-28 cursor-pointer accent-brand"
      />
      <IconButton label={t('tools.zoomIn')} shortcut="Ctrl+=" onClick={zoomIn}>
        <Plus size={14} />
      </IconButton>
      <form onSubmit={commitDraft} className="flex items-center">
        <input
          value={draft}
          aria-label={t('zoom.percent')}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
          onBlur={() => commitDraft()}
          onFocus={(e) => e.target.select()}
          className="h-6 w-11 rounded-l border border-r-0 border-chrome-border bg-white px-1 text-right text-[11px] outline-none focus:border-brand"
        />
        <span className="flex h-6 items-center rounded-r border border-l-0 border-chrome-border bg-white pr-1.5 text-[11px] text-ink-muted">
          %
        </span>
      </form>
    </div>
  )
}
