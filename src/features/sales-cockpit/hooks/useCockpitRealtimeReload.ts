import { useCallback, useEffect, useRef } from 'react'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'

const RELOAD_DEBOUNCE_MS = 180

export function useCockpitRealtimeReload(onReload: () => void): () => void {
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const scheduleReload = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onReload()
    }, RELOAD_DEBOUNCE_MS)
  }, [onReload])

  useRealtimeEvent(realtimeEvents.salesCockpitTasksChanged, scheduleReload)

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    },
    [],
  )

  return scheduleReload
}
