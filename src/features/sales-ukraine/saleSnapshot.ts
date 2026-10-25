import type { SalesUkraineSale } from './types'

function saleKey(sale: SalesUkraineSale): string | null {
  return sale.NetUid ? `net:${sale.NetUid}` : sale.Id != null ? `id:${sale.Id}` : null
}

// API snapshots are acyclic JSON. Other objects (e.g. Dates) retain the fresh value.
// Compare every field, including fields not currently displayed: permissions and
// subsequent actions must always receive the complete latest server snapshot.
function shareJson(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next
  const array = Array.isArray(next)
  if (Array.isArray(previous) !== array) return next
  if (!array && (Object.getPrototypeOf(previous) !== Object.prototype || Object.getPrototypeOf(next) !== Object.prototype)) return next
  const before = previous as Record<string, unknown>
  const after = next as Record<string, unknown>
  const keys = Object.keys(after)
  const shared = (array ? [...next as unknown[]] : { ...after }) as Record<string, unknown>
  let equal = Object.keys(before).length === keys.length
    && (!array || (previous as unknown[]).length === (next as unknown[]).length)
  for (const key of keys) {
    shared[key] = shareJson(before[key], after[key])
    if (!Object.hasOwn(before, key) || !Object.is(shared[key], before[key])) equal = false
  }
  return equal ? previous : shared
}

export function reuseSaleSnapshot(previous: SalesUkraineSale | null | undefined, next: SalesUkraineSale): SalesUkraineSale {
  return previous && saleKey(next) !== null && saleKey(previous) === saleKey(next)
    ? shareJson(previous, next) as SalesUkraineSale : next
}

export function reuseSaleSnapshots(previous: SalesUkraineSale[], next: SalesUkraineSale[]): SalesUkraineSale[] {
  const byKey = new Map(previous.flatMap(sale => { const key = saleKey(sale); return key === null ? [] : [[key, sale] as const] }))
  const shared = next.map(sale => reuseSaleSnapshot(byKey.get(saleKey(sale) ?? ''), sale))
  return shared.length === previous.length && shared.every((sale, index) => sale === previous[index]) ? previous : shared
}
