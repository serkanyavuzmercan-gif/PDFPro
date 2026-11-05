/**
 * Edit objects live in the unrotated page frame: origin at the top-left of the
 * page's view box, x to the right, y downwards, in PDF points. Page rotation is
 * applied only when displaying (CSS) and is irrelevant for export.
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type FontFamily = 'sans' | 'serif' | 'mono'
export type TextAlign = 'left' | 'center' | 'right'
export type MarkupType = 'highlight' | 'underline' | 'strikeout'

export interface TextStyle {
  font: FontFamily
  size: number
  color: string
  bold: boolean
  italic: boolean
  align: TextAlign
}

interface ObjectBase {
  id: string
  pageIndex: number
}

/** Box objects rotate around their center; `rotation` is clockwise degrees in the page frame. */
interface BoxBase extends ObjectBase {
  x: number
  y: number
  width: number
  rotation: number
}

export interface TextObject extends BoxBase {
  kind: 'text'
  text: string
  style: TextStyle
  /** Area painted over before drawing, used when replacing existing page text. */
  cover?: Rect & { color: string }
}

export interface CommentObject extends BoxBase {
  kind: 'comment'
  text: string
  style: TextStyle
  fill: string
  border: string
}

export interface ImageObject extends BoxBase {
  kind: 'image'
  height: number
  /** data: URL for display. */
  src: string
  bytes: Uint8Array
  format: 'png' | 'jpg'
  signature?: boolean
}

export interface MarkupObject extends ObjectBase {
  kind: 'markup'
  type: MarkupType
  rects: Rect[]
  color: string
  opacity: number
}

export interface InkObject extends ObjectBase {
  kind: 'ink'
  points: Point[]
  color: string
  width: number
  opacity: number
}

export interface NoteObject extends ObjectBase {
  kind: 'note'
  x: number
  y: number
  text: string
  color: string
}

export type EditObject =
  | TextObject
  | CommentObject
  | ImageObject
  | MarkupObject
  | InkObject
  | NoteObject

export type TextLikeObject = TextObject | CommentObject

export const LINE_HEIGHT = 1.2
export const COMMENT_PADDING = 6
export const NOTE_SIZE = 22

let idCounter = 0
export function newId(): string {
  idCounter += 1
  return `o${Date.now().toString(36)}${idCounter}`
}
