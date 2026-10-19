import { HubConnectionState, type HubConnection } from '@microsoft/signalr'

type ManagedHubConnection = Pick<HubConnection, 'onclose' | 'start' | 'state' | 'stop'>

const startRetryDelays = [2_000, 5_000, 10_000, 30_000]

export function manageConnections<TConnection extends ManagedHubConnection>(
  connections: TConnection[],
  isDisposed: () => boolean,
  onStarted?: (connection: TConnection) => void,
): () => void {
  const retryTimers = new Set<ReturnType<typeof window.setTimeout>>()

  const clearRetryTimers = () => {
    retryTimers.forEach((timer) => window.clearTimeout(timer))
    retryTimers.clear()
  }

  const start = (connection: TConnection, retryCount = 0) =>
    startConnection(connection, isDisposed, retryCount, onStarted, retryTimers)

  const scheduleStart = (connection: TConnection, retryCount = 0) => {
    if (isDisposed()) {
      return
    }

    const timer = window.setTimeout(() => {
      retryTimers.delete(timer)
      void start(connection, retryCount)
    }, getStartRetryDelay(retryCount))

    retryTimers.add(timer)
  }

  const handleOnline = () => {
    connections.forEach((connection) => {
      if (connection.state === HubConnectionState.Disconnected) {
        void start(connection)
      }
    })
  }

  connections.forEach((connection) => {
    connection.onclose(() => {
      if (!isDisposed()) {
        scheduleStart(connection)
      }
    })

    void start(connection)
  })
  window.addEventListener('online', handleOnline)

  return () => {
    clearRetryTimers()
    window.removeEventListener('online', handleOnline)
    connections.forEach((connection) => {
      void connection.stop().catch(() => undefined)
    })
  }
}

async function startConnection<TConnection extends ManagedHubConnection>(
  connection: TConnection,
  isDisposed: () => boolean,
  retryCount: number,
  onStarted: ((connection: TConnection) => void) | undefined,
  retryTimers: Set<ReturnType<typeof window.setTimeout>>,
): Promise<void> {
  if (isDisposed()) {
    return
  }

  if (connection.state !== HubConnectionState.Disconnected) {
    return
  }

  try {
    await connection.start()
  } catch {
    if (isDisposed()) {
      return
    }

    const timer = window.setTimeout(() => {
      retryTimers.delete(timer)
      void startConnection(connection, isDisposed, retryCount + 1, onStarted, retryTimers)
    }, getStartRetryDelay(retryCount))
    retryTimers.add(timer)
    return
  }

  if (!isDisposed()) {
    onStarted?.(connection)
  }
}

function getStartRetryDelay(retryCount: number): number {
  if (!navigator.onLine) {
    return startRetryDelays[startRetryDelays.length - 1]
  }

  return startRetryDelays[retryCount] ?? startRetryDelays[startRetryDelays.length - 1]
}
