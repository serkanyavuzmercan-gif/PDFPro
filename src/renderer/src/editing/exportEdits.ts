import fontkit from '@pdf-lib/fontkit'
import {
  BlendMode,
  LineCapStyle,
  PDFDocument,
  PDFHexString,
  PDFString,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage
} from 'pdf-lib'
import type { PageSize } from '../store/useAppStore'
import { getFontBytes, layoutLines, lineHeight } from './fonts'
import { hexToRgb } from './geometry'
import {
  COMMENT_PADDING,
  NOTE_SIZE,
  type EditObject,
  type ImageObject,
  type InkObject,
  type MarkupObject,
  type NoteObject,
  type TextLikeObject,
  type TextStyle
} from './types'

const color = (hex: string): ReturnType<typeof rgb> => {
  const { r, g, b } = hexToRgb(hex)
  return rgb(r, g, b)
}

interface Context {
  doc: PDFDocument
  fonts: Map<string, Promise<PDFFont>>
  images: Map<Uint8Array, Promise<PDFImage>>
}

function embedFont(ctx: Context, style: TextStyle): Promise<PDFFont> {
  const key = `${style.font}-${style.bold}-${style.italic}`
  let font = ctx.fonts.get(key)
  if (!font) {
    font = getFontBytes(style).then((bytes) => ctx.doc.embedFont(bytes, { subset: true }))
    ctx.fonts.set(key, font)
  }
  return font
}

function embedImage(ctx: Context, obj: ImageObject): Promise<PDFImage> {
  let image = ctx.images.get(obj.bytes)
  if (!image) {
    image = obj.format === 'png' ? ctx.doc.embedPng(obj.bytes) : ctx.doc.embedJpg(obj.bytes)
    ctx.images.set(obj.bytes, image)
  }
  return image
}

/** Page-frame (top-left, y down) to PDF user space. */
function toUser(info: PageSize, x: number, y: number): { x: number; y: number } {
  return { x: info.viewBox[0] + x, y: info.viewBox[3] - y }
}

/**
 * Runs `draw` in a local coordinate system for a rotated box: origin at the
 * box's bottom-left, y up, width x height, rotated clockwise around its center.
 */
function inBox(
  page: PDFPage,
  info: PageSize,
  box: { x: number; y: number; width: number; height: number; rotation: number },
  draw: () => void
): void {
  const center = toUser(info, box.x + box.width / 2, box.y + box.height / 2)
  const phi = (-box.rotation * Math.PI) / 180
  const a = Math.cos(phi)
  const b = Math.sin(phi)
  const c = -b
  const d = a
  const e = center.x + a * (-box.width / 2) + c * (-box.height / 2)
  const f = center.y + b * (-box.width / 2) + d * (-box.height / 2)
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(a, b, c, d, e, f))
  draw()
  page.pushOperators(popGraphicsState())
}

async function drawTextLike(ctx: Context, page: PDFPage, info: PageSize, obj: TextLikeObject): Promise<void> {
  const padding = obj.kind === 'comment' ? COMMENT_PADDING : 0
  const innerWidth = obj.width - padding * 2
  const lines = layoutLines(obj.text, obj.style, innerWidth)
  const lh = lineHeight(obj.style)
  const height = Math.max(1, lines.length) * lh + padding * 2
  const font = await embedFont(ctx, obj.style)

  if (obj.kind === 'text' && obj.cover) {
    const { x, y } = toUser(info, obj.cover.x, obj.cover.y + obj.cover.height)
    page.drawRectangle({ x, y, width: obj.cover.width, height: obj.cover.height, color: color(obj.cover.color) })
  }

  const ascent = font.heightAtSize(obj.style.size, { descender: false })
  const fullHeight = font.heightAtSize(obj.style.size)
  const baselineOffset = (lh - fullHeight) / 2 + ascent

  inBox(page, info, { x: obj.x, y: obj.y, width: obj.width, height, rotation: obj.rotation }, () => {
    if (obj.kind === 'comment') {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: obj.width,
        height,
        color: color(obj.fill),
        borderColor: color(obj.border),
        borderWidth: 1
      })
    }
    lines.forEach((line, i) => {
      if (line === '') return
      const lineWidth = font.widthOfTextAtSize(line, obj.style.size)
      const offset =
        obj.style.align === 'center'
          ? (innerWidth - lineWidth) / 2
          : obj.style.align === 'right'
            ? innerWidth - lineWidth
            : 0
      page.drawText(line, {
        x: padding + offset,
        y: height - padding - i * lh - baselineOffset,
        size: obj.style.size,
        font,
        color: color(obj.style.color)
      })
    })
  })
}

