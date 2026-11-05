import {
  ArrowDownUp,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Combine,
  Eraser,
  File,
  FileImage,
  FileOutput,
  FilePen,
  Files,
  FileX,
  FolderOpen,
  Hand,
  Highlighter,
  ImagePlus,
  Maximize,
  MessageSquare,
  MousePointer2,
  MoveHorizontal,
  PanelLeft,
  PenTool,
  Printer,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  SaveAll,
  Scan,
  Split,
  SquareDashedMousePointer,
  StickyNote,
  Strikethrough,
  TextCursorInput,
  Trash,
  Type,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon
} from 'lucide-react'
import { closeDocument, openFromDialog, print, save, saveAs } from '../services/fileService'
import { useAppStore, type AppState } from '../store/useAppStore'

export interface ActionDef {
  icon: LucideIcon
  labelKey: string
  /** Display + matching format, e.g. "Ctrl+Shift+S". "Ctrl" also matches Cmd on macOS. */
  shortcut?: string
  /** Planned for a later phase: rendered disabled with a "coming soon" hint. */
  soon?: boolean
  run?: () => void
  enabled?: (s: AppState) => boolean
  active?: (s: AppState) => boolean
}

const hasDoc = (s: AppState): boolean => s.document !== null
const store = useAppStore.getState

