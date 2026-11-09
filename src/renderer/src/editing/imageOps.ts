import { openDialog } from '../components/dialogs/dialogStore'
import { reportFailure } from '../services/fileService'
import { useAppStore } from '../store/useAppStore'
import { commitDraft, uprightRotation } from './draft'
import { addObject } from './history'
import { newId, type ImageObject } from './types'

const store = useAppStore.getState

/** CSS pixels to PDF points. */
const PX_TO_PT = 0.75

function toDataUrl(bytes: Uint8Array, format: 'png' | 'jpg'): Promise<string> {
  const blob = new Blob([bytes.slice()], { type: format === 'png' ? 'image/png' : 'image/jpeg' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function naturalSize(src: string): Promise<{ width: number; height: number }> {
  const img = new Image()
  img.src = src
  await img.decode()
  return { width: img.naturalWidth, height: img.naturalHeight }
}

/** Places an image centered on the current page, scaled to fit within `maxWidth` points. */
function placeImage(
  image: Pick<ImageObject, 'bytes' | 'src' | 'format' | 'signature'>,
  size: { width: number; height: number },
  maxWidth: number
): void {
  const doc = store().document
  if (!doc) return
  const pageIndex = store().currentPage - 1
  const page = doc.pageSizes[pageIndex]
  const rotation = uprightRotation(pageIndex)
  const sideways = rotation % 180 !== 0
  const limitW = Math.min(maxWidth, (sideways ? page.baseHeight : page.baseWidth) * 0.8)
  const limitH = (sideways ? page.baseWidth : page.baseHeight) * 0.8
  const scale = Math.min(1, limitW / size.width, limitH / size.height)
  const width = size.width * scale
  const height = size.height * scale
  addObject({
    id: newId(),
    kind: 'image',
    pageIndex,
    x: page.baseWidth / 2 - width / 2,
    y: page.baseHeight / 2 - height / 2,
    width,
    height,
    rotation,
    ...image
  })
  if (store().activeTool !== 'select' && store().activeTool !== 'editObject') store().setActiveTool('editObject')
}

export async function insertImage(signature = false): Promise<void> {
  commitDraft()
  if (!store().document) return
  const result = await window.api.openImage()
  if (!result.ok) return reportFailure(result)
  try {
    const { data, format } = result.value
    const src = await toDataUrl(data, format)
    const px = await naturalSize(src)
    placeImage(
      { bytes: data, src, format, signature },
      { width: px.width * PX_TO_PT, height: px.height * PX_TO_PT },
      signature ? 180 : 400
    )
  } catch (err) {
    console.error(err)
    store().showNotice({ kind: 'error', key: 'errors.UNSUPPORTED_IMAGE' })
  }
}

export async function drawSignature(): Promise<void> {
  commitDraft()
  if (!store().document) return
  const signature = await openDialog({ type: 'signature' })
  if (!signature) return
  placeImage(
    { bytes: signature.bytes, src: signature.src, format: signature.format, signature: true },
    { width: signature.width * PX_TO_PT, height: signature.height * PX_TO_PT },
    180
  )
}
