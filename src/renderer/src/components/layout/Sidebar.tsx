import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Bookmark, ChevronDown, ChevronRight, LayoutGrid, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { movePages } from '../../editing/pageOps'
import { resolveDestinationPage } from '../../services/pdfService'
import { useAppStore, type OpenDocument, type SidebarPanel } from '../../store/useAppStore'
import { PageCanvas } from '../viewer/PageCanvas'

const THUMB_WIDTH = 132

const panels: { id: SidebarPanel; icon: LucideIcon; labelKey: string }[] = [
  { id: 'thumbnails', icon: LayoutGrid, labelKey: 'sidebar.thumbnails' },
  { id: 'bookmarks', icon: Bookmark, labelKey: 'sidebar.bookmarks' }
]

function Thumbnails({ doc }: { doc: OpenDocument }): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage)
  const selectedPages = useAppStore((s) => s.selectedPages)
  const goToPage = useAppStore((s) => s.goToPage)
  const selectPage = useAppStore((s) => s.selectPage)
  const listRef = useRef<HTMLDivElement>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const dragging = useRef<number[]>([])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-thumb="${currentPage}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  const onItemClick = (page: number, event: MouseEvent): void => {
    const mode = event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'single'
    selectPage(page, mode)
    goToPage(page)
  }

  const dropIndexFromY = (clientY: number): number => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-thumb]') ?? [])]
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return items.length
  }

  return (
    <div
      ref={listRef}
      className="relative flex flex-col items-center gap-3 p-3"
      onDragOver={(e) => {
        if (dragging.current.length === 0) return
        e.preventDefault()
        setDropAt(dropIndexFromY(e.clientY))
      }}
      onDrop={(e) => {
        e.preventDefault()
        const target = dropIndexFromY(e.clientY)
        const pages = dragging.current
        dragging.current = []
        setDropAt(null)
        if (pages.length > 0) void movePages(pages, target)
      }}
      onDragLeave={(e) => {
        if (!listRef.current?.contains(e.relatedTarget as Node)) setDropAt(null)
      }}
    >
      {doc.pageSizes.map((size, index) => {
        const page = index + 1
        const current = page === currentPage
        const selected = selectedPages.includes(page) || (selectedPages.length === 0 && current)
        return (
          <div key={page} className="relative flex w-full flex-col items-center">
            {dropAt === index && (
              <div className="absolute -top-2 left-3 right-3 z-10 h-0.5 rounded bg-brand" />
            )}
            <button
              type="button"
              data-thumb={page}
              draggable
              onClick={(e) => onItemClick(page, e)}
              onDragStart={(e) => {
                const pages =
                  selectedPages.includes(page) && selectedPages.length > 0 ? selectedPages : [page]
                dragging.current = pages
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', pages.join(','))
                if (!selectedPages.includes(page)) selectPage(page, 'single')
              }}
              onDragEnd={() => {
                dragging.current = []
                setDropAt(null)
              }}
              className="flex flex-col items-center gap-1"
            >
              <PageCanvas
                pdf={doc.pdf}
                pageNumber={page}
                size={size}
                scale={THUMB_WIDTH / size.width}
                className={`outline-offset-2 ${selected ? 'outline-2 outline-brand' : 'outline-1 outline-chrome-border hover:outline-ink-muted'} outline`}
              />
              <span className={`text-[11px] ${current ? 'font-semibold text-brand' : 'text-ink-muted'}`}>
                {page}
              </span>
            </button>
          </div>
        )
      })}
      {dropAt === doc.pageSizes.length && (
        <div className="h-0.5 w-[calc(100%-1.5rem)] rounded bg-brand" />
      )}
    </div>
  )
}

interface OutlineNode {
  title: string
  dest: string | unknown[] | null
  items: OutlineNode[]
}

function OutlineItem({ node, pdf, depth }: { node: OutlineNode; pdf: PDFDocumentProxy; depth: number }): JSX.Element {
  const [open, setOpen] = useState(depth === 0)
  const goToPage = useAppStore((s) => s.goToPage)
  const hasChildren = node.items.length > 0
  const Chevron = open ? ChevronDown : ChevronRight

  const navigate = async (): Promise<void> => {
    const page = await resolveDestinationPage(pdf, node.dest)
    if (page) goToPage(page)
  }

  return (
    <li>
      <div className="flex items-center rounded hover:bg-white" style={{ paddingLeft: depth * 12 }}>
        <button
          type="button"
          className={`flex h-6 w-5 items-center justify-center ${hasChildren ? '' : 'invisible'}`}
          onClick={() => setOpen(!open)}
        >
          <Chevron size={13} />
        </button>
        <button type="button" className="flex-1 truncate py-1 text-left" title={node.title} onClick={() => void navigate()}>
          {node.title}
        </button>
      </div>
      {open && hasChildren && (
        <ul>
          {node.items.map((child, i) => (
            <OutlineItem key={i} node={child} pdf={pdf} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function Bookmarks({ doc }: { doc: OpenDocument }): JSX.Element {
  const { t } = useTranslation()
  const [outline, setOutline] = useState<OutlineNode[] | null>(null)

  useEffect(() => {
    let cancelled = false
    doc.pdf
      .getOutline()
      .then((items) => {
        if (!cancelled) setOutline((items as OutlineNode[] | null) ?? [])
      })
      .catch(() => !cancelled && setOutline([]))
    return () => {
      cancelled = true
    }
  }, [doc.pdf])

  if (outline === null) return <div className="p-3 text-ink-muted">{t('common.loading')}</div>
  if (outline.length === 0) return <div className="p-3 text-ink-muted">{t('sidebar.noBookmarks')}</div>
  return (
    <ul className="p-2">
      {outline.map((node, i) => (
        <OutlineItem key={i} node={node} pdf={doc.pdf} depth={0} />
      ))}
    </ul>
  )
}

export function Sidebar(): JSX.Element {
  const { t } = useTranslation()
  const doc = useAppStore((s) => s.document)
  const open = useAppStore((s) => s.sidebarOpen)
  const panel = useAppStore((s) => s.sidebarPanel)
  const setPanel = useAppStore((s) => s.setSidebarPanel)
  const toggle = useAppStore((s) => s.toggleSidebar)

  return (
    <aside className="flex shrink-0 border-r border-chrome-border bg-chrome">
      <nav className="flex w-10 flex-col items-center gap-1 border-r border-chrome-border bg-white py-2">
        {panels.map(({ id, icon: Icon, labelKey }) => {
          const selected = open && panel === id
          return (
            <button
              key={id}
              type="button"
              title={t(labelKey)}
              aria-pressed={selected}
              onClick={() => (selected ? toggle() : setPanel(id))}
              className={`flex h-8 w-8 items-center justify-center rounded ${selected ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-chrome'}`}
            >
              <Icon size={17} />
            </button>
          )
        })}
      </nav>
      {open && (
        <div className="flex w-[184px] flex-col">
          <div className="border-b border-chrome-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {t(panels.find((p) => p.id === panel)?.labelKey ?? '')}
          </div>
          <div className="flex-1 overflow-y-auto">
            {doc && panel === 'thumbnails' && <Thumbnails doc={doc} />}
            {doc && panel === 'bookmarks' && <Bookmarks doc={doc} />}
          </div>
        </div>
      )}
    </aside>
  )
}
