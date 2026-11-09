import { useEffect, useState } from 'react'
import sansRegular from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'
import sansBold from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url'
import sansItalic from 'dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf?url'
import sansBoldItalic from 'dejavu-fonts-ttf/ttf/DejaVuSans-BoldOblique.ttf?url'
import serifRegular from 'dejavu-fonts-ttf/ttf/DejaVuSerif.ttf?url'
import serifBold from 'dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf?url'
import serifItalic from 'dejavu-fonts-ttf/ttf/DejaVuSerif-Italic.ttf?url'
import serifBoldItalic from 'dejavu-fonts-ttf/ttf/DejaVuSerif-BoldItalic.ttf?url'
import monoRegular from 'dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf?url'
import monoBold from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-Bold.ttf?url'
import monoItalic from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-Oblique.ttf?url'
import monoBoldItalic from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-BoldOblique.ttf?url'
import { SYSTEM_FONT_IDS, type SystemFontId } from '../../../shared/ipc'
import { LINE_HEIGHT, type FontFamily, type TextStyle } from './types'

/** [regular, bold, italic, bold italic] */
const BUNDLED_FILES: Record<'sans' | 'serif' | 'mono', [string, string, string, string]> = {
  sans: [sansRegular, sansBold, sansItalic, sansBoldItalic],
  serif: [serifRegular, serifBold, serifItalic, serifBoldItalic],
  mono: [monoRegular, monoBold, monoItalic, monoBoldItalic]
}

const BUNDLED_LABELS: Record<'sans' | 'serif' | 'mono', string> = {
  sans: 'DejaVu Sans',
  serif: 'DejaVu Serif',
  mono: 'DejaVu Sans Mono'
}

const SYSTEM_LABELS: Record<SystemFontId, string> = {
  arial: 'Arial',
  times: 'Times New Roman',
  calibri: 'Calibri',
  georgia: 'Georgia',
  verdana: 'Verdana',
  courier: 'Courier New',
  trebuchet: 'Trebuchet MS',
  segoe: 'Segoe UI',
  consolas: 'Consolas',
  palatino: 'Palatino Linotype',
  candara: 'Candara',
  constantia: 'Constantia',
  corbel: 'Corbel'
}

/** Used when a chosen system font cannot be read, so save still embeds a face. */
const FALLBACK_FAMILY: Record<SystemFontId, 'sans' | 'serif' | 'mono'> = {
  arial: 'sans',
  calibri: 'sans',
  verdana: 'sans',
  trebuchet: 'sans',
  segoe: 'sans',
  candara: 'sans',
  corbel: 'sans',
  times: 'serif',
  georgia: 'serif',
  palatino: 'serif',
  constantia: 'serif',
  courier: 'mono',
  consolas: 'mono'
}

export function fontLabel(font: FontFamily): string {
  if (font === 'sans' || font === 'serif' || font === 'mono') return BUNDLED_LABELS[font]
  return SYSTEM_LABELS[font]
}

let installedSystemFonts: SystemFontId[] = []

/** Bundled faces first, then the system faces that were found on this computer. */
export function fontChoices(): { id: FontFamily; label: string }[] {
  const installed = new Set(installedSystemFonts)
  return [
    ...(Object.keys(BUNDLED_LABELS) as ('sans' | 'serif' | 'mono')[]).map((id) => ({
      id,
      label: BUNDLED_LABELS[id]
    })),
    ...SYSTEM_FONT_IDS.filter((id) => installed.has(id)).map((id) => ({ id, label: SYSTEM_LABELS[id] }))
  ]
}

/** The same files are used on screen and embedded on save, so wrapping matches. */
export function cssFontFamily(font: FontFamily): string {
  return `"PDFPro ${font}"`
}

function variantOf(style: Pick<TextStyle, 'bold' | 'italic'>): 0 | 1 | 2 | 3 {
  return ((style.bold ? 1 : 0) + (style.italic ? 2 : 0)) as 0 | 1 | 2 | 3
}

function isBundled(font: FontFamily): font is 'sans' | 'serif' | 'mono' {
  return font === 'sans' || font === 'serif' || font === 'mono'
}

