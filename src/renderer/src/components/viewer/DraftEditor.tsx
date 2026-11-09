import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { commitDraft } from '../../editing/draft'
import { clientDeltaToPage } from '../../editing/geometry'
import { textLikeHeight } from '../../editing/layout'
import { trackPointer } from '../../editing/pointer'
import { COMMENT_PADDING } from '../../editing/types'
import { useEditStore, type TextDraft } from '../../store/useEditStore'
import { boxStyle, textCss } from './ObjectViews'

const GRIP = 8

export function DraftEditor({
  draft,
  zoom,
  pageRotation
}: {
  draft: TextDraft
  zoom: number
  pageRotation: number
}): JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLTextAreaElement>(null)
  const padding = draft.kind === 'comment' ? COMMENT_PADDING : 0
  const height = textLikeHeight(draft.kind, draft.text, draft.style, draft.width)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [draft.token])

  const onGripPointerDown = (event: ReactPointerEvent): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const origin = { x: draft.x, y: draft.y }
    const field = ref.current
    const caret = field ? { start: field.selectionStart, end: field.selectionEnd } : null
    trackPointer(event, {
      onMove: (dx, dy) => {
        const delta = clientDeltaToPage(dx, dy, pageRotation, zoom)
        useEditStore.getState().updateDraft({ x: origin.x + delta.x, y: origin.y + delta.y })
      },
      onUp: () => {
        const node = ref.current
        if (!node) return
        node.focus({ preventScroll: true })
        if (caret) node.setSelectionRange(caret.start, caret.end)
      }
    })
  }

  const grip = (style: CSSProperties): JSX.Element => (
    <div data-draft title={t('properties.move')} onPointerDown={onGripPointerDown} style={{ position: 'absolute', cursor: 'move', ...style }} />
  )

  return (
    <>
      {draft.cover && (
        <div
          style={{
            position: 'absolute',
            left: draft.cover.x * zoom,
            top: draft.cover.y * zoom,
            width: draft.cover.width * zoom,
            height: draft.cover.height * zoom,
            background: draft.cover.color
          }}
        />
      )}
      <div
        data-draft
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          ...boxStyle({ ...draft, height }, zoom),
          background: draft.kind === 'comment' ? draft.fill : undefined,
          border: draft.kind === 'comment' ? `${zoom}px solid ${draft.border}` : undefined,
          outline: '1.5px dashed var(--color-brand)',
          outlineOffset: 2,
          padding: draft.kind === 'comment' ? (padding - 1) * zoom : 0,
          zIndex: 30
        }}
      >
        {grip({ left: -GRIP, right: -GRIP, top: -GRIP, height: GRIP })}
        {grip({ left: -GRIP, right: -GRIP, bottom: -GRIP, height: GRIP })}
        {grip({ top: 0, bottom: 0, left: -GRIP, width: GRIP })}
        {grip({ top: 0, bottom: 0, right: -GRIP, width: GRIP })}
        <textarea
          ref={ref}
          value={draft.text}
          spellCheck={false}
          onChange={(e) => useEditStore.getState().updateDraft({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
              e.preventDefault()
              e.stopPropagation()
              commitDraft()
            }
          }}
          className="relative z-[1] block size-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
          style={{
            ...textCss(draft.style, zoom),
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            caretColor: draft.style.color
          }}
        />
      </div>
    </>
  )
}
