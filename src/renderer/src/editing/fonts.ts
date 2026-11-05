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
import { LINE_HEIGHT, type FontFamily, type TextStyle } from './types'

/** [regular, bold, italic, bold italic] */
const FONT_FILES: Record<FontFamily, [string, string, string, string]> = {
  sans: [sansRegular, sansBold, sansItalic, sansBoldItalic],
  serif: [serifRegular, serifBold, serifItalic, serifBoldItalic],
  mono: [monoRegular, monoBold, monoItalic, monoBoldItalic]
}

/** The same TTF files are used on screen and embedded on save, so wrapping matches. */
export function cssFontFamily(font: FontFamily): string {
  return `"PDFPro ${font}"`
}

function fontUrl(style: Pick<TextStyle, 'font' | 'bold' | 'italic'>): string {
  const index = (style.bold ? 1 : 0) + (style.italic ? 2 : 0)
  return FONT_FILES[style.font][index]
}

export function cssFont(style: TextStyle, size: number): string {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${cssFontFamily(style.font)}`
}

let fontsVersion = 0
const listeners = new Set<() => void>()

export function registerFonts(): void {
  const faces: Promise<FontFace>[] = []
  for (const font of Object.keys(FONT_FILES) as FontFamily[]) {
    for (const bold of [false, true]) {
      for (const italic of [false, true]) {
        const face = new FontFace(`PDFPro ${font}`, `url(${fontUrl({ font, bold, italic })})`, {
          weight: bold ? '700' : '400',
          style: italic ? 'italic' : 'normal'
        })
        document.fonts.add(face)
        faces.push(face.load())
      }
    }
  }
  void Promise.allSettled(faces).then(() => {
    fontsVersion += 1
    listeners.forEach((l) => l())
  })
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

export function getFontBytes(style: Pick<TextStyle, 'font' | 'bold' | 'italic'>): Promise<ArrayBuffer> {
  const url = fontUrl(style)
  let bytes = fontBytesCache.get(url)
  if (!bytes) {
    bytes = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Font load failed: ${url}`)
      return r.arrayBuffer()
    })
    fontBytesCache.set(url, bytes)
  }
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
