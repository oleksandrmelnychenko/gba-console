import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { priceFilterQueryError, searchNativePriceFilters, type NativePriceFilterOption, type NativePriceFilterQuery } from '../api/nativePriceFilterLookup'
export type PriceFilterSearchMode = 'text' | 'exact'
type Scope = { source: number; field: number; mode: PriceFilterSearchMode; query: string; from: string; to: string; enabled: boolean; condition: number }
type Page = { scope: Scope; items: NativePriceFilterOption[]; next: number; more: boolean; loading: boolean; error?: string; restart?: boolean }
const EMPTY: NativePriceFilterOption[] = []
export function useNativePriceFilterOptions(source: number, field: number, mode: PriceFilterSearchMode, query: string, enabled: boolean, from = '', to = '', condition = 0) {
  const doc = field === 12 || field === 14, periodFrom = doc ? from : '', periodTo = doc ? to : ''
  const scope = useMemo(() => ({ source, field, mode, query, enabled, condition, from: periodFrom, to: periodTo }), [source, field, mode, query, enabled, periodFrom, periodTo, condition])
  const sequence = useRef(0), controller = useRef<AbortController | null>(null), busy = useRef<Scope | null>(null)
  const [state, setState] = useState<Page | null>(null)
  const parameters = useCallback((offset: number): NativePriceFilterQuery => ({
    ...(mode === 'text' ? { value: query } : field === 3 ? { exactValue: query } : { exactId: query }),
    ...(doc ? { from: periodFrom, to: periodTo } : {}), offset, limit: 30,
  }), [doc, field, mode, query, periodFrom, periodTo])
  const queryError = [0, 1, 2, 4].includes(condition) ? priceFilterQueryError(source, field, parameters(0)) : 'Оберіть одну з чотирьох умов відбору.'
  const fetchPage = useCallback((offset: number, append: boolean) => {
    if (append && busy.current === scope) return
    busy.current = scope
    controller.current?.abort()
    const request = new AbortController(), token = ++sequence.current
    controller.current = request
    void searchNativePriceFilters(source, field, parameters(offset), request.signal).then(items => {
      if (request.signal.aborted || token !== sequence.current) return
      setState(previous => {
        const retained = append && previous?.scope === scope ? previous.items : []
        if (items.some(item => retained.some(old => old.Id === item.Id))) return { scope, items: retained, next: 0, more: false, loading: false, restart: true, error: 'Список змінився. Повторіть пошук.' }
        return { scope, items: [...retained, ...items], next: offset + items.length, more: mode === 'text' && items.length === 30 && offset + items.length <= 10000, loading: false }
      })
    }).catch(() => {
      if (request.signal.aborted || token !== sequence.current) return
      setState(previous => ({ scope, items: previous?.scope === scope ? previous.items : [], next: offset, more: false, loading: false, error: 'Не вдалося завантажити довідник. Повторіть спробу.' }))
    }).finally(() => { if (token === sequence.current) busy.current = null })
  }, [field, mode, parameters, scope, source])
  useEffect(() => {
    sequence.current++
    controller.current?.abort()
    if (!enabled || queryError) return
    fetchPage(0, false)
    return () => { controller.current?.abort() }
  }, [enabled, queryError, fetchPage])
  const current = state?.scope === scope ? state : null
  const canLoad = enabled && !queryError
  return {
    items: canLoad ? current?.items ?? EMPTY : EMPTY, loading: !!canLoad && (!current || current.loading),
    error: canLoad ? current?.error : undefined, queryError, more: !!canLoad && !!current?.more,
    loadMore: () => {
      if (!canLoad || !current?.more || current.loading) return
      setState({ ...current, more: false, loading: true, error: undefined })
      fetchPage(current.next, true)
    },
    retry: () => {
      if (!canLoad || !current || current.loading) return
      setState({ ...current, more: false, loading: true, error: undefined })
      fetchPage(current.restart ? 0 : current.next, !current.restart && !!current.items.length)
    },
  }
}
