import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'

/** A loading state with a synchronous lock for event handlers.
 * Call tryStart before starting work and setBusy(false) in finally.
 * React state alone cannot reject a second submission before the next render.
 */
export function useBusyState(): [boolean, Dispatch<SetStateAction<boolean>>, () => boolean] {
  const busyRef = useRef(false)
  const [busy, updateBusy] = useState(false)

  const setBusy = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    const value = typeof next === 'function' ? next(busyRef.current) : next
    busyRef.current = value
    updateBusy(value)
  }, [])

  const tryStart = useCallback(() => {
    if (busyRef.current) {
      return false
    }

    setBusy(true)
    return true
  }, [setBusy])

  return [busy, setBusy, tryStart]
}
