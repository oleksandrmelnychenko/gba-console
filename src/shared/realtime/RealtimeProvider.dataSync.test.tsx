import { notifications } from '@mantine/notifications'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import { I18nProvider } from '../i18n/I18nProvider'
import { clearDataSyncProgress, getDataSyncProgressSnapshot } from './dataSyncProgressStore'
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

const RUN_A = 'bbed73c2096b4463b13acab9e0beda37'
const RUN_B = '1d784e5a8845441ab451ba4aa00cb249'
const apiRequestMock = vi.mocked(apiRequest)

describe('RealtimeProvider data-sync channel', () => {
  beforeEach(() => {
    hub.connections.length = 0
    auth.canRunSync = true
    clearDataSyncProgress()
    vi.clearAllMocks()
    apiRequestMock.mockResolvedValue({ IsInProgress: false })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('does not raise the sticky sync error for a stage failure that the server retries', async () => {
    await renderProvider()

    emitDataSync({ DisplayMessage: '19.10.2026 11:51:22 - Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    emitDataSync({
      DisplayMessage: '19.10.2026 12:00:02 - Помилка синхронізації',
      IsError: true,
      IsTerminal: false,
      PipelineRunId: null,
      StopProgressBar: true,
    })
    emitDataSync({
      DisplayMessage: '19.10.2026 12:00:02 - Етап синхронізації перервано, автоматичний повтор через 60 с',
      IsTerminal: false,
      PipelineRunId: RUN_A,
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: true, isError: false })

    emitDataSync({
      DisplayMessage: '19.10.2026 12:09:33 - Синхронізацію завершено',
      IsTerminal: true,
      PipelineRunId: RUN_A,
      StopProgressBar: true,
    })

    expect(notifications.show).not.toHaveBeenCalled()
    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: false, isError: false })
  })

  it('keeps one sticky error per failed run and removes it when a later run starts', async () => {
    await renderProvider()

    emitDataSync({ DisplayMessage: '19.10.2026 12:00:02 - Помилка синхронізації', IsError: true, IsTerminal: false, StopProgressBar: true })
    emitDataSync({
      DisplayMessage: '19.10.2026 12:00:02 - Помилка синхронізації (DailySession.MasterData.Clients)',
      IsError: true,
      IsTerminal: true,
      PipelineRunId: RUN_A,
      StopProgressBar: true,
    })

    expect(notifications.show).toHaveBeenCalledTimes(1)
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
      autoClose: false,
      id: 'data-sync-error',
      title: 'Помилка синхронізації (DailySession.MasterData.Clients)',
    }))

    vi.mocked(notifications.hide).mockClear()
    emitDataSync({ DisplayMessage: '19.10.2026 12:30:00 - Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_B })

    expect(notifications.hide).toHaveBeenCalledWith('data-sync-error')
  })

  it('does not query the sync status for users without the sync permission', async () => {
    auth.canRunSync = false

    await renderProvider()

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('ignores a status answer requested before the run terminal arrived', async () => {
    let answerStatus: (value: unknown) => void = () => undefined
    apiRequestMock.mockImplementation(() => new Promise((resolve) => {
      answerStatus = resolve
    }))
    await renderProvider()

    emitDataSync({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    emitDataSync({ DisplayMessage: 'Синхронізацію завершено', IsTerminal: true, PipelineRunId: RUN_A, StopProgressBar: true })
    await act(async () => {
      answerStatus({ IsInProgress: true, PipelineRunId: RUN_A })
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({
      isActive: false,
      message: 'Синхронізацію завершено',
    })
  })

  it('reconciles the status again when the data-sync hub is started after a closed connection', async () => {
    vi.useFakeTimers()
    await renderProvider()
    const callsBeforeClose = apiRequestMock.mock.calls.length

    await act(async () => {
      dataSyncConnection().close()
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(dataSyncConnection().start).toHaveBeenCalledTimes(2)
    expect(apiRequestMock.mock.calls.length).toBeGreaterThan(callsBeforeClose)
    expect(apiRequestMock).toHaveBeenLastCalledWith('/data/sync/status', expect.objectContaining({ dedupe: false }))
  })

  it('rechecks a running sync every minute and clears it when the server is idle', async () => {
    vi.useFakeTimers()
    apiRequestMock.mockResolvedValue({ IsInProgress: true, PipelineRunId: RUN_A })
    await renderProvider()
    emitDataSync({ DisplayMessage: 'Синхронізацію розпочато', IsTerminal: false, PipelineRunId: RUN_A })
    apiRequestMock.mockResolvedValue({ IsInProgress: false })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(getDataSyncProgressSnapshot()).toMatchObject({ isActive: false, isError: false })
  })
})

async function renderProvider() {
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
}

function dataSyncConnection() {
  const connection = hub.connections.find((candidate) => candidate.url.endsWith('/hubs/data/sync'))

  if (!connection) {
    throw new Error('The data-sync hub connection was not created')
  }

  return connection
}

function emitDataSync(payload: Record<string, unknown>) {
  act(() => {
    dataSyncConnection().emit('ProcessNotificationMessage', JSON.stringify(payload))
  })
}
