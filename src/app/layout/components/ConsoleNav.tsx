import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { getNodeIcon } from '../../../features/navigation/navigationIcons'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { useI18n } from '../../../shared/i18n/useI18n'

export function ConsoleNav() {
  const { error, getNodePath, isLoading, modules, selectedModule, selectedNode } = useNavigation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const modulesRowRef = useRef<HTMLDivElement>(null)
  const itemsRowRef = useRef<HTMLDivElement>(null)
  const [indicatorLeft, setIndicatorLeft] = useState<number | null>(null)
  const [itemIndicatorLeft, setItemIndicatorLeft] = useState<number | null>(null)

  const activeModuleKey = selectedModule ? selectedModule.NetUid || String(selectedModule.Id) : null
  const activeNodeKey = selectedNode ? selectedNode.NetUid || String(selectedNode.Id) : null
  const items = selectedModule?.Children ?? []

  // Position each row's sliding dot under its active pill's centre (transitions
  // its `left` so the dot slides along the border when the active pill changes).
  useLayoutEffect(() => {
    function centreOfActive(row: HTMLDivElement | null, selector: string): number | null {
      const active = row?.querySelector<HTMLElement>(selector)

      return active ? active.offsetLeft + active.offsetWidth / 2 : null
    }

    function positionIndicators() {
      setIndicatorLeft(centreOfActive(modulesRowRef.current, '.console-subnav-module.is-active'))
      setItemIndicatorLeft(centreOfActive(itemsRowRef.current, '.console-subnav-item.is-active'))
    }

    positionIndicators()
    window.addEventListener('resize', positionIndicators)

    return () => window.removeEventListener('resize', positionIndicators)
  }, [activeModuleKey, activeNodeKey, modules, items])

  if (isLoading) {
    return <div className="console-subnav console-subnav-state">{t('Меню завантажується')}</div>
  }

  if (error) {
    return <div className="console-subnav console-subnav-state">{t('Меню недоступне')}</div>
  }

  if (modules.length === 0) {
    return null
  }

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
      <div ref={modulesRowRef} className="console-subnav-row console-subnav-modules">
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
        <span
          className="console-subnav-indicator"
          aria-hidden="true"
          style={{ left: indicatorLeft ?? 0, opacity: indicatorLeft == null ? 0 : 1 }}
        />
      </div>

      {items.length > 0 && (
        <div ref={itemsRowRef} className="console-subnav-row console-subnav-items">
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
          <span
            className="console-subnav-indicator console-subnav-indicator-item"
            aria-hidden="true"
            style={{ left: itemIndicatorLeft ?? 0, opacity: itemIndicatorLeft == null ? 0 : 1 }}
          />
        </div>
      )}
    </nav>
  )
}
