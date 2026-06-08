import { AppShell } from '@mantine/core'
import { Outlet } from 'react-router-dom'
import { NavigationProvider } from '../../features/navigation/NavigationProvider'
import { PageHeaderActionsProvider } from '../../shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleFooter } from './components/ConsoleFooter'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleMain } from './components/ConsoleMain'
import { NavigationRouteGuard } from './components/NavigationRouteGuard'
import './layout.css'

export function ConsoleLayout() {
  return (
    <NavigationProvider>
      <PageHeaderActionsProvider>
        <AppShell
          header={{ height: 94 }}
          footer={{ height: 36 }}
          padding={0}
        >
          <ConsoleHeader />
          <ConsoleMain>
            <NavigationRouteGuard>
              <Outlet />
            </NavigationRouteGuard>
          </ConsoleMain>
          <ConsoleFooter />
        </AppShell>
      </PageHeaderActionsProvider>
    </NavigationProvider>
  )
}
