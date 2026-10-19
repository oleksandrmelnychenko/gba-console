import { HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manageConnections } from './hubConnectionManager'

type FakeConnection = Pick<HubConnection, 'onclose' | 'start' | 'state' | 'stop'> & {
  close: () => void
  failNextStart: () => void
}

describe('hub connection manager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports every successful start, including the restart after a closed connection', async () => {
    const connection = createConnection()
    const onStarted = vi.fn()
    const stop = manageConnections([connection], () => false, onStarted)

    await vi.advanceTimersByTimeAsync(0)
    connection.close()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(onStarted).toHaveBeenCalledTimes(2)
    stop()
  })

  it('does not retry a failed start after the connections were disposed', async () => {
    const connection = createConnection()
    connection.failNextStart()
    let disposed = false
    const stop = manageConnections([connection], () => disposed)

    await vi.advanceTimersByTimeAsync(0)
    disposed = true
    stop()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(connection.start).toHaveBeenCalledTimes(1)
  })
})

function createConnection(): FakeConnection {
  const closeHandlers: Array<(error?: Error) => void> = []
  let shouldFail = false
  const connection = {
    close: () => {
      connection.state = HubConnectionState.Disconnected
      closeHandlers.forEach((handler) => handler())
    },
    failNextStart: () => {
      shouldFail = true
    },
    onclose: (handler: (error?: Error) => void) => {
      closeHandlers.push(handler)
    },
    start: vi.fn(async () => {
      if (shouldFail) {
        shouldFail = false
        throw new Error('negotiation failed')
      }

      connection.state = HubConnectionState.Connected
    }),
    state: HubConnectionState.Disconnected,
    stop: vi.fn(async () => {
      connection.state = HubConnectionState.Disconnected
    }),
  }

  return connection
}
