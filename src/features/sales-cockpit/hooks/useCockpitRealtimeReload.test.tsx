import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { realtimeBus, realtimeEvents } from '../../../shared/realtime/events'
import { useCockpitRealtimeReload } from './useCockpitRealtimeReload'

describe('useCockpitRealtimeReload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces realtime invalidations into one reload', () => {
    const onReload = vi.fn()
    renderHook(() => useCockpitRealtimeReload(onReload))

    act(() => {
      realtimeBus.emit(realtimeEvents.salesCockpitTasksChanged, { ChangedAtUtc: new Date().toISOString() })
      realtimeBus.emit(realtimeEvents.salesCockpitTasksChanged, { ChangedAtUtc: new Date().toISOString() })
      vi.advanceTimersByTime(180)
    })

    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('cancels a scheduled reload on unmount', () => {
    const onReload = vi.fn()
    const { unmount } = renderHook(() => useCockpitRealtimeReload(onReload))

    act(() => {
      realtimeBus.emit(realtimeEvents.salesCockpitTasksChanged, {})
      unmount()
      vi.runAllTimers()
    })

    expect(onReload).not.toHaveBeenCalled()
  })
})