export const actions = {
  open: { icon: FolderOpen, labelKey: 'tools.open', shortcut: 'Ctrl+O', run: () => void openFromDialog() },
  save: { icon: Save, labelKey: 'tools.save', shortcut: 'Ctrl+S', enabled: hasDoc, run: () => void save() },
  saveAs: { icon: SaveAll, labelKey: 'tools.saveAs', shortcut: 'Ctrl+Shift+S', enabled: hasDoc, run: () => void saveAs() },
  print: { icon: Printer, labelKey: 'tools.print', shortcut: 'Ctrl+P', enabled: hasDoc, run: () => void print() },
  close: { icon: FileX, labelKey: 'tools.close', shortcut: 'Ctrl+W', enabled: hasDoc, run: closeDocument },
  undo: { icon: Undo2, labelKey: 'tools.undo', shortcut: 'Ctrl+Z', soon: true },
  redo: { icon: Redo2, labelKey: 'tools.redo', shortcut: 'Ctrl+Y', soon: true },

  hand: {
    icon: Hand,
    labelKey: 'tools.hand',
    shortcut: 'H',
    run: () => store().setActiveTool('hand'),
    active: (s) => s.activeTool === 'hand'
  },
  select: {
    icon: MousePointer2,
    labelKey: 'tools.select',
    shortcut: 'V',
    run: () => store().setActiveTool('select'),
    active: (s) => s.activeTool === 'select'
  },

  zoomIn: { icon: ZoomIn, labelKey: 'tools.zoomIn', shortcut: 'Ctrl+=', run: () => store().zoomIn() },
  zoomOut: { icon: ZoomOut, labelKey: 'tools.zoomOut', shortcut: 'Ctrl+-', run: () => store().zoomOut() },
  actualSize: { icon: Scan, labelKey: 'tools.actualSize', shortcut: 'Ctrl+0', run: () => store().setZoom(1) },
  fitPage: {
    icon: Maximize,
    labelKey: 'tools.fitPage',
    shortcut: 'Ctrl+1',
    run: () => store().setZoomMode('fitPage'),
    active: (s) => s.zoomMode === 'fitPage'
  },
  fitWidth: {
    icon: MoveHorizontal,
    labelKey: 'tools.fitWidth',
    shortcut: 'Ctrl+2',
    run: () => store().setZoomMode('fitWidth'),
    active: (s) => s.zoomMode === 'fitWidth'
  },

  firstPage: { icon: ChevronFirst, labelKey: 'tools.firstPage', shortcut: 'Home', enabled: hasDoc, run: () => store().goToPage(1) },
  prevPage: {
    icon: ChevronLeft,
    labelKey: 'tools.prevPage',
    shortcut: 'PageUp',
    enabled: hasDoc,
    run: () => store().goToPage(store().currentPage - 1)
  },
  nextPage: {
    icon: ChevronRight,
    labelKey: 'tools.nextPage',
    shortcut: 'PageDown',
    enabled: hasDoc,
    run: () => store().goToPage(store().currentPage + 1)
  },
  lastPage: {
    icon: ChevronLast,
    labelKey: 'tools.lastPage',
    shortcut: 'End',
    enabled: hasDoc,
    run: () => store().goToPage(store().document?.pageSizes.length ?? 1)
  },
  singlePage: {
    icon: File,
    labelKey: 'tools.singlePage',
    run: () => store().setScrollMode('single'),
    active: (s) => s.scrollMode === 'single'
  },
  continuous: {
    icon: Files,
    labelKey: 'tools.continuous',
    run: () => store().setScrollMode('continuous'),
    active: (s) => s.scrollMode === 'continuous'
  },
  sidebar: {
    icon: PanelLeft,
    labelKey: 'tools.sidebar',
    shortcut: 'F4',
    run: () => store().toggleSidebar(),
    active: (s) => s.sidebarOpen
  },

  addText: { icon: Type, labelKey: 'tools.addText', shortcut: 'T', soon: true },
  editText: { icon: TextCursorInput, labelKey: 'tools.editText', shortcut: 'E', soon: true },
  insertImage: { icon: ImagePlus, labelKey: 'tools.insertImage', shortcut: 'Ctrl+Shift+I', soon: true },
  editObject: { icon: SquareDashedMousePointer, labelKey: 'tools.editObject', shortcut: 'O', soon: true },

  highlight: { icon: Highlighter, labelKey: 'tools.highlight', shortcut: 'Alt+H', soon: true },
  underline: { icon: Underline, labelKey: 'tools.underline', shortcut: 'Alt+U', soon: true },
  strikeout: { icon: Strikethrough, labelKey: 'tools.strikeout', shortcut: 'Alt+K', soon: true },
  pen: { icon: PenTool, labelKey: 'tools.pen', shortcut: 'P', soon: true },
  eraser: { icon: Eraser, labelKey: 'tools.eraser', shortcut: 'Shift+E', soon: true },
  stickyNote: { icon: StickyNote, labelKey: 'tools.stickyNote', shortcut: 'N', soon: true },
  commentBox: { icon: MessageSquare, labelKey: 'tools.commentBox', shortcut: 'Alt+C', soon: true },

  rotateLeft: { icon: RotateCcw, labelKey: 'tools.rotateLeft', shortcut: 'Ctrl+Shift+-', soon: true },
  rotateRight: { icon: RotateCw, labelKey: 'tools.rotateRight', shortcut: 'Ctrl+Shift+=', soon: true },
  deletePage: { icon: Trash, labelKey: 'tools.deletePage', shortcut: 'Ctrl+Shift+D', soon: true },
  extractPages: { icon: FileOutput, labelKey: 'tools.extractPages', shortcut: 'Ctrl+Shift+E', soon: true },
  reorderPages: { icon: ArrowDownUp, labelKey: 'tools.reorderPages', soon: true },
  mergePdfs: { icon: Combine, labelKey: 'tools.mergePdfs', shortcut: 'Ctrl+Shift+M', soon: true },
  splitPdf: { icon: Split, labelKey: 'tools.splitPdf', soon: true },

  drawSignature: { icon: FilePen, labelKey: 'tools.drawSignature', shortcut: 'Ctrl+Shift+G', soon: true },
  imageSignature: { icon: FileImage, labelKey: 'tools.imageSignature', soon: true }
} satisfies Record<string, ActionDef>

export type ActionId = keyof typeof actions

export function getAction(id: ActionId): ActionDef {
  return actions[id]
}

export function isActionEnabled(id: ActionId, state: AppState): boolean {
  const action = getAction(id)
  if (action.soon || !action.run) return false
  return action.enabled ? action.enabled(state) : true
}

export function runAction(id: ActionId): void {
  if (isActionEnabled(id, store())) getAction(id).run?.()
}
