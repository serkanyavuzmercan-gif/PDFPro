import { useTranslation } from 'react-i18next'
import logo from '../../assets/logo.png'
import { isDirty, useBothStores } from '../../editing/history'
import { LanguageToggle } from './LanguageToggle'
import { QuickAccessBar } from './QuickAccessBar'

const platform = window.api.platform
/** Space reserved for the native window controls drawn over the title bar. */
const leftInset = platform === 'darwin' ? 'pl-[78px]' : 'pl-2'
const rightInset = platform === 'darwin' ? 'pr-3' : 'pr-[150px]'

export function TitleBar(): JSX.Element {
  const { t } = useTranslation()
  const fileName = useBothStores((s) => s.document?.name)
  const dirty = useBothStores((s, e) => isDirty(s, e))

  return (
    <header
      className={`drag-region flex h-9 shrink-0 items-center gap-2 border-b border-chrome-border bg-white ${leftInset} ${rightInset}`}
    >
      <img src={logo} alt="" className="h-6 w-6 shrink-0" draggable={false} />
      <span className="text-[13px] font-bold tracking-tight text-brand">{t('app.name')}</span>
      <span className="mx-1 h-4 w-px bg-chrome-border" />
      <QuickAccessBar />
      <div className="min-w-0 flex-1 truncate text-center text-[12px] text-ink-muted">
        {fileName ? `${dirty ? '* ' : ''}${fileName} - ${t('app.name')}` : t('app.about')}
      </div>
      <LanguageToggle />
    </header>
  )
}
