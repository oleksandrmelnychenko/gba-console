import { HubConnectionState, type HubConnection, type RetryContext } from '@microsoft/signalr'

type ManagedHubConnection = Pick<HubConnection, 'onclose' | 'start' | 'state' | 'stop'>

/**
 * What to do when a hub start is rejected with 401 (the session was revoked or expired).
 * `snapshot` is read right before each start; `recover` gets it after the 401 and resolves
 * true when the session was renewed (retry now) or false when it is gone for good
 * (stop retrying — the auth layer has already signed the user out).
 */
export type HubAuthGuard<TSnapshot = unknown> = {
  snapshot: () => TSnapshot
  recover: (snapshot: TSnapshot) => Promise<boolean>
}

type ManageConnectionsOptions<TConnection, TSnapshot> = {
  auth?: HubAuthGuard<TSnapshot>
  onStarted?: (connection: TConnection) => void
}

const startRetryDelays = [2_000, 5_000, 10_000, 30_000]
const reconnectDelays = [0, 2_000, 5_000, 10_000, 30_000]

/**
 * SignalR automatic-reconnect policy. A 401 will not heal by retrying, so it ends the built-in
 * reconnect loop and hands the hub back to manageConnections, which refreshes the session once
 * or stops every hub when the session is gone.
 */
export function nextHubReconnectDelay(context: Pick<RetryContext, 'previousRetryCount' | 'retryReason'>): number | null {
  if (!navigator.onLine || isUnauthorizedHubError(context.retryReason)) {
    return null
  }

  return reconnectDelays[context.previousRetryCount] ?? reconnectDelays[reconnectDelays.length - 1]
}

export function manageConnections<TConnection extends ManagedHubConnection, TSnapshot = unknown>(
  connections: TConnection[],
  isDisposed: () => boolean,
  optionsOrOnStarted?: ManageConnectionsOptions<TConnection, TSnapshot> | ((connection: TConnection) => void),
): () => void {
  const options: ManageConnectionsOptions<TConnection, TSnapshot> = typeof optionsOrOnStarted === 'function'
    ? { onStarted: optionsOrOnStarted }
    : optionsOrOnStarted ?? {}
  const auth = options.auth
  const retryTimers = new Set<ReturnType<typeof window.setTimeout>>()
  let authLost = false
  const stopped = () => isDisposed() || authLost

  const clearRetryTimers = () => {
    retryTimers.forEach((timer) => window.clearTimeout(timer))
    retryTimers.clear()
  }

  const schedule = (connection: TConnection, retryCount: number) => {
    if (stopped()) {
      return
    }

    const timer = window.setTimeout(() => {
      retryTimers.delete(timer)
      void start(connection, retryCount + 1)
    }, getStartRetryDelay(retryCount))

    retryTimers.add(timer)
  }

  const start = async (connection: TConnection, retryCount = 0, afterRecovery = false): Promise<void> => {
    if (stopped() || connection.state !== HubConnectionState.Disconnected) {
      return
    }

    const snapshot = auth?.snapshot()

    try {
      await connection.start()
    } catch (error) {
      if (stopped()) {
        return
      }

      if (auth && isUnauthorizedHubError(error)) {
        if (afterRecovery) {
          // Still 401 right after a successful refresh: retrying would only spam negotiate.
          // The hub waits for the next `online` event or a new session (provider re-mount).
          return
        }

        let recovered: boolean

        try {
          recovered = await auth.recover(snapshot as TSnapshot)
        } catch {
          // The auth endpoint itself is unreachable: keep the normal back-off.
          schedule(connection, retryCount)
          return
        }

        if (!recovered) {
          authLost = true
          clearRetryTimers()
          return
        }

        await start(connection, 0, true)
        return
      }

      schedule(connection, retryCount)
      return
    }

    if (!stopped()) {
      options.onStarted?.(connection)
    }
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
      if (!stopped()) {
        schedule(connection, 0)
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

/** SignalR folds the negotiate status into the error message ("... Status code '401'"). */
export function isUnauthorizedHubError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  if ('statusCode' in error && (error as { statusCode?: unknown }).statusCode === 401) {
    return true
  }

  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''

  return /status code '401'|negotiate '401'|\b401\b.*unauthori[sz]ed|unauthori[sz]ed.*\b401\b/i.test(message)
}

function getStartRetryDelay(retryCount: number): number {
  if (!navigator.onLine) {
    return startRetryDelays[startRetryDelays.length - 1]
  }

  return startRetryDelays[retryCount] ?? startRetryDelays[startRetryDelays.length - 1]
}
