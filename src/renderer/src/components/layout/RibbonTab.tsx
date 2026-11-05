import { useTranslation } from 'react-i18next'
import type { RibbonTabConfig } from '../../actions/ribbonConfig'

interface RibbonTabProps {
  tab: RibbonTabConfig
  selected: boolean
  onSelect: () => void
}

export function RibbonTab({ tab, selected, onSelect }: RibbonTabProps): JSX.Element {
  const { t } = useTranslation()
  const isFile = tab.id === 'file'

  const tone = isFile
    ? selected
      ? 'bg-brand-dark text-white'
      : 'bg-brand text-white hover:bg-brand-dark'
    : selected
      ? 'border-chrome-border border-b-chrome bg-chrome font-semibold text-brand'
      : 'border-transparent text-ink hover:bg-chrome/70'

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`relative -mb-px h-7 rounded-t border px-4 text-[12px] ${isFile ? 'border-transparent' : ''} ${tone}`}
    >
      {t(tab.labelKey)}
    </button>
  )
}
