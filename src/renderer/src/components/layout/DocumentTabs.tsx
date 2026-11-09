import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { closeDocument } from '../../services/fileService'
import { sessionDirty, switchDocument } from '../../services/documentTabs'
import { useAppStore } from '../../store/useAppStore'
import { useEditStore } from '../../store/useEditStore'

export function DocumentTabs(): JSX.Element | null {
  const { t } = useTranslation()
  const order = useAppStore((s) => s.documentOrder)
  const activeId = useAppStore((s) => s.activeDocumentId)
  const document = useAppStore((s) => s.document)
  const parked = useAppStore((s) => s.parked)
  const objects = useEditStore((s) => s.objects)
  const saved = useEditStore((s) => s.saved)
  const draft = useEditStore((s) => s.draft)
  if (order.length === 0) return null

  const tabs = order.flatMap((id) => {
    if (id === activeId && document) {
      const dirty = document.bytes !== saved.bytes || objects !== saved.objects || draft !== null
      return [{ id, name: document.name, dirty }]
    }
    const session = parked.find((item) => item.id === id)
    return session ? [{ id, name: session.document.name, dirty: sessionDirty(session) }] : []
  })

  return (
    <div className="flex h-8 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-chrome-border bg-chrome px-2">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <div
            key={tab.id}
            className={`flex h-7 max-w-56 shrink-0 items-center rounded-t border px-1.5 ${
              active
                ? 'relative z-[1] -mb-px border-chrome-border border-b-white bg-white text-ink'
                : 'border-transparent text-ink-muted hover:bg-white/80'
            }`}
          >
            <button
              type="button"
              title={tab.name}
              onClick={() => void switchDocument(tab.id)}
              className={`min-w-0 flex-1 truncate px-1 text-left text-[12px] ${active ? 'font-medium' : ''}`}
            >
              {tab.dirty ? '* ' : ''}
              {tab.name}
            </button>
            <button
              type="button"
              title={t('common.close')}
              aria-label={t('common.close')}
              onClick={(event) => {
                event.stopPropagation()
                void closeDocument(tab.id)
              }}
              className="rounded p-0.5 hover:bg-chrome"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
