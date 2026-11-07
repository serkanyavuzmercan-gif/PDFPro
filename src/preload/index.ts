import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type PdfProApi } from '../shared/ipc'

function subscribe<T extends unknown[]>(channel: string, callback: (...args: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]): void => callback(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: PdfProApi = {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke(IpcChannels.fileOpen),
  openFiles: () => ipcRenderer.invoke(IpcChannels.fileOpenMany),
  readFile: (path) => ipcRenderer.invoke(IpcChannels.fileReadPath, path),
  saveFile: (path, data) => ipcRenderer.invoke(IpcChannels.fileSave, path, data),
  saveFileAs: (data, suggestedName) =>
    ipcRenderer.invoke(IpcChannels.fileSaveAs, data, suggestedName),
  openImage: () => ipcRenderer.invoke(IpcChannels.imageOpen),
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.dirPick),
  writeInDirectory: (dir, fileName, data) =>
    ipcRenderer.invoke(IpcChannels.fileWriteInDir, dir, fileName, data),
  getPrinters: () => ipcRenderer.invoke(IpcChannels.appGetPrinters),
  print: (request) => ipcRenderer.invoke(IpcChannels.appPrint, request),
  getPendingFile: () => ipcRenderer.invoke(IpcChannels.appGetPendingFile),
  setDirty: (dirty) => ipcRenderer.send(IpcChannels.appSetDirty, dirty),
  confirmClose: () => ipcRenderer.send(IpcChannels.appConfirmClose),
  onCloseRequested: (callback) => subscribe(IpcChannels.appCloseRequested, callback),
  onOpenExternalFile: (callback) => subscribe<[string]>(IpcChannels.fileOpenExternal, callback)
}

contextBridge.exposeInMainWorld('api', api)
