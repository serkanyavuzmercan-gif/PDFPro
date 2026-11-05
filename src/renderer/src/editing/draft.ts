import { useAppStore } from '../store/useAppStore'
import { useEditStore, type TextDraft } from '../store/useEditStore'
import { rotateVector } from './geometry'
import { addObject, removeObjects, replaceObject } from './history'
import { lineHeight } from './fonts'
import {
  COMMENT_PADDING,
  newId,
  type CommentObject,
  type Point,
  type TextLikeObject,
  type TextObject
} from './types'

const edit = useEditStore.getState

export const DEFAULT_TEXT_WIDTH = 220

/** Text boxes stay upright on screen even on rotated pages. */
export function uprightRotation(pageIndex: number): number {
  const size = useAppStore.getState().document?.pageSizes[pageIndex]
  return size ? (360 - size.rotation) % 360 : 0
}

/**
 * Positions a new box so that its on-screen top-left corner sits at `anchor`,
 * taking the box rotation into account.
 */
export function boxAt(anchor: Point, width: number, height: number, rotation: number): Point {
  const toCenter = rotateVector({ x: width / 2, y: height / 2 }, rotation)
  return { x: anchor.x + toCenter.x - width / 2, y: anchor.y + toCenter.y - height / 2 }
}

export function startNewDraft(kind: TextDraft['kind'], pageIndex: number, anchor: Point, width?: number): void {
  commitDraft()
  const { settings } = edit()
  const rotation = uprightRotation(pageIndex)
  const w = width ?? DEFAULT_TEXT_WIDTH
  const padding = kind === 'comment' ? COMMENT_PADDING * 2 : 0
  const pos = boxAt(anchor, w, lineHeight(settings.text) + padding, rotation)
  edit().select(null)
  edit().setDraft({
    kind,
    id: null,
    pageIndex,
    x: pos.x,
    y: pos.y,
    width: w,
    rotation,
    text: '',
    style: { ...settings.text },
    fill: settings.comment.fill,
    border: settings.comment.border
  })
}

export function startObjectDraft(obj: TextLikeObject): void {
  commitDraft()
  edit().select(null)
  edit().setDraft({
    kind: obj.kind,
    id: obj.id,
    pageIndex: obj.pageIndex,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    rotation: obj.rotation,
    text: obj.text,
    style: { ...obj.style },
    fill: obj.kind === 'comment' ? obj.fill : edit().settings.comment.fill,
    border: obj.kind === 'comment' ? obj.border : edit().settings.comment.border,
    cover: obj.kind === 'text' ? obj.cover : undefined
  })
}

function draftToObject(draft: TextDraft, id: string): TextLikeObject {
  const base = {
    id,
    pageIndex: draft.pageIndex,
    x: draft.x,
    y: draft.y,
    width: draft.width,
    rotation: draft.rotation,
    text: draft.text.replace(/\s+$/, ''),
    style: draft.style
  }
  if (draft.kind === 'comment') {
    return { ...base, kind: 'comment', fill: draft.fill, border: draft.border } satisfies CommentObject
  }
  return { ...base, kind: 'text', cover: draft.cover } satisfies TextObject
}

/** Turns the open draft into an object (or updates the edited one). Safe to call at any time. */
export function commitDraft(): void {
  const draft = edit().draft
  if (!draft) return
  edit().setDraft(null)
  const empty = draft.text.trim() === ''
  if (draft.id) {
    if (empty) removeObjects([draft.id])
    else replaceObject(draftToObject(draft, draft.id))
    return
  }
  if (empty) return
  // Re-typing the same text over the original would only add a visible cover.
  if (draft.originalText !== undefined && draft.text === draft.originalText) return
  addObject(draftToObject(draft, newId()), false)
}

export function cancelDraft(): void {
  edit().setDraft(null)
}
