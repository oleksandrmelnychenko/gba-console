import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { getNodeIcon } from '../../../features/navigation/navigationIcons'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { useI18n } from '../../../shared/i18n/useI18n'

export function ConsoleNav() {
  const { error, getNodePath, isLoading, modules, selectedModule, selectedNode } = useNavigation()
  const navigate = useNavigate()
  const { t } = useI18n()

  if (isLoading) {
    return <div className="console-subnav console-subnav-state">{t('Меню завантажується')}</div>
  }

  if (error) {
    return <div className="console-subnav console-subnav-state">{t('Меню недоступне')}</div>
  }

  if (modules.length === 0) {
    return null
  }

  const activeModuleKey = selectedModule ? selectedModule.NetUid || String(selectedModule.Id) : null
  const activeNodeKey = selectedNode ? selectedNode.NetUid || String(selectedNode.Id) : null
  const items = selectedModule?.Children ?? []

  function openModule(module: NavigationModule) {
    const firstChild = module.Children[0]

    if (firstChild) {
      navigate(getNodePath(firstChild), { state: { nodeTitle: firstChild.Module, moduleTitle: module.Module } })
    }
  }

  function openNode(node: NavigationNode) {
    navigate(getNodePath(node), { state: { nodeTitle: node.Module, moduleTitle: selectedModule?.Module } })
  }

  return (
    <nav className="console-subnav" aria-label={t('Навігація')}>
      <div className="console-subnav-row console-subnav-modules">
        {modules.map((module) => {
          const key = module.NetUid || String(module.Id)
          const active = key === activeModuleKey

          return (
            <button
              key={key}
              type="button"
              className={`console-subnav-pill console-subnav-module${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => openModule(module)}
            >
              {module.Module}
            </button>
          )
        })}
      </div>

      {items.length > 0 && (
        <div className="console-subnav-row console-subnav-items">
          {items.map((node) => {
            const Icon = getNodeIcon({ Module: node.Module, Route: node.Route })
            const key = node.NetUid || String(node.Id)
            const active = activeNodeKey != null && key === activeNodeKey

            return (
              <button
                key={key}
                type="button"
                className={`console-subnav-pill console-subnav-item${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => openNode(node)}
              >
                <Icon size={16} stroke={1.7} className="console-subnav-item-icon" />
                <span>{node.Module}</span>
              </button>
            )
          })}
        </div>
      )}
    </nav>
  )
}
