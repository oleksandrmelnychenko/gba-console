import { useCallback, useRef } from 'react'

/** Shares an action's full lifetime, including validation and follow-up work.
 * Use one stable key per action when loading state is owned by a reducer or parent.
 * Repeated callers receive the pending result instead of running side effects again.
 */
export function useSingleFlight() {
  const pending = useRef(new Map<string, Promise<unknown>>())

  return useCallback(<T,>(key: string, action: () => Promise<T>): Promise<T> => {
    const existing = pending.current.get(key)
    if (existing) return existing as Promise<T>

    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
      .finally(() => { pending.current.delete(key) })
    pending.current.set(key, promise)

    // Install the promise before invoking the action: even a synchronous,
    // re-entrant call must see the lock. Do not defer browser event handling.
    try {
      resolve(action())
    } catch (error) {
      reject(error)
    }
    return promise
  }, [])
}