export function cssFont(style: TextStyle, size: number): string {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${cssFontFamily(style.font)}`
}

let fontsVersion = 0
const listeners = new Set<() => void>()

function notifyFonts(): void {
  fontsVersion += 1
  listeners.forEach((listener) => listener())
}

async function loadFace(family: FontFamily, bytes: ArrayBuffer, style: Pick<TextStyle, 'bold' | 'italic'>): Promise<void> {
  const face = new FontFace(`PDFPro ${family}`, bytes, {
    weight: style.bold ? '700' : '400',
    style: style.italic ? 'italic' : 'normal'
  })
  document.fonts.add(face)
  await face.load()
}

export function registerFonts(): void {
  const faces: Promise<unknown>[] = []
  for (const font of Object.keys(BUNDLED_FILES) as ('sans' | 'serif' | 'mono')[]) {
    for (const bold of [false, true]) {
      for (const italic of [false, true]) {
        const style = { font, bold, italic }
        faces.push(getFontBytes(style).then((bytes) => loadFace(font, bytes, style)))
      }
    }
  }
  void Promise.allSettled(faces).then(() => notifyFonts())

  void window.api
    .listSystemFonts()
    .then(async (ids) => {
      const known = new Set<string>(SYSTEM_FONT_IDS)
      installedSystemFonts = ids.filter((id): id is SystemFontId => known.has(id))
      const loads: Promise<unknown>[] = []
      for (const font of installedSystemFonts) {
        for (const bold of [false, true]) {
          for (const italic of [false, true]) {
            const style = { font, bold, italic }
            loads.push(getFontBytes(style).then((bytes) => loadFace(font, bytes, style)))
          }
        }
      }
      await Promise.allSettled(loads)
      notifyFonts()
    })
    .catch(() => undefined)
}

/** Re-renders once the embedded fonts finish loading, so text is re-measured. */
export function useFontsVersion(): number {
  const [version, setVersion] = useState(fontsVersion)
  useEffect(() => {
    const listener = (): void => setVersion(fontsVersion)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return version
}

const fontBytesCache = new Map<string, Promise<ArrayBuffer>>()

function cacheKey(font: FontFamily, style: Pick<TextStyle, 'bold' | 'italic'>): string {
  return `${font}:${variantOf(style)}`
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

export function getFontBytes(style: Pick<TextStyle, 'font' | 'bold' | 'italic'>): Promise<ArrayBuffer> {
  const key = cacheKey(style.font, style)
  const cached = fontBytesCache.get(key)
  if (cached) return cached
  let bytes: Promise<ArrayBuffer>
  if (isBundled(style.font)) {
    const font = style.font
    bytes = fetch(BUNDLED_FILES[font][variantOf(style)]).then((response) => {
      if (!response.ok) throw new Error(`Font load failed: ${font}`)
      return response.arrayBuffer()
    })
  } else {
    const font = style.font
    bytes = window.api
      .readSystemFont(font, variantOf(style))
      .then((data) => {
        if (data && data.byteLength > 0) return toArrayBuffer(data)
        return getFontBytes({ ...style, font: FALLBACK_FAMILY[font] })
      })
      .catch(() => getFontBytes({ ...style, font: FALLBACK_FAMILY[font] }))
  }
  fontBytesCache.set(key, bytes)
  return bytes
}

let measureCtx: CanvasRenderingContext2D | null = null

export function measureText(text: string, style: TextStyle): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * style.size * 0.55
  measureCtx.font = cssFont(style, style.size)
  return measureCtx.measureText(text).width
}

const measure = measureText

/** Greedy word wrap shared by the on-screen view and the PDF export. */
export function layoutLines(text: string, style: TextStyle, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\t/g, '    ').split('\n')) {
    if (paragraph === '') {
      lines.push('')
      continue
    }
    let line = ''
    // A single word wider than the box is broken by characters.
    const breakLongLine = (): void => {
      while (measure(line.trimEnd(), style) > width && line.trim().length > 1) {
        let cut = line.length - 1
        while (cut > 1 && measure(line.slice(0, cut), style) > width) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    for (const token of paragraph.split(/(\s+)/).filter((t) => t !== '')) {
      const candidate = line + token
      if (line === '' || measure(candidate.trimEnd(), style) <= width) {
        line = candidate
      } else {
        lines.push(line.trimEnd())
        line = /^\s+$/.test(token) ? '' : token
      }
      breakLongLine()
    }
    lines.push(line.trimEnd())
  }
  return lines
}

export function lineHeight(style: TextStyle): number {
  return style.size * LINE_HEIGHT
}

export function textBlockHeight(text: string, style: TextStyle, width: number): number {
  return Math.max(1, layoutLines(text, style, width).length) * lineHeight(style)
}