async function drawImage(ctx: Context, page: PDFPage, info: PageSize, obj: ImageObject): Promise<void> {
  const image = await embedImage(ctx, obj)
  inBox(page, info, obj, () => {
    page.drawImage(image, { x: 0, y: 0, width: obj.width, height: obj.height })
  })
}

function drawMarkup(page: PDFPage, info: PageSize, obj: MarkupObject): void {
  const c = color(obj.color)
  for (const r of obj.rects) {
    if (obj.type === 'highlight') {
      const { x, y } = toUser(info, r.x, r.y + r.height)
      page.drawRectangle({
        x,
        y,
        width: r.width,
        height: r.height,
        color: c,
        opacity: obj.opacity,
        blendMode: BlendMode.Multiply
      })
      continue
    }
    const lineY = r.y + r.height * (obj.type === 'underline' ? 0.92 : 0.55)
    page.drawLine({
      start: toUser(info, r.x, lineY),
      end: toUser(info, r.x + r.width, lineY),
      thickness: Math.max(0.75, r.height * 0.07),
      color: c,
      opacity: obj.opacity
    })
  }
}

function drawInk(page: PDFPage, info: PageSize, obj: InkObject): void {
  if (obj.points.length === 0) return
  const blendMode = obj.marker ? BlendMode.Multiply : undefined
  const start = obj.points[0]
  const drawn = obj.points.some((p) => Math.hypot(p.x - start.x, p.y - start.y) >= 0.4)
  if (!drawn) {
    const center = toUser(info, start.x, start.y)
    page.drawCircle({
      x: center.x,
      y: center.y,
      size: obj.width / 2,
      color: color(obj.color),
      opacity: obj.opacity,
      blendMode
    })
    return
  }
  const path = obj.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  // drawSvgPath maps SVG's y-down coordinates relative to (x, y), which is the view box's top-left.
  page.drawSvgPath(path, {
    x: info.viewBox[0],
    y: info.viewBox[3],
    borderColor: color(obj.color),
    borderWidth: obj.width,
    borderOpacity: obj.opacity,
    borderLineCap: LineCapStyle.Round,
    blendMode
  })
}

function addNoteAnnotation(ctx: Context, page: PDFPage, info: PageSize, obj: NoteObject): void {
  const topLeft = toUser(info, obj.x, obj.y)
  const { r, g, b } = hexToRgb(obj.color)
  const annot = ctx.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [topLeft.x, topLeft.y - NOTE_SIZE, topLeft.x + NOTE_SIZE, topLeft.y],
    Contents: PDFHexString.fromText(obj.text),
    T: PDFHexString.fromText('PDFPro'),
    M: PDFString.fromDate(new Date()),
    Name: 'Comment',
    C: [r, g, b],
    F: 4,
    Open: false
  })
  page.node.addAnnot(ctx.doc.context.register(annot))
}

/** Writes overlay objects into the PDF and returns the new file bytes. */
export async function exportEdits(
  bytes: Uint8Array,
  objects: EditObject[],
  pageSizes: PageSize[]
): Promise<Uint8Array> {
  if (objects.length === 0) return bytes
  const doc = await PDFDocument.load(bytes)
  doc.registerFontkit(fontkit)
  const ctx: Context = { doc, fonts: new Map(), images: new Map() }
  const pages = doc.getPages()

  for (const obj of objects) {
    const page = pages[obj.pageIndex]
    const info = pageSizes[obj.pageIndex]
    if (!page || !info) continue
    switch (obj.kind) {
      case 'text':
      case 'comment':
        await drawTextLike(ctx, page, info, obj)
        break
      case 'image':
        await drawImage(ctx, page, info, obj)
        break
      case 'markup':
        drawMarkup(page, info, obj)
        break
      case 'ink':
        drawInk(page, info, obj)
        break
      case 'note':
        addNoteAnnotation(ctx, page, info, obj)
        break
    }
  }
  return doc.save()
}
