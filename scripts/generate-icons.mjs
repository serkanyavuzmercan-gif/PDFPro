// Generates app/installer icons and the in-app logo from resources/logo.jpg.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'resources/logo.jpg')
const buildDir = resolve(root, 'build')
const rendererAssets = resolve(root, 'src/renderer/src/assets')
const SIZE = 1024
const BACKGROUND_THRESHOLD = 48

/** Bounding box of the non-black badge, so the JPG's black background can be dropped. */
async function findBadgeBounds() {
  const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true })
  let minX = info.width
  let minY = info.height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      if (Math.max(data[i], data[i + 1], data[i + 2]) > BACKGROUND_THRESHOLD) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

async function buildMasterIcon() {
  const bounds = await findBadgeBounds()
  const radius = Math.round(SIZE * 0.18)
  const mask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  )
  return sharp(source)
    .extract(bounds)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function main() {
  await mkdir(buildDir, { recursive: true })
  await mkdir(rendererAssets, { recursive: true })

  const master = await buildMasterIcon()
  await writeFile(resolve(buildDir, 'icon.png'), master)

  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoPngs = await Promise.all(
    icoSizes.map((s) => sharp(master).resize(s, s).png().toBuffer())
  )
  await writeFile(resolve(buildDir, 'icon.ico'), await pngToIco(icoPngs))

  await sharp(master).resize(256, 256).png().toFile(resolve(rendererAssets, 'logo.png'))

  console.log('Icons generated: build/icon.png, build/icon.ico, src/renderer/src/assets/logo.png')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
