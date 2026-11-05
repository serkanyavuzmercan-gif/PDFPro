import type { RibbonTabId } from '../store/useAppStore'
import type { ActionId } from './actions'

export interface RibbonGroupConfig {
  id: string
  labelKey: string
  /** The first `large` items render as big icon-over-label buttons; the rest stack compactly. */
  large: ActionId[]
  small?: ActionId[]
}

export interface RibbonTabConfig {
  id: RibbonTabId
  labelKey: string
  groups: RibbonGroupConfig[]
}

export const ribbonTabs: RibbonTabConfig[] = [
  {
    id: 'file',
    labelKey: 'ribbon.tabs.file',
    groups: [
      { id: 'document', labelKey: 'ribbon.groups.document', large: ['open', 'save', 'saveAs', 'close'] },
      { id: 'output', labelKey: 'ribbon.groups.output', large: ['print'] }
    ]
  },
  {
    id: 'home',
    labelKey: 'ribbon.tabs.home',
    groups: [
      { id: 'tools', labelKey: 'ribbon.groups.tools', large: ['hand', 'select'] },
      {
        id: 'zoom',
        labelKey: 'ribbon.groups.zoom',
        large: ['fitPage', 'fitWidth'],
        small: ['zoomIn', 'zoomOut', 'actualSize']
      },
      { id: 'text', labelKey: 'ribbon.groups.text', large: ['addText', 'editText'] },
      { id: 'markup', labelKey: 'ribbon.groups.markup', large: ['highlight'], small: ['underline', 'strikeout'] },
      { id: 'objects', labelKey: 'ribbon.groups.objects', large: ['insertImage'] },
      { id: 'signature', labelKey: 'ribbon.groups.signature', large: ['drawSignature'] }
    ]
  },
  {
    id: 'edit',
    labelKey: 'ribbon.tabs.edit',
    groups: [
      { id: 'text', labelKey: 'ribbon.groups.text', large: ['addText', 'editText'] },
      { id: 'objects', labelKey: 'ribbon.groups.objects', large: ['insertImage', 'editObject'] }
    ]
  },
  {
    id: 'view',
    labelKey: 'ribbon.tabs.view',
    groups: [
      {
        id: 'navigation',
        labelKey: 'ribbon.groups.navigation',
        large: ['firstPage', 'prevPage', 'nextPage', 'lastPage']
      },
      { id: 'pageDisplay', labelKey: 'ribbon.groups.pageDisplay', large: ['singlePage', 'continuous'] },
      {
        id: 'zoom',
        labelKey: 'ribbon.groups.zoom',
        large: ['fitPage', 'fitWidth', 'actualSize'],
        small: ['zoomIn', 'zoomOut']
      },
      { id: 'panels', labelKey: 'ribbon.groups.panels', large: ['sidebar'] }
    ]
  },
  {
    id: 'comment',
    labelKey: 'ribbon.tabs.comment',
    groups: [
      { id: 'markup', labelKey: 'ribbon.groups.markup', large: ['highlight', 'underline', 'strikeout'] },
      { id: 'drawing', labelKey: 'ribbon.groups.drawing', large: ['pen', 'eraser'] },
      { id: 'notes', labelKey: 'ribbon.groups.notes', large: ['stickyNote', 'commentBox'] }
    ]
  },
  {
    id: 'pages',
    labelKey: 'ribbon.tabs.pages',
    groups: [
      {
        id: 'organize',
        labelKey: 'ribbon.groups.organize',
        large: ['reorderPages', 'deletePage', 'extractPages']
      },
      { id: 'transform', labelKey: 'ribbon.groups.transform', large: ['rotateLeft', 'rotateRight'] },
      { id: 'combine', labelKey: 'ribbon.groups.combine', large: ['mergePdfs', 'splitPdf'] }
    ]
  },
  {
    id: 'protect',
    labelKey: 'ribbon.tabs.protect',
    groups: [
      { id: 'signature', labelKey: 'ribbon.groups.signature', large: ['drawSignature', 'imageSignature'] }
    ]
  }
]

export const quickAccessGroups: ActionId[][] = [
  ['open', 'save', 'print'],
  ['undo', 'redo'],
  ['hand', 'select']
]
