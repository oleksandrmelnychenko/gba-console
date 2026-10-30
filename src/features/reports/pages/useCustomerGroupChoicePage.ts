import { useEffect, useMemo, useRef, useState } from 'react'
import { searchCustomerGroupChoices, type CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
type Scope = { field: 1 | 4 | 8 | 9 | 10 | 21; query: string; ready: boolean; attempt: number }
type Page = { scope?: Scope; query: string; rows: CustomerGroupChoice[]; next: number; more: boolean; loading: boolean; failed: boolean }
const empty = (query: string): Page => ({ query, rows: [], next: 0, more: false, loading: false, failed: false })
export function useCustomerGroupChoicePage(field: 1 | 4 | 8 | 9 | 10 | 21, query: string, ready: boolean) {
  const [page, setPage] = useState<Page>(() => empty(query))
  const [attempt, setAttempt] = useState(0)
  const scope = useMemo(() => ({ field, query, ready, attempt }), [field, query, ready, attempt])
  const active = useRef<AbortController | null>(null)
  const fetching = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    active.current = controller; fetching.current = false
    if (!ready || field === 8) return () => controller.abort()
    fetching.current = true
    void searchCustomerGroupChoices(field, query, 0, controller.signal).then(rows => {
      if (!controller.signal.aborted) setPage({ scope, query, rows, next: rows.length, more: rows.length === 30 && !((field === 1 || field === 4 || field === 9 || field === 21) && query.startsWith('id:')), loading: false, failed: false })
    }).catch(() => {
      if (!controller.signal.aborted) setPage({ ...empty(query), scope, failed: true })
    }).finally(() => { if (!controller.signal.aborted) fetching.current = false })
    return () => controller.abort()
  }, [field, query, ready, scope])
  async function loadMore() {
    const controller = active.current
    if (field === 8 || !ready || page.scope !== scope || !page.more || page.next > 10000 || fetching.current || !controller || controller.signal.aborted) return
    fetching.current = true; setPage(current => ({ ...current, loading: true, failed: false }))
    try {
      const rows = await searchCustomerGroupChoices(field, query, page.next, controller.signal)
      if (!controller.signal.aborted) setPage(current => ({ scope, query,
        rows: [...new Map([...current.rows, ...rows].map(item => [item.Id, item])).values()],
        next: page.next + rows.length, more: rows.length === 30, loading: false, failed: false }))
    } catch {
      if (!controller.signal.aborted) setPage(current => ({ ...current, loading: false, failed: true }))
    } finally { if (!controller.signal.aborted) fetching.current = false }
  }
  const current = ready && field !== 8 ? page.scope === scope ? page : { ...empty(query), loading: true } : empty(query)
  return { ...current, loadMore, retry: () => setAttempt(value => value + 1) }
}
