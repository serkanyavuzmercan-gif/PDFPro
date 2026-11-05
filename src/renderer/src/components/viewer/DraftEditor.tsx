import { useEffect, useRef } from 'react'
import { commitDraft } from '../../editing/draft'
import { textLikeHeight } from '../../editing/layout'
import { COMMENT_PADDING } from '../../editing/types'
import { useEditStore, type TextDraft } from '../../store/useEditStore'
import { boxStyle, textCss } from './ObjectViews'

export function DraftEditor({ draft, zoom }: { draft: TextDraft; zoom: number }): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  const padding = draft.kind === 'comment' ? COMMENT_PADDING : 0
  const height = textLikeHeight(draft.kind, draft.text, draft.style, draft.width)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [draft.id, draft.pageIndex, draft.x, draft.y])

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
          className="block size-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
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
