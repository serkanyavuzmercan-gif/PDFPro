import type { CSSProperties } from 'react'
import { StickyNote } from 'lucide-react'
import { cssFontFamily, layoutLines, lineHeight } from '../../editing/fonts'
import {
  COMMENT_PADDING,
  NOTE_SIZE,
  type EditObject,
  type ImageObject,
  type InkObject,
  type MarkupObject,
  type TextStyle
} from '../../editing/types'

export function boxStyle(
  box: { x: number; y: number; width: number; height: number; rotation: number },
  zoom: number
): CSSProperties {
  return {
    position: 'absolute',
    left: box.x * zoom,
    top: box.y * zoom,
    width: box.width * zoom,
    height: box.height * zoom,
    transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
    transformOrigin: 'center'
  }
}

export function textCss(style: TextStyle, zoom: number): CSSProperties {
  return {
    fontFamily: cssFontFamily(style.font),
    fontSize: style.size * zoom,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    lineHeight: `${lineHeight(style) * zoom}px`,
    color: style.color,
    textAlign: style.align
  }
}

/** Renders wrapped lines exactly as the export does. */
export function TextLines({
  text,
  style,
  width,
  zoom
}: {
  text: string
  style: TextStyle
  width: number
  zoom: number
}): JSX.Element {
  const lines = layoutLines(text, style, width)
  return (
    <div style={{ ...textCss(style, zoom), whiteSpace: 'pre' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ height: lineHeight(style) * zoom }}>
          {line}
        </div>
      ))}
    </div>
  )
}

export function MarkupShape({ obj }: { obj: MarkupObject }): JSX.Element {
  if (obj.type === 'highlight') {
    return (
      <g style={{ mixBlendMode: 'multiply' }} opacity={obj.opacity} fill={obj.color}>
        {obj.rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} />
        ))}
      </g>
    )
  }
  return (
    <g stroke={obj.color} opacity={obj.opacity}>
      {obj.rects.map((r, i) => {
        const y = r.y + r.height * (obj.type === 'underline' ? 0.92 : 0.55)
        return (
          <line key={i} x1={r.x} x2={r.x + r.width} y1={y} y2={y} strokeWidth={Math.max(0.75, r.height * 0.07)} />
        )
      })}
    </g>
  )
}

export function InkShape({ obj }: { obj: Pick<InkObject, 'points' | 'color' | 'width' | 'opacity'> }): JSX.Element {
  const points = obj.points.length === 1 ? [obj.points[0], obj.points[0]] : obj.points
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke={obj.color}
      strokeWidth={obj.width}
      strokeOpacity={obj.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

export function NoteIcon({ color, zoom, pageRotation }: { color: string; zoom: number; pageRotation: number }): JSX.Element {
  return (
    <div
      className="flex size-full items-center justify-center rounded-sm border border-black/30 shadow-sm"
      style={{ background: color, transform: pageRotation ? `rotate(${-pageRotation}deg)` : undefined }}
    >
      <StickyNote size={Math.max(10, NOTE_SIZE * zoom * 0.65)} strokeWidth={1.8} className="text-black/70" />
    </div>
  )
}

function ImageView({ obj }: { obj: ImageObject }): JSX.Element {
  return <img src={obj.src} alt="" draggable={false} className="block size-full select-none" />
}

/** The HTML part of an object (SVG-based markup and ink are drawn separately). */
export function BoxObjectContent({
  obj,
  zoom,
  pageRotation
}: {
  obj: EditObject
  zoom: number
  pageRotation: number
}): JSX.Element | null {
  switch (obj.kind) {
    case 'text':
      return <TextLines text={obj.text} style={obj.style} width={obj.width} zoom={zoom} />
    case 'comment':
      return (
        <div
          className="size-full"
          style={{
            background: obj.fill,
            border: `${zoom}px solid ${obj.border}`,
            padding: (COMMENT_PADDING - 1) * zoom
          }}
        >
          <TextLines text={obj.text} style={obj.style} width={obj.width - COMMENT_PADDING * 2} zoom={zoom} />
        </div>
      )
    case 'image':
      return <ImageView obj={obj} />
    case 'note':
      return <NoteIcon color={obj.color} zoom={zoom} pageRotation={pageRotation} />
    default:
      return null
  }
}
