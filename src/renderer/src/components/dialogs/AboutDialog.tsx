import { useTranslation } from 'react-i18next'
import logo from '../../assets/logo.png'
import { DialogButton, Modal } from './Modal'

const VERSION = '0.3.0'
const YEAR = 2026

export function AboutDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('app.aboutTitle')}
      width={380}
      onCancel={onClose}
      footer={<DialogButton variant="primary" autoFocus onClick={onClose}>{t('common.close')}</DialogButton>}
    >
      <div className="flex flex-col items-center px-2 py-3 text-center">
        <img src={logo} alt="" className="h-20 w-20" draggable={false} />
        <h3 className="mt-3 text-[20px] font-bold tracking-tight text-brand">{t('app.name')}</h3>
        <p className="text-[12px] text-ink-muted">
          {t('app.aboutTitle')} · {VERSION}
        </p>
        <p className="mt-3 max-w-[300px] leading-relaxed text-ink">{t('app.aboutText')}</p>
        <div className="mt-4 w-full border-t border-chrome-border pt-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('app.developer')}</p>
          <p className="mt-1 text-[14px] font-semibold text-ink">Serkan Yavuz Mercan</p>
          <a
            href="mailto:serkanyavuzmercan@gmail.com"
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-block text-[12px] text-brand hover:underline"
          >
            serkanyavuzmercan@gmail.com
          </a>
        </div>
        <p className="mt-4 text-[11px] text-ink-muted">{t('app.rights', { year: YEAR })}</p>
      </div>
    </Modal>
  )
}
