import { notifications } from '@mantine/notifications'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import { I18nProvider } from '../i18n/I18nProvider'
import { RealtimeProvider } from './RealtimeProvider'

const hub = vi.hoisted(() => {
  class FakeHubConnection {
    readonly handlers = new Map<string, (payload: unknown) => void>()
    readonly closeHandlers: Array<() => void> = []
    readonly reconnectedHandlers: Array<() => void> = []
    keepAliveIntervalInMilliseconds = 0
    serverTimeoutInMilliseconds = 0
    state = 'Disconnected'
    readonly url: string

    constructor(url: string) {
      this.url = url
    }

    on(name: string, handler: (payload: unknown) => void) {
      this.handlers.set(name, handler)
    }

    onclose(handler: () => void) {
      this.closeHandlers.push(handler)
    }

    onreconnected(handler: () => void) {
      this.reconnectedHandlers.push(handler)
    }

    start = vi.fn(async () => {
      this.state = 'Connected'
    })

    stop = vi.fn(async () => {
      this.state = 'Disconnected'
    })

    emit(name: string, payload: unknown) {
      this.handlers.get(name)?.(payload)
    }

    close() {
      this.state = 'Disconnected'
      this.closeHandlers.forEach((handler) => handler())
    }
  }

  return { FakeHubConnection, connections: [] as FakeHubConnection[] }
})

const auth = vi.hoisted(() => ({ canRunSync: true }))

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    private url = ''

    withUrl(url: string) {
      this.url = url
      return this
    }

    withAutomaticReconnect() {
      return this
    }

    configureLogging() {
      return this
    }

    build() {
      const connection = new hub.FakeHubConnection(this.url)
      hub.connections.push(connection)
      return connection
    }
  }

  return {
    HttpTransportType: { LongPolling: 4, None: 0, ServerSentEvents: 2, WebSockets: 1 },
    HubConnectionBuilder,
    HubConnectionState: {
      Connected: 'Connected',
      Connecting: 'Connecting',
      Disconnected: 'Disconnected',
      Disconnecting: 'Disconnecting',
      Reconnecting: 'Reconnecting',
    },
    LogLevel: { Warning: 3 },
  }
})

vi.mock('@mantine/notifications', () => ({
  notifications: { hide: vi.fn(), show: vi.fn() },
}))

vi.mock('../api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => auth.canRunSync,
    isAuthenticated: true,
    isLoading: false,
    session: { userNetUid: 'operator' },
    user: { NetUid: 'operator' },
  }),
}))

/* WH2-20 / C2-09: the payment-task toast shows «Оплатити до» as dd.MM.yyyy, never the raw ISO timestamp. */
describe('RealtimeProvider payment-task toast', () => {
  beforeEach(() => {
    hub.connections.length = 0
    auth.canRunSync = false
    vi.clearAllMocks()
    vi.mocked(apiRequest).mockResolvedValue({ IsInProgress: false })
    window.history.replaceState(null, '', '/accounting/payment-tasks')
  })

  afterEach(() => {
    cleanup()
  })

  it('formats the pay-to date of a pushed payment task', async () => {
    render(
      <I18nProvider>
        <RealtimeProvider>
          <div />
        </RealtimeProvider>
      </I18nProvider>,
    )
    await act(async () => {
      await Promise.resolve()
    })

    const supplyConnection = hub.connections.find((candidate) => candidate.url.endsWith('/hubs/supplies/orders'))
    expect(supplyConnection).toBeTruthy()

    act(() => {
      supplyConnection!.emit('NewPaymentTask', JSON.stringify({
        OrganisationName: 'QA ТОВ Тест Україна',
        PayToDate: '2026-11-20T00:00:00',
        PaymentForm: 'Безготівкова',
      }))
    })

    expect(notifications.show).toHaveBeenCalledTimes(1)
    const { message, title } = vi.mocked(notifications.show).mock.calls[0][0] as { message: string; title: string }
    expect(title).toBe('Нова платіжна задача')
    expect(message).toContain('20.11.2026')
    expect(message).not.toContain('2026-11-20')
    expect(message).not.toContain('T00:00')
  })
})
