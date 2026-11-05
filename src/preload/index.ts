import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type PdfProApi } from '../shared/ipc'

const api: PdfProApi = {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke(IpcChannels.fileOpen),
  readFile: (path) => ipcRenderer.invoke(IpcChannels.fileReadPath, path),
  saveFile: (path, data) => ipcRenderer.invoke(IpcChannels.fileSave, path, data),
  saveFileAs: (data, suggestedName) =>
    ipcRenderer.invoke(IpcChannels.fileSaveAs, data, suggestedName),
  print: () => ipcRenderer.invoke(IpcChannels.appPrint),
  getPendingFile: () => ipcRenderer.invoke(IpcChannels.appGetPendingFile),
  onOpenExternalFile: (callback) => {
    const listener = (_event: IpcRendererEvent, path: string): void => callback(path)
    ipcRenderer.on(IpcChannels.fileOpenExternal, listener)
    return () => ipcRenderer.removeListener(IpcChannels.fileOpenExternal, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
