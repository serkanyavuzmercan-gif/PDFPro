import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DialogButton, Modal } from './Modal'
import { closeDialog, type SignatureResult } from './dialogStore'

const CANVAS_WIDTH = 520
const CANVAS_HEIGHT = 200
const PIXEL_RATIO = 2
const COLORS = ['#111827', '#1d4ed8', '#d71920']
const STORAGE_KEY = 'pdfpro.lastSignature'

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Crops the canvas to its drawn pixels plus a small margin; null when empty. */
function trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = source.getContext('2d')
  if (!ctx) return null
  const { width, height } = source
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const margin = 4 * PIXEL_RATIO
  minX = Math.max(0, minX - margin)
  minY = Math.max(0, minY - margin)
  maxX = Math.min(width - 1, maxX + margin)
  maxY = Math.min(height - 1, maxY + margin)
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1
  out.height = maxY - minY + 1
  out.getContext('2d')?.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

function toResult(canvas: HTMLCanvasElement): SignatureResult {
  const src = canvas.toDataURL('image/png')
  return {
    src,
    bytes: dataUrlToBytes(src),
    width: canvas.width / PIXEL_RATIO,
    height: canvas.height / PIXEL_RATIO
  }
}

export function SignatureDialog(): JSX.Element {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(2.5)
  const [empty, setEmpty] = useState(true)
  const [saved] = useState(() => localStorage.getItem(STORAGE_KEY))

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0)
  }, [])

  const pointFor = (event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    }
  }

  const drawTo = (point: { x: number; y: number }): void => {
    const ctx = canvasRef.current?.getContext('2d')
    const from = lastPoint.current
    if (!ctx || !from) return
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (from.x === point.x && from.y === point.y) {
      ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
    lastPoint.current = point
    setEmpty(false)
  }

  const clear = (): void => {
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    setEmpty(true)
  }

  const accept = (): void => {
    const canvas = canvasRef.current
    const trimmed = canvas && trimCanvas(canvas)
    if (!trimmed) return
    const result = toResult(trimmed)
    try {
      localStorage.setItem(STORAGE_KEY, result.src)
    } catch {
      // Storage full; the signature is still placed.
    }
    closeDialog(result)
  }

  const applySaved = async (): Promise<void> => {
    if (!saved) return
    const img = await loadImage(saved)
    closeDialog({
      src: saved,
      bytes: dataUrlToBytes(saved),
      width: img.naturalWidth / PIXEL_RATIO,
      height: img.naturalHeight / PIXEL_RATIO
    } satisfies SignatureResult)
  }

  return (
    <Modal
      title={t('dialogs.signature.title')}
      width={CANVAS_WIDTH + 34}
      onCancel={() => closeDialog(null)}
      footer={
        <>
          {saved && (
            <DialogButton onClick={() => void applySaved()}>{t('dialogs.signature.useLast')}</DialogButton>
          )}
          <span className="flex-1" />
          <DialogButton onClick={() => closeDialog(null)}>{t('common.cancel')}</DialogButton>
          <DialogButton variant="primary" disabled={empty} onClick={accept}>
            {t('dialogs.signature.place')}
          </DialogButton>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`size-5 rounded-full border-2 ${color === c ? 'border-ink' : 'border-white'}`}
                style={{ background: c, boxShadow: '0 0 0 1px #d9dadf' }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-ink-muted">
            {t('properties.width')}
            <input
              type="range"
              min={1}
              max={6}
              step={0.5}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="accent-brand"
            />
          </label>
          <span className="flex-1" />
          <button type="button" onClick={clear} className="rounded px-2 py-1 text-brand hover:bg-brand-soft">
            {t('dialogs.signature.clear')}
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH * PIXEL_RATIO}
          height={CANVAS_HEIGHT * PIXEL_RATIO}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, touchAction: 'none' }}
          className="cursor-crosshair rounded border border-dashed border-chrome-border bg-[linear-gradient(transparent_calc(100%-40px),#d9dadf_calc(100%-40px),#d9dadf_calc(100%-39px),transparent_calc(100%-39px))]"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            const p = pointFor(e)
            lastPoint.current = p
            drawTo(p)
          }}
          onPointerMove={(e) => {
            if (lastPoint.current) drawTo(pointFor(e))
          }}
          onPointerUp={() => {
            lastPoint.current = null
          }}
        />
        <span className="text-ink-muted">{t('dialogs.signature.hint')}</span>
      </div>
    </Modal>
  )
}
