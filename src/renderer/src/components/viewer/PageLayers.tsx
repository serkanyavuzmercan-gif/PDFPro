import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { X, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { commitDraft, startNewDraft, startObjectDraft } from '../../editing/draft'
import { useFontsVersion } from '../../editing/fonts'
import {
  clientDeltaToPage,
  clientToPage,
  distanceToSegment,
  pointInRect,
  rectFromPoints,
  resizeBox,
  rotateVector,
  translateObject
} from '../../editing/geometry'
import { addObject, removeObjects, replaceObject, updateObject } from '../../editing/history'
import { objectBox } from '../../editing/layout'
import { closeNote } from '../../editing/notes'
import { editPageText, MARKUP_TOOLS } from '../../editing/pageTools'
import { trackPointer } from '../../editing/pointer'
import {
  newId,
  NOTE_SIZE,
  type EditObject,
  type InkObject,
  type NoteObject,
  type Point,
  type Rect
} from '../../editing/types'
import { useAppStore, type PageSize, type ToolId } from '../../store/useAppStore'
import { useEditStore } from '../../store/useEditStore'
import { DraftEditor } from './DraftEditor'
import { BoxObjectContent, boxStyle, InkShape, MarkupShape, NoteIcon } from './ObjectViews'
import { TextLayer } from './TextLayer'

interface PageLayersProps {
  pdf: PDFDocumentProxy
  pageIndex: number
  size: PageSize
  zoom: number
  visible: boolean
}

interface FileNote {
  id: string
  x: number
  y: number
  title: string
  text: string
  color: string
}

const TEXT_LAYER_TOOLS = new Set<ToolId>(['select', 'editText', 'underline', 'strikeout'])
const OBJECT_TOOLS = new Set<ToolId>(['select', 'editObject', 'editText'])

const TOOL_CURSORS: Partial<Record<ToolId, string>> = {
  addText: 'text',
  commentBox: 'crosshair',
  pen: 'crosshair',
  eraser: 'cell',
  stickyNote: 'copy',
  highlight: 'crosshair',
  underline: 'text',
  strikeout: 'text'
}

function NotePopup({
  note,
  zoom,
  pageRotation,
  readOnly
}: {
  note: Pick<NoteObject, 'id' | 'x' | 'y' | 'text'> & { title?: string }
  zoom: number
  pageRotation: number
  readOnly?: { onClose: () => void }
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      data-note-popup
      className="absolute z-40"
      style={{
        left: (note.x + NOTE_SIZE / 2) * zoom,
        top: (note.y + NOTE_SIZE / 2) * zoom,
        width: 0,
        height: 0,
        transform: pageRotation ? `rotate(${-pageRotation}deg)` : undefined
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="absolute flex w-60 flex-col rounded-md border border-[#d4a72c] bg-[#fffbe6] shadow-lg"
        style={{ left: (NOTE_SIZE / 2) * zoom + 6, top: (-NOTE_SIZE / 2) * zoom }}
      >
        <div className="flex items-center gap-1 border-b border-[#ecd58a] px-2 py-1 text-[11px] text-ink-muted">
          <span className="flex-1 truncate font-medium">{note.title || t('properties.note')}</span>
          {!readOnly && (
            <button
              type="button"
              title={t('tools.deleteObject')}
              onClick={() => {
                useEditStore.getState().setOpenNote(null)
                removeObjects([note.id])
              }}
              className="rounded p-0.5 hover:bg-black/10"
            >
              <Trash size={12} />
            </button>
          )}
          <button
            type="button"
            title={t('common.close')}
            onClick={() => (readOnly ? readOnly.onClose() : closeNote(note.id))}
            className="rounded p-0.5 hover:bg-black/10"
          >
            <X size={12} />
          </button>
        </div>
        {readOnly ? (
          <div className="max-h-48 overflow-auto whitespace-pre-wrap px-2 py-1.5 text-[12px] text-ink select-text">
            {note.text}
          </div>
        ) : (
          <textarea
            autoFocus
            value={note.text}
            placeholder={t('properties.notePlaceholder')}
            onChange={(e) => updateObject(note.id, { text: e.target.value }, `note-${note.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                closeNote(note.id)
              }
            }}
            className="h-28 resize-none bg-transparent px-2 py-1.5 text-[12px] text-ink outline-none"
          />
        )}
      </div>
    </div>
  )
}

function useFileNotes(pdf: PDFDocumentProxy, pageIndex: number, size: PageSize, visible: boolean): FileNote[] {
  const [notes, setNotes] = useState<FileNote[]>([])
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void pdf
      .getPage(pageIndex + 1)
      .then((page) => page.getAnnotations())
      .then((annotations) => {
        if (cancelled) return
        setNotes(
          annotations
            .filter((a) => a.subtype === 'Text' && Array.isArray(a.rect))
            .map((a, i) => {
              const [x1, , , y2] = a.rect as number[]
              const c = a.color as Uint8ClampedArray | null | undefined
              return {
                id: String(a.id ?? i),
                x: x1 - size.viewBox[0],
                y: size.viewBox[3] - y2,
                title: (a.titleObj?.str as string | undefined) ?? '',
                text: (a.contentsObj?.str as string | undefined) ?? (a.contents as string | undefined) ?? '',
                color: c && c.length >= 3 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : '#f5c518'
              }
            })
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, pageIndex, size.viewBox, visible])
  return notes
}

/**
 * Everything drawn on top of a rendered page: the text layer and edit objects,
 * inside a frame that matches the unrotated page and is rotated with CSS.
 */
export function PageLayers({ pdf, pageIndex, size, zoom, visible }: PageLayersProps): JSX.Element {
  const tool = useAppStore((s) => s.activeTool)
  const allObjects = useEditStore((s) => s.objects)
  const selectedId = useEditStore((s) => s.selectedId)
  const draft = useEditStore((s) => s.draft)
  const openNoteId = useEditStore((s) => s.openNoteId)
  useFontsVersion()
  const frameRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<EditObject | null>(null)
  const [liveStroke, setLiveStroke] = useState<Pick<InkObject, 'points' | 'color' | 'width' | 'opacity' | 'marker'> | null>(
    null
  )
  const [liveRect, setLiveRect] = useState<Rect | null>(null)
  const [openFileNote, setOpenFileNote] = useState<string | null>(null)
  const fileNotes = useFileNotes(pdf, pageIndex, size, visible)

  const objects = useMemo(
    () =>
      allObjects
        .filter((o) => o.pageIndex === pageIndex && o.id !== draft?.id)
        .map((o) => (preview && o.id === preview.id ? preview : o)),
    [allObjects, pageIndex, draft?.id, preview]
  )

  const outerWidth = Math.floor(size.width * zoom)
  const outerHeight = Math.floor(size.height * zoom)
  const frameWidth = size.baseWidth * zoom
  const frameHeight = size.baseHeight * zoom
  const objectsInteractive = OBJECT_TOOLS.has(tool)

  const toPage = (clientX: number, clientY: number): Point => {
    const wrapper = frameRef.current?.parentElement?.getBoundingClientRect()
    return wrapper ? clientToPage(clientX, clientY, wrapper, size, zoom) : { x: 0, y: 0 }
  }
  const toPageDelta = (dx: number, dy: number): Point => clientDeltaToPage(dx, dy, size.rotation, zoom)

  /** Freehand stroke. A click with no movement still leaves a round dot. */
  const drawStroke = (
    e: ReactPointerEvent,
    style: Pick<InkObject, 'color' | 'width' | 'opacity' | 'marker'>
  ): void => {
    e.preventDefault()
    const points = [toPage(e.clientX, e.clientY)]
    setLiveStroke({ points, ...style })
    trackPointer(e, {
      onMove: (_dx, _dy, ev) => {
        const next = toPage(ev.clientX, ev.clientY)
        const last = points[points.length - 1]
        if (Math.hypot(next.x - last.x, next.y - last.y) < 0.35) return
        points.push(next)
        setLiveStroke({ points: [...points], ...style })
      },
      onUp: () => {
        setLiveStroke(null)
        addObject({ id: newId(), kind: 'ink', pageIndex, points, ...style }, false)
      }
    })
  }

  /** Drags out a rectangle on the page; resolves with it on release. */
  const dragRect = (e: ReactPointerEvent, onDone: (rect: Rect, moved: boolean) => void): void => {
    const start = toPage(e.clientX, e.clientY)
    trackPointer(e, {
      onMove: (_dx, _dy, ev) => setLiveRect(rectFromPoints(start, toPage(ev.clientX, ev.clientY))),
      onUp: (_dx, _dy, moved, ev) => {
        setLiveRect(null)
        onDone(rectFromPoints(start, toPage(ev.clientX, ev.clientY)), moved)
      }
    })
  }

  const eraseAt = (p: Point, key: string): void => {
    const radius = 6 / zoom
    const hits = useEditStore
      .getState()
      .objects.filter((o) => {
        if (o.pageIndex !== pageIndex) return false
        if (o.kind === 'ink') {
          return o.points.some(
            (pt, i) => distanceToSegment(p, o.points[Math.max(0, i - 1)], pt) <= radius + o.width / 2
          )
        }
        return o.kind === 'markup' && o.rects.some((r) => pointInRect(p, r, radius))
      })
      .map((o) => o.id)
    if (hits.length > 0) removeObjects(hits, key)
  }

  const onFramePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    const p = toPage(e.clientX, e.clientY)
    const { settings } = useEditStore.getState()

    switch (tool) {
      case 'addText':
        e.preventDefault()
        startNewDraft('text', pageIndex, p)
        return
      case 'commentBox': {
        e.preventDefault()
        const { clientX, clientY } = e
        trackPointer(e, {
          onMove: (_dx, _dy, ev) => setLiveRect(rectFromPoints(p, toPage(ev.clientX, ev.clientY))),
          onUp: (dx, dy, moved) => {
            setLiveRect(null)
            if (!moved) {
              startNewDraft('comment', pageIndex, p)
              return
            }
            // The box's on-screen top-left is the drag's top-left; its width the drag width.
            const anchor = toPage(clientX + Math.min(0, dx), clientY + Math.min(0, dy))
            startNewDraft('comment', pageIndex, anchor, Math.max(60, Math.abs(dx) / zoom))
          }
        })
        return
      }
      case 'stickyNote': {
        e.preventDefault()
        commitDraft()
        const note: NoteObject = {
          id: newId(),
          kind: 'note',
          pageIndex,
          x: p.x - NOTE_SIZE / 2,
          y: p.y - NOTE_SIZE / 2,
          text: '',
          color: settings.note.color
        }
        addObject(note)
        useEditStore.getState().setOpenNote(note.id)
        return
      }
      case 'pen':
        drawStroke(e, settings.ink)
        return
      case 'highlight':
        drawStroke(e, { ...settings.markup.highlight, marker: true })
        return
      case 'eraser': {
        e.preventDefault()
        const key = `erase-${newId()}`
        eraseAt(p, key)
        trackPointer(e, { onMove: (_dx, _dy, ev) => eraseAt(toPage(ev.clientX, ev.clientY), key) })
        return
      }
      case 'underline':
      case 'strikeout': {
        const target = e.target as HTMLElement
        // Pressing on text starts a native selection; the viewer turns it into markup on release.
        if (target.tagName === 'SPAN' && target.closest('.textLayer')) return
        e.preventDefault()
        window.getSelection()?.removeAllRanges()
        const type = MARKUP_TOOLS[tool]!
        dragRect(e, (rect, moved) => {
          if (!moved || rect.width < 2 || rect.height < 2) return
          const style = useEditStore.getState().settings.markup[type]
          addObject(
            { id: newId(), kind: 'markup', pageIndex, type, rects: [rect], color: style.color, opacity: style.opacity },
            false
          )
        })
        return
      }
      case 'editText':
        e.preventDefault()
        useAppStore.getState().showNotice({ kind: 'info', key: 'errors.noText' })
        return
      default:
    }
  }

  const onObjectPointerDown = (obj: EditObject, e: ReactPointerEvent): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (tool === 'editText' && (obj.kind === 'text' || obj.kind === 'comment')) {
      startObjectDraft(obj)
      return
    }
    useEditStore.getState().select(obj.id)
    let latest: EditObject | null = null
    trackPointer(e, {
      onMove: (dx, dy) => {
        latest = translateObject(obj, toPageDelta(dx, dy))
        setPreview(latest)
      },
      onUp: (_dx, _dy, moved) => {
        setPreview(null)
        if (moved && latest) {
          replaceObject(latest)
        } else if (obj.kind === 'note') {
          const { openNoteId: open, setOpenNote } = useEditStore.getState()
          if (open === obj.id) closeNote(obj.id)
          else setOpenNote(obj.id)
        }
      }
    })
  }

  const onHandlePointerDown = (obj: EditObject, corner: Point, e: ReactPointerEvent): void => {
    if (e.button !== 0 || (obj.kind !== 'text' && obj.kind !== 'comment' && obj.kind !== 'image')) return
    e.stopPropagation()
    e.preventDefault()
    const box = objectBox(obj)
    let latest: EditObject | null = null
    trackPointer(e, {
      onMove: (dx, dy, ev) => {
        const local = rotateVector(toPageDelta(dx, dy), -obj.rotation)
        const r = resizeBox(box, corner, local, {
          keepAspect: obj.kind === 'image' && !ev.shiftKey,
          minSize: obj.kind === 'image' ? 8 : 24
        })
        latest =
          obj.kind === 'image'
            ? { ...obj, x: r.x, y: r.y, width: r.width, height: r.height }
            : { ...obj, x: r.x, y: r.y, width: r.width }
        setPreview(latest)
      },
      onUp: (_dx, _dy, moved) => {
        setPreview(null)
        if (moved && latest) replaceObject(latest)
      }
    })
  }

  const showTextLayer = visible && TEXT_LAYER_TOOLS.has(tool)
  const selected = objects.find((o) => o.id === selectedId)
  const frameStyle = {
    position: 'absolute',
    left: (outerWidth - frameWidth) / 2,
    top: (outerHeight - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
    transform: size.rotation ? `rotate(${size.rotation}deg)` : undefined,
    transformOrigin: 'center',
    cursor: TOOL_CURSORS[tool],
    touchAction: tool === 'pen' || tool === 'highlight' || tool === 'eraser' ? 'none' : undefined,
    '--total-scale-factor': zoom,
    '--scale-round-x': '1px',
    '--scale-round-y': '1px'
  } as CSSProperties

  const svgObjects = objects.filter((o) => o.kind === 'markup' || o.kind === 'ink')
  const markerObjects = svgObjects.filter((o): o is InkObject => o.kind === 'ink' && o.marker === true)
  const boxObjects = objects.filter((o) => o.kind === 'text' || o.kind === 'comment' || o.kind === 'image')
  const notes = objects.filter((o): o is NoteObject => o.kind === 'note')
  const openNote = notes.find((n) => n.id === openNoteId)
  const svgInteractive = tool === 'editObject' || tool === 'select'

  return (
    <div ref={frameRef} style={frameStyle} onPointerDown={onFramePointerDown}>
      {showTextLayer && (
        <TextLayer
          pdf={pdf}
          pageNumber={pageIndex + 1}
          className={tool === 'editText' ? 'edit-text' : ''}
          onSpanPointerDown={
            tool === 'editText'
              ? (span, event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  editPageText(span, pageIndex)
                }
              : undefined
          }
        />
      )}

      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${size.baseWidth} ${size.baseHeight}`}
        preserveAspectRatio="none"
        style={{ zIndex: 4, mixBlendMode: 'multiply' }}
      >
        {markerObjects.map((o) => (
          <InkShape key={o.id} obj={o} />
        ))}
        {liveStroke?.marker && <InkShape obj={liveStroke} />}
      </svg>

      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${size.baseWidth} ${size.baseHeight}`}
        preserveAspectRatio="none"
        style={{ zIndex: 5 }}
      >
        {svgObjects.map((o) => (
          <g
            key={o.id}
            data-object
            style={{
              pointerEvents: svgInteractive && (o.kind === 'ink' || tool === 'editObject') ? 'auto' : 'none',
              cursor: 'move'
            }}
            onPointerDown={(e) => onObjectPointerDown(o, e)}
          >
            {o.kind === 'markup' ? (
              <>
                <MarkupShape obj={o} />
                {o.rects.map((r, i) => (
                  <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} fill="transparent" />
                ))}
              </>
            ) : (
              o.kind === 'ink' &&
              (o.marker ? (
                <InkShape obj={{ ...o, color: 'transparent', width: Math.max(o.width, 8 / zoom), opacity: 1 }} />
              ) : (
                <>
                  <InkShape obj={o} />
                  <InkShape obj={{ ...o, color: 'transparent', width: Math.max(o.width, 8 / zoom), opacity: 1 }} />
                </>
              ))
            )}
          </g>
        ))}
        {liveStroke && !liveStroke.marker && <InkShape obj={liveStroke} />}
        {liveRect && (
          <rect
            x={liveRect.x}
            y={liveRect.y}
            width={liveRect.width}
            height={liveRect.height}
            fill="rgb(215 25 32 / 0.06)"
            stroke="#d71920"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          />
        )}
      </svg>

      {boxObjects.map((o) =>
        o.kind === 'text' && o.cover ? (
          <div
            key={`cover-${o.id}`}
            className="pointer-events-none absolute"
            style={{
              left: o.cover.x * zoom,
              top: o.cover.y * zoom,
              width: o.cover.width * zoom,
              height: o.cover.height * zoom,
              background: o.cover.color,
              zIndex: 9
            }}
          />
        ) : null
      )}

      {boxObjects.map((o) => (
        <div
          key={o.id}
          data-object
          style={{
            ...boxStyle(objectBox(o), zoom),
            zIndex: 10,
            pointerEvents: objectsInteractive ? 'auto' : 'none',
            cursor: tool === 'editText' && o.kind !== 'image' ? 'text' : 'move'
          }}
          onPointerDown={(e) => onObjectPointerDown(o, e)}
          onDoubleClick={() => {
            if (o.kind !== 'image' && tool !== 'editText') startObjectDraft(o)
          }}
        >
          <BoxObjectContent obj={o} zoom={zoom} pageRotation={size.rotation} />
        </div>
      ))}

      {notes.map((n) => (
        <div
          key={n.id}
          data-object
          style={{
            ...boxStyle(objectBox(n), zoom),
            zIndex: 20,
            pointerEvents: objectsInteractive || tool === 'stickyNote' ? 'auto' : 'none',
            cursor: 'pointer'
          }}
          onPointerDown={(e) => onObjectPointerDown(n, e)}
        >
          <NoteIcon color={n.color} zoom={zoom} pageRotation={size.rotation} />
        </div>
      ))}

      {fileNotes.map((n) => (
        <div
          key={`file-${n.id}`}
          data-object
          title={n.text}
          style={{
            ...boxStyle({ x: n.x, y: n.y, width: NOTE_SIZE, height: NOTE_SIZE, rotation: 0 }, zoom),
            zIndex: 19,
            cursor: 'pointer',
            pointerEvents: tool === 'hand' ? 'none' : 'auto'
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            setOpenFileNote((id) => (id === n.id ? null : n.id))
          }}
        >
          <NoteIcon color={n.color} zoom={zoom} pageRotation={size.rotation} />
        </div>
      ))}

      {selected && (
        <SelectionFrame
          obj={selected}
          zoom={zoom}
          onHandlePointerDown={(corner, e) => onHandlePointerDown(selected, corner, e)}
        />
      )}

      {draft && draft.pageIndex === pageIndex && <DraftEditor draft={draft} zoom={zoom} />}

      {openNote && <NotePopup note={openNote} zoom={zoom} pageRotation={size.rotation} />}
      {fileNotes
        .filter((n) => n.id === openFileNote)
        .map((n) => (
          <NotePopup
            key={n.id}
            note={n}
            zoom={zoom}
            pageRotation={size.rotation}
            readOnly={{ onClose: () => setOpenFileNote(null) }}
          />
        ))}
    </div>
  )
}

const CORNERS: Point[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 }
]
const SIDES: Point[] = [
  { x: -1, y: 0 },
  { x: 1, y: 0 }
]

function SelectionFrame({
  obj,
  zoom,
  onHandlePointerDown
}: {
  obj: EditObject
  zoom: number
  onHandlePointerDown: (corner: Point, e: ReactPointerEvent) => void
}): JSX.Element {
  const box = objectBox(obj)
  const handles = obj.kind === 'image' ? CORNERS : obj.kind === 'text' || obj.kind === 'comment' ? SIDES : []
  return (
    <div
      className="pointer-events-none"
      style={{
        ...boxStyle(box, zoom),
        zIndex: 25,
        outline: '1.5px solid var(--color-brand)',
        outlineOffset: 2
      }}
    >
      {handles.map((c) => (
        <div
          key={`${c.x},${c.y}`}
          data-object
          className="pointer-events-auto absolute size-2.5 rounded-[2px] border border-brand bg-white"
          style={{
            left: `calc(${((c.x + 1) / 2) * 100}% - 5px)`,
            top: `calc(${((c.y + 1) / 2) * 100}% - 5px)`,
            cursor: c.y === 0 ? 'ew-resize' : c.x === c.y ? 'nwse-resize' : 'nesw-resize'
          }}
          onPointerDown={(e) => onHandlePointerDown(c, e)}
        />
      ))}
    </div>
  )
}
