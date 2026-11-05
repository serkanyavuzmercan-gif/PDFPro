import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export type RibbonTabId = 'file' | 'home' | 'edit' | 'view' | 'comment' | 'pages' | 'protect'
export type ToolId = 'select' | 'hand'
export type ZoomMode = 'custom' | 'fitPage' | 'fitWidth'
export type ScrollMode = 'continuous' | 'single'
export type SidebarPanel = 'thumbnails' | 'bookmarks'

export interface PageSize {
  width: number
  height: number
}

export interface OpenDocument {
  path: string | null
  name: string
  /** Original file bytes; pdf.js receives a copy because it detaches its input. */
  bytes: Uint8Array
  pdf: PDFDocumentProxy
  pageSizes: PageSize[]
}

export type Notice = { kind: 'error' | 'info'; key: string; params?: Record<string, string> }

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export interface AppState {
  activeTab: RibbonTabId
  activeTool: ToolId
  zoom: number
  zoomMode: ZoomMode
  scrollMode: ScrollMode
  sidebarOpen: boolean
  sidebarPanel: SidebarPanel
  document: OpenDocument | null
  loading: boolean
  currentPage: number
  /** Incremented on explicit navigation so the viewer scrolls even to the same page. */
  navRequest: { page: number; nonce: number }
  notice: Notice | null

  setActiveTab: (tab: RibbonTabId) => void
  setActiveTool: (tool: ToolId) => void
  setZoom: (zoom: number) => void
  /** Used by the viewer to apply fit-mode zoom without leaving that mode. */
  applyFitZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setZoomMode: (mode: ZoomMode) => void
  setScrollMode: (mode: ScrollMode) => void
  toggleSidebar: () => void
  setSidebarPanel: (panel: SidebarPanel) => void
  setLoading: (loading: boolean) => void
  setDocument: (doc: OpenDocument | null) => void
  updateDocument: (patch: Partial<Pick<OpenDocument, 'path' | 'name' | 'bytes'>>) => void
  setCurrentPage: (page: number) => void
  goToPage: (page: number) => void
  showNotice: (notice: Notice | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'home',
  activeTool: 'select',
  zoom: 1,
  zoomMode: 'fitWidth',
  scrollMode: 'continuous',
  sidebarOpen: true,
  sidebarPanel: 'thumbnails',
  document: null,
  loading: false,
  currentPage: 1,
  navRequest: { page: 1, nonce: 0 },
  notice: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom), zoomMode: 'custom' }),
  applyFitZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => {
    const { zoom } = get()
    const next = ZOOM_STEPS.find((s) => s > zoom + 0.001) ?? MAX_ZOOM
    set({ zoom: next, zoomMode: 'custom' })
  },
  zoomOut: () => {
    const { zoom } = get()
    const next = [...ZOOM_STEPS].reverse().find((s) => s < zoom - 0.001) ?? MIN_ZOOM
    set({ zoom: next, zoomMode: 'custom' })
  },
  setZoomMode: (zoomMode) => set(zoomMode === 'custom' ? { zoomMode, zoom: 1 } : { zoomMode }),
  setScrollMode: (scrollMode) => set({ scrollMode }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarPanel: (sidebarPanel) => set({ sidebarPanel, sidebarOpen: true }),
  setLoading: (loading) => set({ loading }),
  setDocument: (document) => {
    const previous = get().document
    if (previous && previous.pdf !== document?.pdf) void previous.pdf.loadingTask.destroy()
    set({ document, currentPage: 1, navRequest: { page: 1, nonce: get().navRequest.nonce + 1 } })
  },
  updateDocument: (patch) => {
    const doc = get().document
    if (doc) set({ document: { ...doc, ...patch } })
  },
  setCurrentPage: (currentPage) => set({ currentPage }),
  goToPage: (page) => {
    const count = get().document?.pageSizes.length ?? 0
    if (count === 0) return
    const target = Math.min(count, Math.max(1, Math.round(page)))
    set({ currentPage: target, navRequest: { page: target, nonce: get().navRequest.nonce + 1 } })
  },
  showNotice: (notice) => set({ notice })
}))
