import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc'
import { listSystemFonts, readSystemFont } from '../systemFonts'

export function registerFontHandlers(): void {
  ipcMain.handle(IpcChannels.fontsList, () => listSystemFonts())
  ipcMain.handle(IpcChannels.fontsRead, (_event, id: unknown, variant: unknown) => readSystemFont(id, variant))
}
