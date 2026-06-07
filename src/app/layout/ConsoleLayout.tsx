import { AppShell } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from 'react-router-dom'
import { NavigationProvider } from '../../features/navigation/NavigationProvider'
import { ConsoleFooter } from './components/ConsoleFooter'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleMain } from './components/ConsoleMain'
import { ConsoleSidebar } from './components/ConsoleSidebar'
import './layout.css'

export function ConsoleLayout() {
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false)

  return (
    <NavigationProvider>
      <AppShell
        header={{ height: 60 }}
        footer={{ height: 36 }}
        navbar={{
          width: 210,
          breakpoint: 'sm',
          collapsed: { desktop: !navOpened, mobile: !navOpened },
        }}
        padding={0}
      >
        <ConsoleHeader navOpened={navOpened} onToggleNav={toggleNav} />
        <ConsoleSidebar onItemClick={closeNav} />
        <ConsoleMain>
          <Outlet />
        </ConsoleMain>
        <ConsoleFooter />
      </AppShell>
    </NavigationProvider>
  )
}
