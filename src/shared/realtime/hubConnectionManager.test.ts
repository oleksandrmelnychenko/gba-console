import { HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isUnauthorizedHubError, manageConnections, nextHubReconnectDelay } from './hubConnectionManager'

type FakeConnection = Pick<HubConnection, 'onclose' | 'start' | 'state' | 'stop'> & {
  close: () => void
  failNextStart: (error?: Error) => void
  failStartsWith: (error: Error) => void
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

  it('stops retrying every hub once the session cannot be refreshed after a 401', async () => {
    const connections = [createConnection(), createConnection()]
    connections.forEach((connection) => connection.failStartsWith(unauthorizedError()))
    const recover = vi.fn(async () => false)
    const stop = manageConnections(connections, () => false, { auth: { snapshot: () => 'exp-1', recover } })

    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(recover).toHaveBeenCalledWith('exp-1')
    connections.forEach((connection) => expect(connection.start).toHaveBeenCalledTimes(1))
    stop()
  })

  it('restarts a hub right after the session was refreshed', async () => {
    const connection = createConnection()
    connection.failNextStart(unauthorizedError())
    const onStarted = vi.fn()
    const stop = manageConnections([connection], () => false, {
      auth: { snapshot: () => undefined, recover: async () => true },
      onStarted,
    })

    await vi.advanceTimersByTimeAsync(0)

    expect(connection.start).toHaveBeenCalledTimes(2)
    expect(onStarted).toHaveBeenCalledOnce()
    stop()
  })

  it('does not loop on 401 when a refreshed session is still rejected', async () => {
    const connection = createConnection()
    connection.failStartsWith(unauthorizedError())
    const recover = vi.fn(async () => true)
    const stop = manageConnections([connection], () => false, { auth: { snapshot: () => undefined, recover } })

    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(recover).toHaveBeenCalledOnce()
    expect(connection.start).toHaveBeenCalledTimes(2)
    stop()
  })

  it('keeps the normal back-off for non-auth failures', async () => {
    const connection = createConnection()
    connection.failNextStart()
    const recover = vi.fn(async () => false)
    const stop = manageConnections([connection], () => false, { auth: { snapshot: () => undefined, recover } })

    await vi.advanceTimersByTimeAsync(2_000)

    expect(recover).not.toHaveBeenCalled()
    expect(connection.start).toHaveBeenCalledTimes(2)
    stop()
  })

  it('ends the built-in SignalR reconnect loop on 401 but keeps it for other failures', () => {
    expect(nextHubReconnectDelay({ previousRetryCount: 3, retryReason: unauthorizedError() })).toBeNull()
    expect(nextHubReconnectDelay({ previousRetryCount: 1, retryReason: new Error('WebSocket closed with status code: 1006') })).toBe(2_000)
  })

  it('recognises the SignalR negotiate 401 messages', () => {
    expect(isUnauthorizedHubError(unauthorizedError())).toBe(true)
    expect(isUnauthorizedHubError(new Error("Failed to complete negotiation with the server: Error: Unexpected status code returned from negotiate '401'"))).toBe(true)
    expect(isUnauthorizedHubError(new Error("Failed to complete negotiation with the server: Error: : Status code '503'"))).toBe(false)
  })
})

function unauthorizedError(): Error {
  return new Error("Failed to complete negotiation with the server: Error: Unauthorized: Status code '401'")
}

function createConnection(): FakeConnection {
  const closeHandlers: Array<(error?: Error) => void> = []
  let nextFailure: Error | null = null
  let permanentFailure: Error | null = null
  const connection = {
    close: () => {
      connection.state = HubConnectionState.Disconnected
      closeHandlers.forEach((handler) => handler())
    },
    failNextStart: (error = new Error('negotiation failed')) => {
      nextFailure = error
    },
    failStartsWith: (error: Error) => {
      permanentFailure = error
    },
    onclose: (handler: (error?: Error) => void) => {
      closeHandlers.push(handler)
    },
    start: vi.fn(async () => {
      if (permanentFailure) {
        throw permanentFailure
      }

      if (nextFailure) {
        const error = nextFailure
        nextFailure = null
        throw error
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
