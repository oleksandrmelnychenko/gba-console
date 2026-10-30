import { useEffect, useMemo, useRef, useState } from 'react'
import { searchCustomerGroupTop } from '../api/customerGroupTopApi'
type Scope = { query: string; ready: boolean; attempt: number }
type Page = { scope?: Scope; query: string; rows: string[]; next: number; more: boolean; loading: boolean; failed: boolean }
const empty = (query: string): Page => ({ query, rows: [], next: 0, more: false, loading: false, failed: false })
export function useCustomerGroupTopPage(query: string, ready: boolean) {
  const [page, setPage] = useState<Page>(() => empty(query))
  const [attempt, setAttempt] = useState(0)
  const scope = useMemo(() => ({ query, ready, attempt }), [query, ready, attempt])
  const active = useRef<AbortController | null>(null)
  const fetching = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    active.current = controller; fetching.current = false
    if (!ready) return () => controller.abort()
    fetching.current = true
    void searchCustomerGroupTop(query, 0, controller.signal).then(rows => {
      if (!controller.signal.aborted) setPage({ scope, query, rows, next: rows.length, more: rows.length === 30, loading: false, failed: false })
    }).catch(() => {
      if (!controller.signal.aborted) setPage({ ...empty(query), scope, failed: true })
    }).finally(() => { if (!controller.signal.aborted) fetching.current = false })
    return () => controller.abort()
  }, [query, ready, scope])
  async function loadMore() {
    const controller = active.current
    if (!ready || page.scope !== scope || !page.more || page.next > 10000 || fetching.current || !controller || controller.signal.aborted) return
    fetching.current = true; setPage(current => ({ ...current, loading: true, failed: false }))
    try {
      const rows = await searchCustomerGroupTop(query, page.next, controller.signal)
      if (!controller.signal.aborted) setPage(current => ({ scope, query,
        rows: [...new Set([...current.rows, ...rows])],
        next: page.next + rows.length, more: rows.length === 30, loading: false, failed: false }))
    } catch {
      if (!controller.signal.aborted) setPage(current => ({ ...current, loading: false, failed: true }))
    } finally { if (!controller.signal.aborted) fetching.current = false }
  }
  const current = ready ? page.scope === scope ? page : { ...empty(query), loading: true } : empty(query)
  return { ...current, loadMore, retry: () => setAttempt(value => value + 1) }
}
