import { readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  IpcChannels,
  type FileErrorCode,
  type OpenedFile,
  type OpenedImage,
  type Result,
  type PrintRequest,
  type PrinterInfo,
  type SavedFile
} from '../../shared/ipc'

/**
 * The renderer may only read/write paths the user explicitly chose (dialog,
 * command line, OS "open with"), never arbitrary paths it supplies itself.
 */
const approvedPaths = new Set<string>()
const approvedDirs = new Set<string>()

export function approvePath(path: string): string {
  const normalized = resolve(path)
  approvedPaths.add(normalized.toLowerCase())
  return normalized
}

function approveDirectory(dir: string): string {
  const normalized = resolve(dir)
  approvedDirs.add(normalized.toLowerCase())
  return normalized
}

function isApproved(path: string): boolean {
  return approvedPaths.has(resolve(path).toLowerCase())
}

function toErrorCode(err: unknown): FileErrorCode {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  switch (code) {
    case 'EACCES':
    case 'EPERM':
    case 'EBUSY':
      return 'EACCES'
    case 'ENOENT':
      return 'ENOENT'
    default:
      return 'UNKNOWN'
  }
}

function fail<T>(code: FileErrorCode, err?: unknown): Result<T> {
  return { ok: false, code, message: err instanceof Error ? err.message : undefined }
}

function looksLikePdf(data: Uint8Array): boolean {
  // The %PDF- header may be preceded by junk bytes; the spec tolerates up to 1024.
  const head = Buffer.from(data.subarray(0, 1024)).toString('latin1')
  return head.includes('%PDF-')
}

async function readPdf(path: string): Promise<Result<OpenedFile>> {
  try {
    const data = new Uint8Array(await readFile(path))
    if (!looksLikePdf(data)) return fail('CORRUPT')
    return { ok: true, value: { path, name: basename(path), data } }
  } catch (err) {
    return fail(toErrorCode(err), err)
  }
}

async function writePdf(path: string, data: Uint8Array): Promise<Result<SavedFile>> {
  try {
    await writeFile(path, data)
    return { ok: true, value: { path, name: basename(path) } }
  } catch (err) {
    return fail(toErrorCode(err), err)
  }
}

function imageFormat(data: Uint8Array): 'png' | 'jpg' | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg'
  return null
}

async function showOpen(
  sender: Electron.WebContents,
  options: Electron.OpenDialogOptions
): Promise<string[]> {
  const win = BrowserWindow.fromWebContents(sender)
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  return canceled ? [] : filePaths
}

const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }]

export function registerFileHandlers(): void {
  ipcMain.handle(IpcChannels.fileOpen, async (event): Promise<Result<OpenedFile>> => {
    const [path] = await showOpen(event.sender, { properties: ['openFile'], filters: PDF_FILTER })
    if (!path) return fail('CANCELLED')
    return readPdf(approvePath(path))
  })

  ipcMain.handle(IpcChannels.fileOpenMany, async (event): Promise<Result<OpenedFile[]>> => {
    const paths = await showOpen(event.sender, {
      properties: ['openFile', 'multiSelections'],
      filters: PDF_FILTER
    })
    if (paths.length === 0) return fail('CANCELLED')
    const files: OpenedFile[] = []
    for (const path of paths) {
      const result = await readPdf(approvePath(path))
      if (!result.ok) return { ...result, message: basename(path) }
      files.push(result.value)
    }
    return { ok: true, value: files }
  })

  ipcMain.handle(IpcChannels.imageOpen, async (event): Promise<Result<OpenedImage>> => {
    const [path] = await showOpen(event.sender, {
      properties: ['openFile'],
      filters: [{ name: 'PNG / JPG', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (!path) return fail('CANCELLED')
    try {
      const data = new Uint8Array(await readFile(path))
      const format = imageFormat(data)
      if (!format) return fail('UNSUPPORTED_IMAGE')
      return { ok: true, value: { name: basename(path), data, format } }
    } catch (err) {
      return fail(toErrorCode(err), err)
    }
  })

  ipcMain.handle(IpcChannels.dirPick, async (event): Promise<Result<string>> => {
    const [dir] = await showOpen(event.sender, { properties: ['openDirectory', 'createDirectory'] })
    if (!dir) return fail('CANCELLED')
    return { ok: true, value: approveDirectory(dir) }
  })

  ipcMain.handle(
    IpcChannels.fileWriteInDir,
    async (_event, dir: unknown, fileName: unknown, data: unknown): Promise<Result<SavedFile>> => {
      if (typeof dir !== 'string' || !approvedDirs.has(resolve(dir).toLowerCase())) {
        return fail('NOT_ALLOWED')
      }
      // Only a plain file name inside the chosen folder; no path components.
      if (
        typeof fileName !== 'string' ||
        fileName !== basename(fileName) ||
        !/^[^<>:"/\\|?*]+\.pdf$/i.test(fileName)
      ) {
        return fail('NOT_ALLOWED')
      }
      if (!(data instanceof Uint8Array)) return fail('UNKNOWN')
      return writePdf(approvePath(join(dir, fileName)), data)
    }
  )

  ipcMain.handle(IpcChannels.fileReadPath, async (_event, path: unknown) => {
    if (typeof path !== 'string' || !isApproved(path)) return fail<OpenedFile>('NOT_ALLOWED')
    return readPdf(resolve(path))
  })

  ipcMain.handle(IpcChannels.fileSave, async (_event, path: unknown, data: unknown) => {
    if (typeof path !== 'string' || !isApproved(path)) return fail<SavedFile>('NOT_ALLOWED')
    if (!(data instanceof Uint8Array)) return fail<SavedFile>('UNKNOWN')
    return writePdf(resolve(path), data)
  })

  ipcMain.handle(
    IpcChannels.fileSaveAs,
    async (event, data: unknown, suggestedName: unknown): Promise<Result<SavedFile>> => {
      if (!(data instanceof Uint8Array)) return fail('UNKNOWN')
      const win = BrowserWindow.fromWebContents(event.sender)
      const options: Electron.SaveDialogOptions = {
        defaultPath: typeof suggestedName === 'string' ? suggestedName : 'document.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (canceled || !filePath) return fail('CANCELLED')
      return writePdf(approvePath(filePath), data)
    }
  )

  ipcMain.handle(IpcChannels.appGetPrinters, async (event): Promise<PrinterInfo[]> => {
    const printers = await event.sender.getPrintersAsync()
    return printers.map((printer) => ({ name: printer.name, displayName: printer.displayName || printer.name }))
  })

  ipcMain.handle(IpcChannels.appPrint, async (event, request: unknown): Promise<Result<void>> => {
    const copies = Math.min(99, Math.max(1, Math.round(Number((request as PrintRequest | null)?.copies) || 1)))
    const requested = (request as PrintRequest | null)?.deviceName
    const printers = await event.sender.getPrintersAsync()
    const deviceName =
      typeof requested === 'string' && printers.some((printer) => printer.name === requested)
        ? requested
        : undefined
    return new Promise((done) => {
      // silent skips the Windows dialog, which cannot show a preview for Electron apps.
      event.sender.print(
        {
          silent: true,
          printBackground: true,
          deviceName,
          copies,
          margins: { marginType: 'none' },
          usePrinterDefaultPageSize: true
        },
        (success, reason) => {
          if (success || reason === 'cancelled' || reason === 'canceled') {
            done(success ? { ok: true, value: undefined } : fail('CANCELLED'))
          } else {
            done(fail('UNKNOWN', new Error(reason)))
          }
        }
      )
    })
  })
}
