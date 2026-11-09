import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SystemFontId } from '../shared/ipc'

/** Regular, bold, italic, bold-italic. Only these names are ever read. */
const SYSTEM_FONT_FILES: Record<SystemFontId, [string, string, string, string]> = {
  arial: ['arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'arialbi.ttf'],
  times: ['times.ttf', 'timesbd.ttf', 'timesi.ttf', 'timesbi.ttf'],
  calibri: ['calibri.ttf', 'calibrib.ttf', 'calibrii.ttf', 'calibriz.ttf'],
  georgia: ['georgia.ttf', 'georgiab.ttf', 'georgiai.ttf', 'georgiaz.ttf'],
  verdana: ['verdana.ttf', 'verdanab.ttf', 'verdanai.ttf', 'verdanaz.ttf'],
  courier: ['cour.ttf', 'courbd.ttf', 'couri.ttf', 'courbi.ttf'],
  trebuchet: ['trebuc.ttf', 'trebucbd.ttf', 'trebucit.ttf', 'trebucbi.ttf'],
  segoe: ['segoeui.ttf', 'segoeuib.ttf', 'segoeuii.ttf', 'segoeuiz.ttf'],
  consolas: ['consola.ttf', 'consolab.ttf', 'consolai.ttf', 'consolaz.ttf'],
  palatino: ['pala.ttf', 'palab.ttf', 'palai.ttf', 'palabi.ttf'],
  candara: ['candara.ttf', 'candarab.ttf', 'candarai.ttf', 'candaraz.ttf'],
  constantia: ['constan.ttf', 'constanb.ttf', 'constani.ttf', 'constanz.ttf'],
  corbel: ['corbel.ttf', 'corbelb.ttf', 'corbeli.ttf', 'corbelz.ttf']
}

function fontsDirectory(): string {
  return join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
}

function variantIndex(variant: unknown): 0 | 1 | 2 | 3 | null {
  const index = Number(variant)
  if (index === 0 || index === 1 || index === 2 || index === 3) return index
  return null
}

/** Families whose four faces are all present. Empty off Windows. */
export async function listSystemFonts(): Promise<SystemFontId[]> {
  if (process.platform !== 'win32') return []
  const dir = fontsDirectory()
  const found: SystemFontId[] = []
  for (const id of Object.keys(SYSTEM_FONT_FILES) as SystemFontId[]) {
    const present = await Promise.all(
      SYSTEM_FONT_FILES[id].map(async (name) => {
        try {
          await access(join(dir, name))
          return true
        } catch {
          return false
        }
      })
    )
    if (present.every(Boolean)) found.push(id)
  }
  return found
}

/** Bytes of one allowlisted face, or null when the id or file is not allowed. */
export async function readSystemFont(id: unknown, variant: unknown): Promise<Uint8Array | null> {
  if (process.platform !== 'win32' || typeof id !== 'string') return null
  const files = SYSTEM_FONT_FILES[id as SystemFontId]
  const index = variantIndex(variant)
  if (!files || index === null) return null
  try {
    return new Uint8Array(await readFile(join(fontsDirectory(), files[index])))
  } catch {
    return null
  }
}
