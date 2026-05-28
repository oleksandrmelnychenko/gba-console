import { AppShell, ScrollArea } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { getNodeIcon } from '../../../features/navigation/navigationIcons'
import { useI18n } from '../../../shared/i18n/useI18n'

type ConsoleSidebarProps = {
  onItemClick?: () => void
}

export function ConsoleSidebar({ onItemClick }: ConsoleSidebarProps) {
  const { error, getNodePath, isLoading, modules, selectedNode } = useNavigation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const activeNodeKey = selectedNode ? selectedNode.NetUid || String(selectedNode.Id) : null

  return (
    <AppShell.Navbar className="console-sidebar">
      <ScrollArea type="auto" scrollbarSize={6} className="console-sidebar-scroll">
        <div className="console-sidebar-inner">
          {isLoading && <div className="console-sidebar-state">{t('Меню завантажується')}</div>}
          {error && <div className="console-sidebar-state">{t('Меню недоступне')}</div>}
          {!isLoading && !error && modules.length === 0 && (
            <div className="console-sidebar-state">{t('Меню порожнє')}</div>
          )}
          {modules.map((module) => (
            <section key={module.NetUid || module.Id} className="console-sidebar-section">
              <h3 className="console-sidebar-section-title">{module.Module}</h3>
              <ul className="console-sidebar-list">
                {module.Children.map((node) => {
                  const Icon = getNodeIcon({ Module: node.Module, Route: node.Route })
                  const active = activeNodeKey != null && (node.NetUid || String(node.Id)) === activeNodeKey
                  return (
                    <li key={node.NetUid || node.Id}>
                      <button
                        type="button"
                        className={`console-sidebar-item${active ? ' is-active' : ''}`}
                        onClick={() => {
                          navigate(getNodePath(node), {
                            state: { nodeTitle: node.Module, moduleTitle: module.Module },
                          })
                          onItemClick?.()
                        }}
                      >
                        <Icon size={20} stroke={1.7} className="console-sidebar-item-icon" />
                        <span className="console-sidebar-item-label">{node.Module}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </ScrollArea>
    </AppShell.Navbar>
  )
}
