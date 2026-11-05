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
import { commitDraft } from '../editing/draft'
import { closeNote } from '../editing/notes'
import { removeObjects, redo, undo } from '../editing/history'
import { drawSignature, insertImage } from '../editing/imageOps'
import {
  deletePages,
  extractPages,
  mergePdfs,
  nudgePages,
  rotatePages,
  splitPdf
} from '../editing/pageOps'
import { closeDocument, openFromDialog, print, save, saveAs } from '../services/fileService'
import { useAppStore, type AppState, type ToolId } from '../store/useAppStore'
import { useEditStore, type EditState } from '../store/useEditStore'

export interface ActionDef {
  icon: LucideIcon
  labelKey: string
  /** Display + matching format, e.g. "Ctrl+Shift+S". "Ctrl" also matches Cmd on macOS. */
  shortcut?: string
  /** Keyboard-only actions are not shown in the ribbon. */
  hidden?: boolean
  run: () => void
  enabled?: (s: AppState, e: EditState) => boolean
  active?: (s: AppState, e: EditState) => boolean
}

const hasDoc = (s: AppState): boolean => s.document !== null
const store = useAppStore.getState
const edit = useEditStore.getState

function tool(id: ToolId, icon: LucideIcon, labelKey: string, shortcut?: string): ActionDef {
  return {
    icon,
    labelKey,
    shortcut,
    enabled: hasDoc,
    run: () => {
      commitDraft()
      store().setActiveTool(store().activeTool === id && id !== 'select' ? 'select' : id)
    },
    active: (s) => s.activeTool === id
  }
}

