export const IpcChannels = {
  fileOpen: 'file:open',
  fileOpenMany: 'file:open-many',
  fileReadPath: 'file:read-path',
  fileSave: 'file:save',
  fileSaveAs: 'file:save-as',
  fileOpenExternal: 'file:open-external',
  imageOpen: 'image:open',
  dirPick: 'dir:pick',
  fileWriteInDir: 'file:write-in-dir',
  appPrint: 'app:print',
  appGetPrinters: 'app:get-printers',
  appGetPendingFile: 'app:get-pending-file',
  appSetDirty: 'app:set-dirty',
  appCloseRequested: 'app:close-requested',
  appConfirmClose: 'app:confirm-close'
} as const

export type FileErrorCode =
  | 'CANCELLED'
  | 'EACCES'
  | 'ENOENT'
  | 'CORRUPT'
  | 'NOT_ALLOWED'
  | 'UNSUPPORTED_IMAGE'
  | 'UNKNOWN'

export type Result<T> = { ok: true; value: T } | { ok: false; code: FileErrorCode; message?: string }

export interface OpenedFile {
  path: string
  name: string
  data: Uint8Array
}

export interface OpenedImage {
  name: string
  data: Uint8Array
  format: 'png' | 'jpg'
}

export interface SavedFile {
  path: string
  name: string
}

export type AppLanguage = 'tr' | 'en'

export interface PrinterInfo {
  name: string
  displayName: string
}

export interface PrintRequest {
  deviceName?: string
  copies: number
}

export interface PdfProApi {
  platform: string
  openFile: () => Promise<Result<OpenedFile>>
  openFiles: () => Promise<Result<OpenedFile[]>>
  readFile: (path: string) => Promise<Result<OpenedFile>>
  saveFile: (path: string, data: Uint8Array) => Promise<Result<SavedFile>>
  saveFileAs: (data: Uint8Array, suggestedName?: string) => Promise<Result<SavedFile>>
  openImage: () => Promise<Result<OpenedImage>>
  pickDirectory: () => Promise<Result<string>>
  writeInDirectory: (dir: string, fileName: string, data: Uint8Array) => Promise<Result<SavedFile>>
  getPrinters: () => Promise<PrinterInfo[]>
  print: (request: PrintRequest) => Promise<Result<void>>
  getPendingFile: () => Promise<string | null>
  setDirty: (dirty: boolean) => void
  confirmClose: () => void
  onCloseRequested: (callback: () => void) => () => void
  onOpenExternalFile: (callback: (path: string) => void) => () => void
}
