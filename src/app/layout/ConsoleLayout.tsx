import { AppShell } from '@mantine/core'
import { Outlet } from 'react-router-dom'
import { NavigationProvider } from '../../features/navigation/NavigationProvider'
import { ConsoleFooter } from './components/ConsoleFooter'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleMain } from './components/ConsoleMain'
import './layout.css'

export function ConsoleLayout() {
  return (
    <NavigationProvider>
      <AppShell
        header={{ height: 128 }}
        footer={{ height: 36 }}
        padding={0}
      >
        <ConsoleHeader />
        <ConsoleMain>
          <Outlet />
        </ConsoleMain>
        <ConsoleFooter />
      </AppShell>
    </NavigationProvider>
  )
}
