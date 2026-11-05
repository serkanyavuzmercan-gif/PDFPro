import { textBlockHeight } from './fonts'
import { boundsOfPoints, boundsOfRects } from './geometry'
import { COMMENT_PADDING, NOTE_SIZE, type EditObject, type Rect, type TextStyle } from './types'

export function textLikeHeight(kind: 'text' | 'comment', text: string, style: TextStyle, width: number): number {
  const padding = kind === 'comment' ? COMMENT_PADDING : 0
  return textBlockHeight(text, style, width - padding * 2) + padding * 2
}

/** Unrotated box of an object in the page frame (box objects rotate around its center). */
export function objectBox(obj: EditObject): Rect & { rotation: number } {
  switch (obj.kind) {
    case 'text':
    case 'comment':
      return {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: textLikeHeight(obj.kind, obj.text, obj.style, obj.width),
        rotation: obj.rotation
      }
    case 'image':
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height, rotation: obj.rotation }
    case 'note':
      return { x: obj.x, y: obj.y, width: NOTE_SIZE, height: NOTE_SIZE, rotation: 0 }
    case 'markup':
      return { ...boundsOfRects(obj.rects), rotation: 0 }
    case 'ink': {
      const pad = obj.width / 2
      const b = boundsOfPoints(obj.points)
      return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2, rotation: 0 }
    }
  }
}
