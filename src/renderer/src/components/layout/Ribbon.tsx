import { ribbonTabs } from '../../actions/ribbonConfig'
import { useAppStore } from '../../store/useAppStore'
import { RibbonGroup } from './RibbonGroup'
import { RibbonTab } from './RibbonTab'

export function Ribbon(): JSX.Element {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const current = ribbonTabs.find((tab) => tab.id === activeTab) ?? ribbonTabs[0]

  return (
    <div className="shrink-0 bg-white">
      <div role="tablist" className="flex items-end gap-0.5 border-b border-chrome-border px-2 pt-1">
        {ribbonTabs.map((tab) => (
          <RibbonTab
            key={tab.id}
            tab={tab}
            selected={tab.id === current.id}
            onSelect={() => setActiveTab(tab.id)}
          />
        ))}
      </div>
      <div
        role="tabpanel"
        className="flex h-[92px] items-stretch overflow-x-auto overflow-y-hidden border-b border-chrome-border bg-chrome px-1 py-1"
      >
        {current.groups.map((group) => (
          <RibbonGroup key={`${current.id}-${group.id}`} group={group} />
        ))}
      </div>
    </div>
  )
}
