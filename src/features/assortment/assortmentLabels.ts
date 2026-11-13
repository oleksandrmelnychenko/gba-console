import { OBLAST_CENTROIDS } from '../sales-geography/data/oblastCentroids'

export const ACTION_LABELS: Record<string, string> = {
  discount_or_redistribute: 'Знизити ціну або перемістити запас',
  dead_stock_review: 'Перевірити залишок без продажів',
  fix_margin: 'Переглянути ціну: маржа занадто низька',
  keep_push: 'Підтримувати продажі',
  margin_review: 'Перевірити ціну та маржу',
  monitor: 'Спостерігати за товаром',
  monitor_decline: 'Перевірити причину падіння продажів',
  quality_review: 'Перевірити повернення та якість',
  reorder_check: 'Перевірити потребу в дозамовленні',
  slow_mover_review: 'Вирішити, що робити з повільним запасом',
  to_order_candidate: 'Продавати під замовлення',
}

export const REASON_LABELS: Record<string, string> = {
  dead_stock: 'Товар давно не продавався',
  declining_demand: 'Продажі знижуються',
  healthy_margin: 'Маржа на нормальному рівні',
  high_returns: 'Забагато повернень',
  negative_margin: 'Продажі приносять збиток',
  no_immediate_action: 'Термінових дій не потрібно',
  overstock: 'На складі більше, ніж потрібно',
  slow_mover: 'Товар продається повільно',
  strong_demand: 'Товар добре продається',
  strong_to_order_demand: 'Є попит, але немає запасу',
  understock: 'Запасу може не вистачити',
  unknown_margin: 'Недостатньо даних про маржу',
}

export function classLabel(value: string | null | undefined): string {
  return value && value !== 'unknown' ? value : 'Без класу'
}

export type AbcStatusFields = {
  abc?: string | null
  abc_status?: string | null
  abc_label?: string | null
}

export function abcUnclassifiedLabel(row: AbcStatusFields): string | null {
  if (row.abc && row.abc !== 'unknown') return null
  const label = typeof row.abc_label === 'string' ? row.abc_label.trim() : ''
  return label && label !== 'unknown' ? label : 'Без класу'
}

export type AbcMixChip = { key: string; label: string; count: number }

export function abcMixChips(
  byAbc: Record<string, number> | null | undefined,
  byStatus: Record<string, number> | null | undefined,
  statusLabels: Record<string, string> | null | undefined,
): AbcMixChip[] {
  const classified = Object.entries(byAbc ?? {})
    .filter(([key, count]) => key !== 'unknown' && Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({ key, label: key, count: Number(count) }))
  const statuses = Object.entries(byStatus ?? {})
    .filter(([key, count]) => key !== 'classified' && Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({ key: `status:${key}`, label: statusLabels?.[key]?.trim() || classLabel('unknown'), count: Number(count) }))
  if (statuses.length > 0) return [...classified, ...statuses]
  const unknown = Number(byAbc?.unknown ?? 0)
  return unknown > 0 ? [...classified, { key: 'unknown', label: classLabel('unknown'), count: unknown }] : classified
}

export function stockAsOfNote(value: {
  stock_as_of?: string | null
  stock_matches_as_of?: boolean | null
}): string | null {
  if (value.stock_matches_as_of !== false) return null
  const date = /^\d{4}-\d{2}-\d{2}/.test(value.stock_as_of ?? '')
    ? `${value.stock_as_of!.slice(8, 10)}.${value.stock_as_of!.slice(5, 7)}.${value.stock_as_of!.slice(0, 4)}`
    : ''
  return `залишок і собівартість — на сьогодні${date ? ` (${date})` : ''}`
}

export function regionDisplayName(code: string | null | undefined): string {
  const trimmed = code?.trim() ?? ''
  const name = OBLAST_CENTROIDS[trimmed.toUpperCase()]?.name
  return name ? `${name} (${trimmed})` : trimmed
}
