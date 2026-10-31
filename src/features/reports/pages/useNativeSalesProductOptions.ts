import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchNativeSalesProducts, type NativeSalesProduct } from '../api/nativeSalesProductLookup'
import { positiveProductId } from '../data/salesProductLookupCapability'
export type ProductSearchMode = 'text' | 'id'
type LookupScope = { enabled: boolean; mode: ProductSearchMode; query: string }
type PageState = {
  scope: LookupScope
  items: NativeSalesProduct[]
  next: number
  more: boolean
  loading: boolean
  error?: string
  restart?: boolean
}
const EMPTY: NativeSalesProduct[] = []
export function useNativeSalesProductOptions(mode: ProductSearchMode, query: string, enabled: boolean) {
  const normalizedQuery = mode === 'id' ? query : query.trim()
  const scope = useMemo(() => ({ enabled, mode, query: normalizedQuery }), [enabled, mode, normalizedQuery])
  const sequence = useRef(0),
    controller = useRef<AbortController | null>(null),
    busy = useRef<LookupScope | null>(null)
  const [state, setState] = useState<PageState | null>(null)
  const invalid = mode === 'id' && !positiveProductId(query)
  const fetchPage = useCallback(
    (offset: number, append: boolean) => {
      if (append && busy.current === scope) return
      busy.current = scope
      controller.current?.abort()
      const request = new AbortController(),
        token = ++sequence.current
      controller.current = request
      void searchNativeSalesProducts(
        mode === 'id' ? { exactId: query, offset: 0, limit: 30 } : { value: query, offset, limit: 30 },
        request.signal,
      )
        .then((items) => {
          if (request.signal.aborted || sequence.current !== token) return
          setState((previous) => {
            const retained = append && previous?.scope === scope ? previous.items : []
            if (items.some((item) => retained.some((old) => old.Id === item.Id)))
              return {
                scope,
                items: retained,
                next: 0,
                more: false,
                loading: false,
                restart: true,
                error: 'Список змінився. Повторіть пошук.',
              }
            return {
              scope,
              items: [...retained, ...items],
              next: offset + items.length,
              more: mode === 'text' && items.length === 30 && offset + items.length <= 10000,
              loading: false,
            }
          })
        })
        .catch(() => {
          if (!request.signal.aborted && sequence.current === token)
            setState((previous) => ({
              scope,
              items: previous?.scope === scope ? previous.items : [],
              next: offset,
              more: false,
              loading: false,
              error: 'Не вдалося завантажити товари. Повторіть спробу.',
            }))
        })
        .finally(() => {
          if (sequence.current === token) busy.current = null
        })
    },
    [mode, query, scope],
  )
  useEffect(() => {
    sequence.current++
    controller.current?.abort()
    if (!enabled || invalid) return
    void fetchPage(0, false)
    return () => {
      controller.current?.abort()
    }
  }, [enabled, invalid, fetchPage])
  const current = state?.scope === scope ? state : null
  return {
    items: enabled && !invalid ? (current?.items ?? EMPTY) : EMPTY,
    loading: enabled && !invalid && (!current || current.loading),
    error: current?.error,
    invalid,
    more: enabled && !invalid ? (current?.more ?? false) : false,
    loadMore: () => {
      if (enabled && !invalid && current?.more && !current.loading) {
        setState({ ...current, more: false, loading: true, error: undefined })
        void fetchPage(current.next, true)
      }
    },
    retry: () => {
      if (enabled && !invalid && current && !current.loading) {
        setState({ ...current, more: false, loading: true, error: undefined })
        void fetchPage(current.restart ? 0 : current.next, !current.restart && !!current.items.length)
      }
    },
  }
}
