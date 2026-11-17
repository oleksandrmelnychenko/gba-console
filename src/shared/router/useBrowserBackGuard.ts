import { useEffect, useId, useLayoutEffect, useRef } from 'react'

const GUARD_KEY = '__gbaBackGuard'
let activeMarker: string | null = null

function readMarker(state: unknown): string | null {
  return state && typeof state === 'object' && GUARD_KEY in state
    ? String((state as Record<string, unknown>)[GUARD_KEY])
    : null
}

/**
 * Keeps the browser Back button from silently leaving a modal workflow (the app uses a BrowserRouter,
 * so router blockers are not available). While `active`, an extra history entry with the same URL is
 * kept on top; Back consumes it, the entry is restored and `onBack` decides (e.g. «Закрити вікно?»).
 * When the workflow closes itself, the extra entry is removed again.
 */
export function useBrowserBackGuard(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack)
  const id = useId()

  useLayoutEffect(() => {
    onBackRef.current = onBack
  })

  useEffect(() => {
    if (!active) {
      return
    }

    const marker = `back-guard-${id}`
    activeMarker = marker

    const pushSentinel = (state: unknown) => {
      const base = state && typeof state === 'object' ? state : {}
      window.history.pushState({ ...base, [GUARD_KEY]: marker }, '', window.location.href)
    }

    if (readMarker(window.history.state) !== marker) {
      pushSentinel(window.history.state)
    }

    const handlePopState = (event: PopStateEvent) => {
      if (readMarker(event.state) === marker) {
        return
      }

      pushSentinel(event.state)
      onBackRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (activeMarker === marker) {
        activeMarker = null
      }

      // A development StrictMode remount re-activates the same marker before this runs.
      window.setTimeout(() => {
        if (activeMarker !== marker && readMarker(window.history.state) === marker) {
          window.history.back()
        }
      }, 0)
    }
  }, [active, id])
}
