// Copies pdf.js runtime assets (CMaps, standard fonts, wasm decoders, ICC profiles)
// into the renderer's public folder so PDF rendering works fully offline.
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pdfjsDir = resolve(root, 'node_modules/pdfjs-dist')
const target = resolve(root, 'src/renderer/public/pdfjs')
const folders = ['cmaps', 'standard_fonts', 'wasm', 'iccs']

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
for (const folder of folders) {
  await cp(resolve(pdfjsDir, folder), resolve(target, folder), { recursive: true })
}
console.log(`pdf.js assets copied to ${target}`)
