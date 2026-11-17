import { Burger, Drawer, NavLink, ScrollArea } from '@mantine/core'
import { useState } from 'react'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useGuardedNavigate } from '../../../shared/router/navigationGuard'

const nodeKey = (node: NavigationModule | NavigationNode) => node.NetUid || String(node.Id)

/**
 * Main menu for widths where the header's module row is hidden (≤ 48em). It lists the same
 * permission-filtered modules and sub-items as the desktop nav and closes once a page is picked.
 */
export function ConsoleNavDrawer() {
  const { t } = useI18n()
  const navigate = useGuardedNavigate()
  const { getNodePath, isLoading, visibleModules, selectedModule, selectedNode } = useNavigation()
  const [opened, setOpened] = useState(false)
  const activeModuleKey = selectedModule ? nodeKey(selectedModule) : null
  const activeNodeKey = selectedNode ? nodeKey(selectedNode) : null
  const label = t('Меню')

  function openNode(module: NavigationModule, node: NavigationNode) {
    setOpened(false)
    navigate(getNodePath(node), { state: { nodeTitle: node.Module, moduleTitle: module.Module } })
  }

  return (
    <>
      <Burger
        aria-label={label}
        aria-expanded={opened}
        className="console-header-burger"
        disabled={isLoading || visibleModules.length === 0}
        opened={opened}
        size="sm"
        title={label}
        onClick={() => setOpened((current) => !current)}
      />
      <Drawer
        className="console-nav-drawer"
        opened={opened}
        padding="sm"
        scrollAreaComponent={ScrollArea.Autosize}
        size="min(320px, 85vw)"
        title={label}
        onClose={() => setOpened(false)}
      >
        <nav aria-label={t('Навігація')}>
          {visibleModules.map((module) => {
            const moduleKey = nodeKey(module)

            return (
              <NavLink
                key={moduleKey}
                active={moduleKey === activeModuleKey}
                childrenOffset={12}
                defaultOpened={moduleKey === activeModuleKey}
                label={module.Module}
                variant="subtle"
              >
                {module.Children.map((node) => {
                  const key = nodeKey(node)
                  const active = key === activeNodeKey

                  return (
                    <NavLink
                      key={key}
                      active={active}
                      aria-current={active ? 'page' : undefined}
                      component="button"
                      label={getNodePath(node) === '/reports/stocks' ? t('Каталог') : node.Module}
                      type="button"
                      onClick={() => openNode(module, node)}
                    />
                  )
                })}
              </NavLink>
            )
          })}
        </nav>
      </Drawer>
    </>
  )
}
