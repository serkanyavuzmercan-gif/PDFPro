export const IpcChannels = {
  fileOpen: 'file:open',
  fileReadPath: 'file:read-path',
  fileSave: 'file:save',
  fileSaveAs: 'file:save-as',
  fileOpenExternal: 'file:open-external',
  appPrint: 'app:print',
  appGetPendingFile: 'app:get-pending-file'
} as const

export type FileErrorCode =
  | 'CANCELLED'
  | 'EACCES'
  | 'ENOENT'
  | 'CORRUPT'
  | 'NOT_ALLOWED'
  | 'UNKNOWN'

export type Result<T> = { ok: true; value: T } | { ok: false; code: FileErrorCode; message?: string }

export interface OpenedFile {
  path: string
  name: string
  data: Uint8Array
}

export interface SavedFile {
  path: string
  name: string
}

export type AppLanguage = 'tr' | 'en'

export interface PdfProApi {
  platform: string
  openFile: () => Promise<Result<OpenedFile>>
  readFile: (path: string) => Promise<Result<OpenedFile>>
  saveFile: (path: string, data: Uint8Array) => Promise<Result<SavedFile>>
  saveFileAs: (data: Uint8Array, suggestedName?: string) => Promise<Result<SavedFile>>
  print: () => Promise<Result<void>>
  getPendingFile: () => Promise<string | null>
  onOpenExternalFile: (callback: (path: string) => void) => () => void
}
