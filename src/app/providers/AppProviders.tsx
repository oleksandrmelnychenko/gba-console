import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import 'dayjs/locale/uk'
import { BrowserRouter } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { RealtimeProvider } from '../../shared/realtime/RealtimeProvider'
import { theme } from '../../shared/theme/theme'
import './notifications.css'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <MantineProvider theme={theme}>
      <DatesProvider settings={{ firstDayOfWeek: 1, locale: 'uk', weekendDays: [0, 6] }}>
        <Notifications position="bottom-right" containerWidth={380} className="app-toasts" />
        <BrowserRouter>
          <I18nProvider>
            <AuthProvider>
              <RealtimeProvider>{children}</RealtimeProvider>
            </AuthProvider>
          </I18nProvider>
        </BrowserRouter>
      </DatesProvider>
    </MantineProvider>
  )
}
