import type { ProductHistoryContract } from './types'

// Each endpoint has different history windows. Only common source identity and
// business date may be compared; this does not claim a shared SQL transaction.
export function requireMatchingAssortmentScopes(values: ProductHistoryContract[]): void {
  const first = values[0]
  if (!first) return
  if (values.some((value) => value.as_of !== first.as_of
    || value.source_history_start !== first.source_history_start
    || value.history_fingerprint !== first.history_fingerprint)) {
    throw new Error('Розділи асортименту повернули різні дати або джерела історії. Зріз не показано; повторіть завантаження.')
  }
}
