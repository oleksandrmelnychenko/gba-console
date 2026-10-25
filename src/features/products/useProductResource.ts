import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type Snapshot<T> = { scope: object; value: T; loading: boolean; failed: boolean; error?: unknown }
type Request = { controller: AbortController; promise: Promise<void> }

/** Owns one product-scoped read, independent of other sections of the card. */
export function useProductResource<T>(netId: string | undefined, load: (id: string, signal?: AbortSignal) => Promise<T>, empty: T, fallbackError: string) {
  const scope = useMemo(() => ({ netId, load }), [netId, load])
  const currentScope = useRef(scope)
  const requestRef = useRef<Request | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ scope, value: empty, loading: Boolean(netId), failed: false })

  useLayoutEffect(() => {
    currentScope.current = scope
    return () => { controllerRef.current?.abort() }
  }, [scope])

  const refresh = useCallback((replacePending = false): Promise<void> => {
    if (!netId || currentScope.current !== scope) return Promise.resolve()
    const pending = requestRef.current
    if (!replacePending && pending && !pending.controller.signal.aborted) return pending.promise
    pending?.controller.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const request: Request = { controller, promise: Promise.resolve() }
    requestRef.current = request
    const isCurrent = () => currentScope.current === scope && !controller.signal.aborted
    setSnapshot(previous => previous.scope === scope
      ? { ...previous, loading: true }
      : { scope, value: empty, loading: true, failed: false })
    request.promise = load(netId, controller.signal).then(value => {
      if (isCurrent()) setSnapshot({ scope, value, loading: false, failed: false })
    }).catch((error: unknown) => {
      if (isCurrent()) setSnapshot(previous => ({ ...previous, loading: false, failed: true, error }))
    }).finally(() => {
      if (requestRef.current === request) requestRef.current = null
    })
    return request.promise
  }, [netId, load, empty, scope])

  useEffect(() => {
    void refresh()
    return () => { controllerRef.current?.abort() }
  }, [refresh])

  const setValue = useCallback((value: T) => {
    if (currentScope.current !== scope) return
    // A saved snapshot supersedes reads started before the save. Old drawer
    // callbacks also retain their original scope, including across A-B-A.
    requestRef.current?.controller.abort()
    requestRef.current = null
    setSnapshot({ scope, value, loading: false, failed: false })
  }, [scope])

  const current = snapshot.scope === scope ? snapshot : null
  return {
    value: current?.value ?? empty,
    isLoading: current?.loading ?? Boolean(netId),
    error: current?.failed ? (current.error instanceof Error && current.error.message.trim() ? current.error.message : fallbackError) : null,
    refresh,
    setValue,
  }
}