export const actions = {
  open: { icon: FolderOpen, labelKey: 'tools.open', shortcut: 'Ctrl+O', run: () => void openFromDialog() },
  save: { icon: Save, labelKey: 'tools.save', shortcut: 'Ctrl+S', enabled: hasDoc, run: () => void save() },
  saveAs: { icon: SaveAll, labelKey: 'tools.saveAs', shortcut: 'Ctrl+Shift+S', enabled: hasDoc, run: () => void saveAs() },
  print: { icon: Printer, labelKey: 'tools.print', shortcut: 'Ctrl+P', enabled: hasDoc, run: () => void print() },
  close: { icon: FileX, labelKey: 'tools.close', shortcut: 'Ctrl+W', enabled: hasDoc, run: () => void closeDocument() },
  undo: {
    icon: Undo2,
    labelKey: 'tools.undo',
    shortcut: 'Ctrl+Z',
    enabled: (s, e) => hasDoc(s) && (e.past.length > 0 || e.draft !== null),
    run: () => {
      // An open text box is committed first so its text is undone as one step.
      commitDraft()
      void undo()
    }
  },
  redo: {
    icon: Redo2,
    labelKey: 'tools.redo',
    shortcut: 'Ctrl+Y',
    enabled: (s, e) => hasDoc(s) && e.future.length > 0,
    run: () => void redo()
  },
  redoAlt: {
    icon: Redo2,
    labelKey: 'tools.redo',
    shortcut: 'Ctrl+Shift+Z',
    hidden: true,
    enabled: (s, e) => hasDoc(s) && e.future.length > 0,
    run: () => void redo()
  },
  deleteObject: {
    icon: Trash,
    labelKey: 'tools.deleteObject',
    shortcut: 'Delete',
    hidden: true,
    enabled: (_s, e) => e.selectedId !== null,
    run: () => {
      const id = edit().selectedId
      if (id) removeObjects([id])
    }
  },
  deselect: {
    icon: MousePointer2,
    labelKey: 'tools.select',
    shortcut: 'Escape',
    hidden: true,
    run: () => {
      commitDraft()
      closeNote()
      edit().select(null)
    }
  },
  movePagesUp: {
    icon: ArrowDownUp,
    labelKey: 'tools.movePagesUp',
    shortcut: 'Ctrl+Shift+ArrowUp',
    hidden: true,
    enabled: hasDoc,
    run: () => void nudgePages(-1)
  },
  movePagesDown: {
    icon: ArrowDownUp,
    labelKey: 'tools.movePagesDown',
    shortcut: 'Ctrl+Shift+ArrowDown',
    hidden: true,
    enabled: hasDoc,
    run: () => void nudgePages(1)
  },

  hand: {
    icon: Hand,
    labelKey: 'tools.hand',
    shortcut: 'H',
    run: () => {
      commitDraft()
      store().setActiveTool('hand')
    },
    active: (s) => s.activeTool === 'hand'
  },
  select: {
    icon: MousePointer2,
    labelKey: 'tools.select',
    shortcut: 'V',
    run: () => {
      commitDraft()
      store().setActiveTool('select')
    },
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

  addText: tool('addText', Type, 'tools.addText', 'T'),
  editText: tool('editText', TextCursorInput, 'tools.editText', 'E'),
  insertImage: {
    icon: ImagePlus,
    labelKey: 'tools.insertImage',
    shortcut: 'Ctrl+Shift+I',
    enabled: hasDoc,
    run: () => void insertImage()
  },
  editObject: tool('editObject', SquareDashedMousePointer, 'tools.editObject', 'O'),

  highlight: tool('highlight', Highlighter, 'tools.highlight', 'Alt+H'),
  underline: tool('underline', Underline, 'tools.underline', 'Alt+U'),
  strikeout: tool('strikeout', Strikethrough, 'tools.strikeout', 'Alt+K'),
  pen: tool('pen', PenTool, 'tools.pen', 'P'),
  eraser: tool('eraser', Eraser, 'tools.eraser', 'Shift+E'),
  stickyNote: tool('stickyNote', StickyNote, 'tools.stickyNote', 'N'),
  commentBox: tool('commentBox', MessageSquare, 'tools.commentBox', 'Alt+C'),

  rotateLeft: {
    icon: RotateCcw,
    labelKey: 'tools.rotateLeft',
    shortcut: 'Ctrl+Shift+-',
    enabled: hasDoc,
    run: () => void rotatePages(-90)
  },
  rotateRight: {
    icon: RotateCw,
    labelKey: 'tools.rotateRight',
    shortcut: 'Ctrl+Shift+=',
    enabled: hasDoc,
    run: () => void rotatePages(90)
  },
  deletePage: {
    icon: Trash,
    labelKey: 'tools.deletePage',
    shortcut: 'Ctrl+Shift+D',
    enabled: (s) => (s.document?.pageSizes.length ?? 0) > 1,
    run: () => void deletePages()
  },
  extractPages: {
    icon: FileOutput,
    labelKey: 'tools.extractPages',
    shortcut: 'Ctrl+Shift+E',
    enabled: hasDoc,
    run: () => void extractPages()
  },
  reorderPages: {
    icon: ArrowDownUp,
    labelKey: 'tools.reorderPages',
    enabled: (s) => (s.document?.pageSizes.length ?? 0) > 1,
    run: () => {
      store().setSidebarPanel('thumbnails')
      store().showNotice({ kind: 'info', key: 'messages.reorderHint' })
    }
  },
  mergePdfs: { icon: Combine, labelKey: 'tools.mergePdfs', shortcut: 'Ctrl+Shift+M', run: () => void mergePdfs() },
  splitPdf: {
    icon: Split,
    labelKey: 'tools.splitPdf',
    enabled: (s) => (s.document?.pageSizes.length ?? 0) > 1,
    run: () => void splitPdf()
  },

  drawSignature: {
    icon: FilePen,
    labelKey: 'tools.drawSignature',
    shortcut: 'Ctrl+Shift+G',
    enabled: hasDoc,
    run: () => void drawSignature()
  },
  imageSignature: { icon: FileImage, labelKey: 'tools.imageSignature', enabled: hasDoc, run: () => void insertImage(true) }
} satisfies Record<string, ActionDef>

export type ActionId = keyof typeof actions

export function getAction(id: ActionId): ActionDef {
  return actions[id]
}

export function isActionEnabled(id: ActionId, state: AppState, editState: EditState = edit()): boolean {
  const action = getAction(id)
  return action.enabled ? action.enabled(state, editState) : true
}

export function runAction(id: ActionId): void {
  if (isActionEnabled(id, store(), edit())) getAction(id).run()
}
