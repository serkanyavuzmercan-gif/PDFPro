import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { ActionButton } from '../common/ActionButton'
import { ZoomControls } from './ZoomControls'

function PageJump(): JSX.Element {
  const { t } = useTranslation()
  const currentPage = useAppStore((s) => s.currentPage)
  const pageCount = useAppStore((s) => s.document?.pageSizes.length ?? 0)
  const goToPage = useAppStore((s) => s.goToPage)
  const [draft, setDraft] = useState(String(currentPage))

  useEffect(() => setDraft(String(currentPage)), [currentPage])

  const commit = (e?: FormEvent): void => {
    e?.preventDefault()
    const page = Number.parseInt(draft, 10)
    if (Number.isFinite(page)) goToPage(page)
    else setDraft(String(currentPage))
  }

  return (
    <form onSubmit={commit} className="flex items-center gap-1.5 text-[11px]">
      <span className="text-ink-muted">{t('status.page')}</span>
      <input
        value={pageCount ? draft : ''}
        disabled={!pageCount}
        aria-label={t('status.goToPage')}
        title={t('status.goToPage')}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={() => commit()}
        onFocus={(e) => e.target.select()}
        className="h-6 w-10 rounded border border-chrome-border bg-white px-1 text-center outline-none focus:border-brand disabled:bg-chrome"
      />
      <span className="text-ink-muted">
        {t('status.of')} {pageCount}
      </span>
    </form>
  )
}

export function StatusBar(): JSX.Element {
  return (
    <footer className="flex h-8 shrink-0 items-center gap-2 border-t border-chrome-border bg-white px-2">
      <div className="flex items-center gap-0.5">
        <ActionButton id="firstPage" variant="icon" />
        <ActionButton id="prevPage" variant="icon" />
        <PageJump />
        <ActionButton id="nextPage" variant="icon" />
        <ActionButton id="lastPage" variant="icon" />
      </div>
      <span className="mx-1 h-4 w-px bg-chrome-border" />
      <ActionButton id="singlePage" variant="icon" />
      <ActionButton id="continuous" variant="icon" />
      <div className="flex-1" />
      <ZoomControls />
    </footer>
  )
}
