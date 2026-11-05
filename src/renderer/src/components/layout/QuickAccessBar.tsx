import { Fragment } from 'react'
import { quickAccessGroups } from '../../actions/ribbonConfig'
import { ActionButton } from '../common/ActionButton'

export function QuickAccessBar(): JSX.Element {
  return (
    <div className="flex items-center gap-0.5" role="toolbar">
      {quickAccessGroups.map((group, index) => (
        <Fragment key={group.join()}>
          {index > 0 && <span className="mx-1 h-4 w-px bg-chrome-border" />}
          {group.map((id) => (
            <ActionButton key={id} id={id} variant="icon" />
          ))}
        </Fragment>
      ))}
    </div>
  )
}
