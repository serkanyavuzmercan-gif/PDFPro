import { app, BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc'
import { approvePath, registerFileHandlers } from './ipc/fileHandlers'
import { setupApplicationMenu } from './menu'
import { handleAppScheme, registerAppScheme } from './protocol'
import { createMainWindow } from './window'

let mainWindow: BrowserWindow | null = null
/** A PDF passed on launch, before the renderer is ready to receive it. */
let pendingFile: string | null = null

function findPdfArg(argv: readonly string[]): string | null {
  const arg = argv.slice(1).find((a) => !a.startsWith('-') && a.toLowerCase().endsWith('.pdf'))
  return arg ?? null
}

function focusMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function openExternalFile(path: string): void {
  const approved = approvePath(path)
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(IpcChannels.fileOpenExternal, approved)
  } else {
    pendingFile = approved
  }
}

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.setAppUserModelId('com.pdfpro.app')
  registerAppScheme()

  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    const file = findPdfArg(argv)
    if (file) openExternalFile(file)
  })

  // macOS delivers "Open With" / dock drops through this event, possibly before ready.
  app.on('open-file', (event, path) => {
    event.preventDefault()
    openExternalFile(path)
    focusMainWindow()
  })

  const launchFile = findPdfArg(process.argv)
  if (launchFile) pendingFile = approvePath(launchFile)

  app.whenReady().then(() => {
    setupApplicationMenu()
    handleAppScheme()
    registerFileHandlers()
    ipcMain.handle(IpcChannels.appGetPendingFile, () => {
      const file = pendingFile
      pendingFile = null
      return file
    })

    mainWindow = createMainWindow()
    mainWindow.on('closed', () => {
      mainWindow = null
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
