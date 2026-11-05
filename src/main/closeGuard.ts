import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc'

const dirtyWindows = new WeakSet<BrowserWindow>()
const allowedToClose = new WeakSet<BrowserWindow>()

/**
 * Lets the renderer ask about unsaved changes before the window closes. Only
 * windows that reported unsaved changes are held open, so a crashed or hung
 * renderer without edits never blocks closing.
 */
export function registerCloseGuardHandlers(): void {
  ipcMain.on(IpcChannels.appSetDirty, (event, dirty: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (dirty === true) dirtyWindows.add(win)
    else dirtyWindows.delete(win)
  })

  ipcMain.on(IpcChannels.appConfirmClose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    allowedToClose.add(win)
    win.close()
  })
}

export function attachCloseGuard(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (!dirtyWindows.has(win) || allowedToClose.has(win) || win.webContents.isCrashed()) return
    event.preventDefault()
    win.webContents.send(IpcChannels.appCloseRequested)
  })
}
