import { useEffect } from 'react'
import { CircleX, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'

const INFO_TIMEOUT_MS = 3500

export function NoticeBar(): JSX.Element | null {
  const { t } = useTranslation()
  const notice = useAppStore((s) => s.notice)
  const showNotice = useAppStore((s) => s.showNotice)

  useEffect(() => {
    if (notice?.kind !== 'info') return
    const timer = window.setTimeout(() => showNotice(null), INFO_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [notice, showNotice])

  if (!notice) return null
  const isError = notice.kind === 'error'
  const Icon = isError ? CircleX : Info

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`absolute bottom-4 left-1/2 z-50 flex max-w-[560px] -translate-x-1/2 items-start gap-2 rounded-md border px-3 py-2 text-[12px] shadow-lg ${isError ? 'border-brand/30 bg-brand-soft text-brand-dark' : 'border-chrome-border bg-white text-ink'}`}
    >
      <Icon size={16} className="mt-px shrink-0" />
      <span className="flex-1">{t(notice.key, notice.params)}</span>
      <button
        type="button"
        aria-label={t('common.dismiss')}
        onClick={() => showNotice(null)}
        className="rounded p-0.5 hover:bg-black/5"
      >
        <X size={14} />
      </button>
    </div>
  )
}
