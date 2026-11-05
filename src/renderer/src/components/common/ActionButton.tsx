import { useTranslation } from 'react-i18next'
import { getAction, isActionEnabled, runAction, type ActionId } from '../../actions/actions'
import { useBothStores } from '../../editing/history'
import { Tooltip } from './Tooltip'

export type ActionButtonVariant = 'large' | 'small' | 'icon'

interface ActionButtonProps {
  id: ActionId
  variant: ActionButtonVariant
}

const isMac = window.api.platform === 'darwin'

export function formatShortcut(shortcut: string | undefined): string | undefined {
  return isMac && shortcut ? shortcut.replace('Ctrl', '⌘') : shortcut
}

const variantClasses: Record<ActionButtonVariant, string> = {
  large: 'h-[66px] min-w-[52px] flex-col justify-start gap-1 px-1.5 pt-1.5 text-[11px] leading-tight',
  small: 'h-5 gap-1.5 px-1.5 text-[11px]',
  icon: 'h-7 w-7 justify-center'
}

const iconSize: Record<ActionButtonVariant, number> = { large: 26, small: 15, icon: 16 }

export function ActionButton({ id, variant }: ActionButtonProps): JSX.Element {
  const { t } = useTranslation()
  const action = getAction(id)
  const enabled = useBothStores((s, e) => isActionEnabled(id, s, e))
  const active = useBothStores((s, e) => action.active?.(s, e) ?? false)
  const Icon = action.icon
  const label = t(action.labelKey)

  return (
    <Tooltip title={label} shortcut={formatShortcut(action.shortcut)}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={action.active ? active : undefined}
        disabled={!enabled}
        onClick={() => runAction(id)}
        className={[
          'no-drag inline-flex items-center rounded border transition-colors',
          variantClasses[variant],
          active
            ? 'border-brand/40 bg-brand-soft text-brand-dark'
            : 'border-transparent text-ink hover:border-chrome-border hover:bg-white',
          'disabled:border-transparent disabled:bg-transparent disabled:opacity-40'
        ].join(' ')}
      >
        <Icon
          size={iconSize[variant]}
          strokeWidth={variant === 'large' ? 1.6 : 1.9}
          className={active || variant === 'large' ? 'text-brand' : undefined}
        />
        {variant !== 'icon' && (
          <span className={variant === 'large' ? 'max-w-[72px] text-center' : 'whitespace-nowrap'}>
            {label}
          </span>
        )}
      </button>
    </Tooltip>
  )
}
