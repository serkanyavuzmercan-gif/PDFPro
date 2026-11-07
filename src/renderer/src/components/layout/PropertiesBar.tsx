import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { replaceObject } from '../../editing/history'
import type { FontFamily, MarkupType, TextAlign, TextStyle } from '../../editing/types'
import { useAppStore, type ToolId } from '../../store/useAppStore'
import { useEditStore } from '../../store/useEditStore'

const FONTS: { id: FontFamily; labelKey: string }[] = [
  { id: 'sans', labelKey: 'properties.sans' },
  { id: 'serif', labelKey: 'properties.serif' },
  { id: 'mono', labelKey: 'properties.mono' }
]
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72]
const MARKUP_TOOLS: Partial<Record<ToolId, MarkupType>> = {
  underline: 'underline',
  strikeout: 'strikeout'
}

function ColorSwatch({
  value,
  onChange,
  title
}: {
  value: string
  onChange: (color: string) => void
  title: string
}): JSX.Element {
  return (
    <label className="relative flex size-6 cursor-pointer items-center justify-center rounded border border-chrome-border" title={title}>
      <span className="size-4 rounded-sm border border-black/10" style={{ background: value }} />
      <input
        type="color"
        value={value.length === 7 ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}

function Toggle({
  pressed,
  label,
  onClick,
  children
}: {
  pressed: boolean
  label: string
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded ${pressed ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-white'}`}
    >
      {children}
    </button>
  )
}

export function PropertiesBar(): JSX.Element | null {
  const { t } = useTranslation()
  const tool = useAppStore((s) => s.activeTool)
  const hasDoc = useAppStore((s) => s.document !== null)
  const draft = useEditStore((s) => s.draft)
  const selectedId = useEditStore((s) => s.selectedId)
  const objects = useEditStore((s) => s.objects)
  const settings = useEditStore((s) => s.settings)
  const selected = objects.find((o) => o.id === selectedId) ?? null

  if (!hasDoc) return null

  const patchSettings = (fn: (s: typeof settings) => typeof settings): void => {
    useEditStore.getState().updateSettings(fn)
  }

  const applyTextStyle = (patch: Partial<TextStyle>): void => {
    if (draft) {
      useEditStore.getState().updateDraft({ style: { ...draft.style, ...patch } })
    } else if (selected?.kind === 'text' || selected?.kind === 'comment') {
      replaceObject({ ...selected, style: { ...selected.style, ...patch } }, `style-${selected.id}`)
    }
    patchSettings((s) => ({ ...s, text: { ...s.text, ...patch } }))
  }

  const textStyle: TextStyle | null =
    draft?.style ??
    (selected?.kind === 'text' || selected?.kind === 'comment' ? selected.style : null) ??
    (tool === 'addText' || tool === 'editText' || tool === 'commentBox' ? settings.text : null)

  const commentColors =
    draft?.kind === 'comment'
      ? { fill: draft.fill, border: draft.border }
      : selected?.kind === 'comment'
        ? { fill: selected.fill, border: selected.border }
        : tool === 'commentBox'
          ? settings.comment
          : null

  const markupType: MarkupType | null =
    selected?.kind === 'markup' ? selected.type : (MARKUP_TOOLS[tool] ?? null)
  const markup =
    selected?.kind === 'markup'
      ? { color: selected.color, opacity: selected.opacity }
      : markupType
        ? settings.markup[markupType]
        : null

  const markerObject = selected?.kind === 'ink' && selected.marker ? selected : null
  const marker =
    markerObject !== null
      ? { color: markerObject.color, width: markerObject.width, opacity: markerObject.opacity }
      : tool === 'highlight'
        ? settings.markup.highlight
        : null

  const ink =
    selected?.kind === 'ink' && !selected.marker
      ? { color: selected.color, width: selected.width, opacity: selected.opacity }
      : tool === 'pen' && markerObject === null
        ? settings.ink
        : null

  const noteColor =
    selected?.kind === 'note' ? selected.color : tool === 'stickyNote' ? settings.note.color : null

  const showText = textStyle !== null
  const empty = !showText && !commentColors && !markup && !marker && !ink && !noteColor
  if (empty) return null

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 overflow-x-auto border-b border-chrome-border bg-chrome px-2">
      {showText && textStyle && (
        <>
          <select
            aria-label={t('properties.font')}
            value={textStyle.font}
            onChange={(e) => applyTextStyle({ font: e.target.value as FontFamily })}
            className="h-6 rounded border border-chrome-border bg-white px-1 text-[11px] outline-none"
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.labelKey)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('properties.size')}
            value={textStyle.size}
            onChange={(e) => applyTextStyle({ size: Number(e.target.value) })}
            className="h-6 w-14 rounded border border-chrome-border bg-white px-1 text-[11px] outline-none"
          >
            {!SIZES.includes(textStyle.size) && <option value={textStyle.size}>{textStyle.size}</option>}
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ColorSwatch value={textStyle.color} title={t('properties.color')} onChange={(color) => applyTextStyle({ color })} />
          <Toggle pressed={textStyle.bold} label={t('properties.bold')} onClick={() => applyTextStyle({ bold: !textStyle.bold })}>
            <Bold size={13} />
          </Toggle>
          <Toggle
            pressed={textStyle.italic}
            label={t('properties.italic')}
            onClick={() => applyTextStyle({ italic: !textStyle.italic })}
          >
            <Italic size={13} />
          </Toggle>
          {(['left', 'center', 'right'] as TextAlign[]).map((align, i) => {
            const Icon = [AlignLeft, AlignCenter, AlignRight][i]
            return (
              <Toggle
                key={align}
                pressed={textStyle.align === align}
                label={t(`properties.${align}`)}
                onClick={() => applyTextStyle({ align })}
              >
                <Icon size={13} />
              </Toggle>
            )
          })}
        </>
      )}

      {commentColors && (
        <>
          {showText && <span className="h-4 w-px bg-chrome-border" />}
          <span className="text-[11px] text-ink-muted">{t('properties.fill')}</span>
          <ColorSwatch
            value={commentColors.fill}
            title={t('properties.fill')}
            onChange={(fill) => {
              if (draft?.kind === 'comment') useEditStore.getState().updateDraft({ fill })
              else if (selected?.kind === 'comment') replaceObject({ ...selected, fill }, `style-${selected.id}`)
              patchSettings((s) => ({ ...s, comment: { ...s.comment, fill } }))
            }}
          />
          <span className="text-[11px] text-ink-muted">{t('properties.border')}</span>
          <ColorSwatch
            value={commentColors.border}
            title={t('properties.border')}
            onChange={(border) => {
              if (draft?.kind === 'comment') useEditStore.getState().updateDraft({ border })
              else if (selected?.kind === 'comment') replaceObject({ ...selected, border }, `style-${selected.id}`)
              patchSettings((s) => ({ ...s, comment: { ...s.comment, border } }))
            }}
          />
        </>
      )}

      {markup && markupType && (
        <>
          <ColorSwatch
            value={markup.color}
            title={t('properties.color')}
            onChange={(color) => {
              if (selected?.kind === 'markup') replaceObject({ ...selected, color }, `style-${selected.id}`)
              patchSettings((s) => ({ ...s, markup: { ...s.markup, [markupType]: { ...s.markup[markupType], color } } }))
            }}
          />
          <label className="flex items-center gap-1 text-[11px] text-ink-muted">
            {t('properties.opacity')}
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={markup.opacity}
              onChange={(e) => {
                const opacity = Number(e.target.value)
                if (selected?.kind === 'markup') replaceObject({ ...selected, opacity }, `style-${selected.id}`)
                patchSettings((s) => ({
                  ...s,
                  markup: { ...s.markup, [markupType]: { ...s.markup[markupType], opacity } }
                }))
              }}
              className="w-20 accent-brand"
            />
          </label>
        </>
      )}

      {marker && (
        <>
          <ColorSwatch
            value={marker.color}
            title={t('properties.color')}
            onChange={(color) => {
              if (markerObject) replaceObject({ ...markerObject, color }, `style-${markerObject.id}`)
              patchSettings((s) => ({ ...s, markup: { ...s.markup, highlight: { ...s.markup.highlight, color } } }))
            }}
          />
          <label className="flex items-center gap-1 text-[11px] text-ink-muted">
            {t('properties.width')}
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={marker.width}
              onChange={(e) => {
                const width = Number(e.target.value)
                if (markerObject) replaceObject({ ...markerObject, width }, `style-${markerObject.id}`)
                patchSettings((s) => ({ ...s, markup: { ...s.markup, highlight: { ...s.markup.highlight, width } } }))
              }}
              className="w-24 accent-brand"
            />
            <span className="w-5 tabular-nums text-ink">{marker.width}</span>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-ink-muted">
            {t('properties.opacity')}
            <input
              type="range"
              min={0.2}
              max={0.85}
              step={0.05}
              value={marker.opacity}
              onChange={(e) => {
                const opacity = Number(e.target.value)
                if (markerObject) replaceObject({ ...markerObject, opacity }, `style-${markerObject.id}`)
                patchSettings((s) => ({
                  ...s,
                  markup: { ...s.markup, highlight: { ...s.markup.highlight, opacity } }
                }))
              }}
              className="w-20 accent-brand"
            />
          </label>
        </>
      )}

      {ink && (
        <>
          <ColorSwatch
            value={ink.color}
            title={t('properties.color')}
            onChange={(color) => {
              if (selected?.kind === 'ink' && !selected.marker) replaceObject({ ...selected, color }, `style-${selected.id}`)
              patchSettings((s) => ({ ...s, ink: { ...s.ink, color } }))
            }}
          />
          <label className="flex items-center gap-1 text-[11px] text-ink-muted">
            {t('properties.width')}
            <input
              type="range"
              min={0.5}
              max={16}
              step={0.5}
              value={ink.width}
              onChange={(e) => {
                const width = Number(e.target.value)
                if (selected?.kind === 'ink' && !selected.marker) {
                  replaceObject({ ...selected, width }, `style-${selected.id}`)
                }
                patchSettings((s) => ({ ...s, ink: { ...s.ink, width } }))
              }}
              className="w-24 accent-brand"
            />
            <span className="w-6 tabular-nums text-ink">{ink.width}</span>
          </label>
        </>
      )}

      {noteColor && (
        <ColorSwatch
          value={noteColor}
          title={t('properties.color')}
          onChange={(color) => {
            if (selected?.kind === 'note') replaceObject({ ...selected, color }, `style-${selected.id}`)
            patchSettings((s) => ({ ...s, note: { color } }))
          }}
        />
      )}
    </div>
  )
}
