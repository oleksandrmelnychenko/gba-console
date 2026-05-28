import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { theme } from '../../shared/theme/theme'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </MantineProvider>
  )
}
