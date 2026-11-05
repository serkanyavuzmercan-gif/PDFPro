import { useTranslation } from 'react-i18next'
import type { RibbonGroupConfig } from '../../actions/ribbonConfig'
import { ActionButton } from '../common/ActionButton'

export function RibbonGroup({ group }: { group: RibbonGroupConfig }): JSX.Element {
  const { t } = useTranslation()

  return (
    <section
      className="flex h-full shrink-0 flex-col border-r border-chrome-border px-1.5"
      aria-label={t(group.labelKey)}
    >
      <div className="flex flex-1 items-start gap-0.5 pt-1">
        {group.large.map((id) => (
          <ActionButton key={id} id={id} variant="large" />
        ))}
        {group.small && (
          <div className="flex flex-col gap-0.5 pt-0.5">
            {group.small.map((id) => (
              <ActionButton key={id} id={id} variant="small" />
            ))}
          </div>
        )}
      </div>
      <div className="pb-0.5 text-center text-[10.5px] text-ink-muted">{t(group.labelKey)}</div>
    </section>
  )
}
