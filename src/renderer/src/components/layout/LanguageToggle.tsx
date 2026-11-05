import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppLanguage } from '../../../../shared/ipc'
import { setLanguage } from '../../locales/i18n'

const languages: { id: AppLanguage; short: string; labelKey: string }[] = [
  { id: 'tr', short: 'TR', labelKey: 'tools.langTr' },
  { id: 'en', short: 'EN', labelKey: 'tools.langEn' }
]

export function LanguageToggle(): JSX.Element {
  const { t, i18n } = useTranslation()

  return (
    <div
      className="no-drag flex items-center gap-1 rounded border border-chrome-border bg-white p-0.5"
      role="radiogroup"
      aria-label={t('common.language')}
    >
      <Languages size={14} className="mx-1 text-ink-muted" />
      {languages.map((lang) => {
        const selected = i18n.language === lang.id
        return (
          <button
            key={lang.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={t(lang.labelKey)}
            onClick={() => setLanguage(lang.id)}
            className={[
              'rounded px-1.5 py-0.5 text-[11px] font-semibold',
              selected ? 'bg-brand text-white' : 'text-ink-muted hover:bg-chrome'
            ].join(' ')}
          >
            {lang.short}
          </button>
        )
      })}
    </div>
  )
}
