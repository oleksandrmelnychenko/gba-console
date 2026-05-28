import { useCallback, useSyncExternalStore } from 'react'

export function useElementClientWidth(element: HTMLElement | null) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!element) {
      return () => undefined
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', onStoreChange)
      return () => window.removeEventListener('resize', onStoreChange)
    }

    const observer = new ResizeObserver(onStoreChange)
    observer.observe(element)

    return () => observer.disconnect()
  }, [element])
  const getSnapshot = useCallback(() => element?.clientWidth ?? 0, [element])

  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
