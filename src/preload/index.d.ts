import type { PdfProApi } from '../shared/ipc'

declare global {
  interface Window {
    api: PdfProApi
  }
}

export {}
