import { useCallback, useEffect, useState } from 'react'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { useAuth } from '../../auth/useAuth'
import { getExchangeRatesSnapshot } from '../api/exchangeRatesApi'
import type { ExchangeRatesSnapshot } from '../types'

type ExchangeRatesState = {
  data: ExchangeRatesSnapshot | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useExchangeRates(): ExchangeRatesState {
  const { session } = useAuth()
  const [state, setState] = useState<Omit<ExchangeRatesState, 'refresh'>>({
    data: null,
    isLoading: Boolean(session?.csrfToken),
    error: null,
  })

  const refresh = useCallback(async () => {
    if (!session?.csrfToken) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((current) => ({ ...current, isLoading: true, error: null }))

    try {
      const data = await getExchangeRatesSnapshot()
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: null, isLoading: false, error: error as Error })
    }
  }, [session?.csrfToken])

  const refreshFromRealtime = useCallback(() => {
    void refresh()
  }, [refresh])

  useRealtimeEvent(realtimeEvents.exchangeRateUpdated, refreshFromRealtime)
  useRealtimeEvent(realtimeEvents.crossExchangeRateUpdated, refreshFromRealtime)
  useRealtimeEvent(realtimeEvents.govExchangeRateUpdated, refreshFromRealtime)
  useRealtimeEvent(realtimeEvents.govCrossExchangeRateUpdated, refreshFromRealtime)

  useEffect(() => {
    if (!session?.csrfToken) {
      return undefined
    }

    let cancelled = false

    getExchangeRatesSnapshot()
      .then((data) => {
        if (!cancelled) {
          setState({ data, isLoading: false, error: null })
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ data: null, isLoading: false, error })
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.csrfToken])

  return {
    ...state,
    refresh,
  }
}
