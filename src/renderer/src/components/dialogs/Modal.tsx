import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  title: string
  onCancel: () => void
  children: ReactNode
  footer: ReactNode
  width?: number
}

export function Modal({ title, onCancel, children, footer, width = 420 }: ModalProps): JSX.Element {
  const { t } = useTranslation()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90vh] flex-col rounded-lg border border-chrome-border bg-white shadow-2xl"
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-chrome-border px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            aria-label={t('common.cancel')}
            onClick={onCancel}
            className="rounded p-1 text-ink-muted hover:bg-chrome"
          >
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 text-[12px] text-ink">{children}</div>
        <div className="flex justify-end gap-2 border-t border-chrome-border px-4 py-2.5">{footer}</div>
      </div>
    </div>
  )
}

export function DialogButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  autoFocus = false
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  autoFocus?: boolean
}): JSX.Element {
  const tone =
    variant === 'primary'
      ? 'border-brand bg-brand text-white hover:bg-brand-dark'
      : variant === 'danger'
        ? 'border-brand bg-white text-brand hover:bg-brand-soft'
        : 'border-chrome-border bg-white text-ink hover:bg-chrome'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`min-w-20 rounded border px-3 py-1.5 text-[12px] font-medium disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  )
}
