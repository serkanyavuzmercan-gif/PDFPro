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
  appConfirmClose: 'app:confirm-close',
  fontsList: 'fonts:list',
  fontsRead: 'fonts:read'
} as const

/** Document fonts read from the OS font folder. The installer does not ship these files. */
export const SYSTEM_FONT_IDS = [
  'arial',
  'times',
  'calibri',
  'georgia',
  'verdana',
  'courier',
  'trebuchet',
  'segoe',
  'consolas',
  'palatino',
  'candara',
  'constantia',
  'corbel'
] as const

export type SystemFontId = (typeof SYSTEM_FONT_IDS)[number]

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
  listSystemFonts: () => Promise<SystemFontId[]>
  readSystemFont: (id: SystemFontId, variant: number) => Promise<Uint8Array | null>
  getPendingFile: () => Promise<string | null>
  setDirty: (dirty: boolean) => void
  confirmClose: () => void
  onCloseRequested: (callback: () => void) => () => void
  onOpenExternalFile: (callback: (path: string) => void) => () => void
}
