import { useEffect, useState } from 'react'

// Each resource owns a single request. Cancellation also prevents an old filter response
// from replacing the new page; forms pause polling without losing their drafts.
export function useWorkdayResource<T>(load: (signal: AbortSignal) => Promise<T>, query: string, paused = false) {
  const [state, setState] = useState<{ query: string; data?: T; error?: string }>({ query: '' })
  useEffect(() => {
    if (paused) return
    const controller = new AbortController()
    let inFlight = false
    function refresh() {
      if (inFlight) return
      inFlight = true
      void load(controller.signal).then(
        (data) => { if (!controller.signal.aborted) setState({ query, data }) },
        (error: unknown) => { if (!controller.signal.aborted) setState({ query, error: error instanceof Error ? error.message : 'Не вдалося завантажити дані' }) },
      ).finally(() => { inFlight = false })
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    const timer = setInterval(refreshVisible, 60_000)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [load, query, paused])
  return { data: state.query === query ? state.data : undefined, error: state.query === query ? state.error : undefined, loading: state.query !== query }
}
