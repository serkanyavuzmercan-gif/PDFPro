import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  IpcChannels,
  type FileErrorCode,
  type OpenedFile,
  type Result,
  type SavedFile
} from '../../shared/ipc'

/**
 * The renderer may only read/write paths the user explicitly chose (dialog,
 * command line, OS "open with"), never arbitrary paths it supplies itself.
 */
const approvedPaths = new Set<string>()

export function approvePath(path: string): string {
  const normalized = resolve(path)
  approvedPaths.add(normalized.toLowerCase())
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

export function registerFileHandlers(): void {
  ipcMain.handle(IpcChannels.fileOpen, async (event): Promise<Result<OpenedFile>> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (canceled || filePaths.length === 0) return fail('CANCELLED')
    return readPdf(approvePath(filePaths[0]))
  })

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

  ipcMain.handle(IpcChannels.appPrint, async (event): Promise<Result<void>> => {
    return new Promise((done) => {
      event.sender.print({ printBackground: true }, (success, reason) => {
        if (success) done({ ok: true, value: undefined })
        else done(reason === 'cancelled' ? fail('CANCELLED') : fail('UNKNOWN'))
      })
    })
  })
}
