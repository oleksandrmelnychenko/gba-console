import { AppShell } from '@mantine/core'
import { Outlet, useLocation } from 'react-router-dom'
import { NavigationProvider } from '../../features/navigation/NavigationProvider'
import { PageHeaderActionsProvider } from '../../shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleFooter } from './components/ConsoleFooter'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleMain } from './components/ConsoleMain'
import { NavigationRouteGuard } from './components/NavigationRouteGuard'
import { isBudgetCartRoute } from './layoutRoutes'
import './layout.css'

export function ConsoleLayout() {
  const { pathname } = useLocation()
  const showFooter = !isBudgetCartRoute(pathname)

  return (
    <NavigationProvider>
      <PageHeaderActionsProvider>
        <AppShell
          header={{ height: 108 }}
          footer={{ height: showFooter ? 36 : 0 }}
          padding={0}
        >
          <ConsoleHeader />
          <ConsoleMain>
            <NavigationRouteGuard>
              <Outlet />
            </NavigationRouteGuard>
          </ConsoleMain>
          {showFooter && <ConsoleFooter />}
        </AppShell>
      </PageHeaderActionsProvider>
    </NavigationProvider>
  )
}
