import { Skeleton } from '@mantine/core'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { useI18n } from '../../../shared/i18n/useI18n'

type ConsoleNavMode = 'all' | 'items' | 'modules'

// When a top-level module is opened, prefer landing on one of these routes if the
// module contains it (e.g. «Продажі» → Продажі Україна, «Замовлення» → Замовлення
// на Україну), instead of the alphabetically-first child. Route-keyed so it does
// not depend on backend menu labels; falls back to the first child otherwise.
const PREFERRED_MODULE_DEFAULT_ROUTES = ['/sales/ukraine/all', '/orders/ukraine/all']

// Pill-width pattern for the loading shimmer (varied so it reads as real nav).
const MODULE_SKELETON_WIDTHS = [109, 132, 92, 123, 101, 140]
const ITEM_SKELETON_WIDTHS = [123, 98, 146, 115, 132]

function findNodeByPath(
  nodes: NavigationNode[],
  targetPath: string,
  resolvePath: (node: NavigationNode) => string,
): NavigationNode | null {
  for (const node of nodes) {
    if (resolvePath(node) === targetPath) {
      return node
    }

    const child = findNodeByPath(node.Children ?? [], targetPath, resolvePath)

    if (child) {
      return child
    }
  }

  return null
}

function findPreferredDefaultNode(
  nodes: NavigationNode[],
  resolvePath: (node: NavigationNode) => string,
): NavigationNode | null {
  for (const path of PREFERRED_MODULE_DEFAULT_ROUTES) {
    const match = findNodeByPath(nodes, path, resolvePath)

    if (match) {
      return match
    }
  }

  return null
}

type ConsoleNavProps = {
  mode?: ConsoleNavMode
}

export function ConsoleNav({ mode = 'all' }: ConsoleNavProps) {
  const { error, getNodePath, isLoading, modules, selectedModule, selectedNode } = useNavigation()
  const navigate = useNavigate()
  const { t } = useI18n()

  const activeModuleKey = selectedModule ? selectedModule.NetUid || String(selectedModule.Id) : null
  const activeNodeKey = selectedNode ? selectedNode.NetUid || String(selectedNode.Id) : null
  const items = useMemo(() => selectedModule?.Children ?? [], [selectedModule])

  if (mode === 'items' && selectedModule == null) {
    return null
  }

  if (isLoading) {
    return (
      <nav className={`console-subnav console-subnav-mode-${mode}`} aria-busy="true" aria-label={t('Навігація')}>
        {mode !== 'items' && (
          <div className="console-subnav-row console-subnav-modules">
            {MODULE_SKELETON_WIDTHS.map((width, index) => (
              <Skeleton key={index} className="console-subnav-skeleton" height={20} radius="xl" width={width} />
            ))}
          </div>
        )}
        {mode !== 'modules' && (
          <div className="console-subnav-row console-subnav-items">
            {ITEM_SKELETON_WIDTHS.map((width, index) => (
              <Skeleton key={index} className="console-subnav-skeleton" height={20} radius="xl" width={width} />
            ))}
          </div>
        )}
      </nav>
    )
  }

  if (error) {
    return <div className="console-subnav console-subnav-state">{t('Меню недоступне')}</div>
  }

  if (modules.length === 0) {
    return null
  }

  function openModule(module: NavigationModule) {
    const target = findPreferredDefaultNode(module.Children, getNodePath) ?? module.Children[0]

    if (target) {
      navigate(getNodePath(target), { state: { nodeTitle: target.Module, moduleTitle: module.Module } })
    }
  }

  function openNode(node: NavigationNode) {
    navigate(getNodePath(node), { state: { nodeTitle: node.Module, moduleTitle: selectedModule?.Module } })
  }

  return (
    <nav className={`console-subnav console-subnav-mode-${mode}`} aria-label={t('Навігація')}>
      {mode !== 'items' ? (
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
      ) : null}

      {mode !== 'modules' && items.length > 0 && (
        <div className="console-subnav-row console-subnav-items">
          {items.map((node) => {
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
                <span>{node.Module}</span>
              </button>
            )
          })}
        </div>
      )}
    </nav>
  )
}
