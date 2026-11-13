import { procurementQuantityFormat } from './procurementQuantityFormat'
import type { ProcurementTopItem, ReorderSuggestion } from './procurementTypes'

type Translate = (value: string) => string

export function formatSuggestedQtyByUnit(
  byUnit: Record<string, number> | null | undefined,
  t: Translate,
): string | null {
  if (!byUnit) return null
  const parts = Object.entries(byUnit)
    .filter(([, qty]) => Number.isFinite(qty) && qty > 0)
    .map(([unit, qty]) => `${procurementQuantityFormat.format(qty)} ${unit.trim() || t('без одиниці')}`)

  return parts.length > 0 ? parts.join(' · ') : null
}

export function topItemPosition(item: ProcurementTopItem): number {
  const evidence = item.evidence
  if (!evidence) return item.on_hand
  if (typeof evidence.position === 'number' && Number.isFinite(evidence.position)) return evidence.position

  return evidence.available + evidence.on_order
}

export function topItemShortage(item: ProcurementTopItem): number {
  return Math.max(0, item.reorder_point - topItemPosition(item))
}

export function isBelowReorderPoint(item: ReorderSuggestion): boolean {
  return item.inventory.position <= item.reorder_point
}

export function draftUnitCost(item: ReorderSuggestion): number | null {
  if (item.unit_cost_eur !== null) return item.unit_cost_eur
  if (item.line_cost_eur !== null && item.suggested_qty > 0) return item.line_cost_eur / item.suggested_qty

  return null
}

export type DraftCostSummary = { lineCount: number; pricedCost: number; unpricedCount: number }

export function summarizeDraftCost(
  items: ReorderSuggestion[],
  qtyOf: (item: ReorderSuggestion) => number,
): DraftCostSummary {
  return items.reduce<DraftCostSummary>(
    (summary, item) => {
      const unitCost = draftUnitCost(item)
      if (unitCost === null) {
        summary.unpricedCount += 1
      } else {
        summary.pricedCost += qtyOf(item) * unitCost
      }
      summary.lineCount += 1

      return summary
    },
    { lineCount: 0, pricedCost: 0, unpricedCount: 0 },
  )
}

const countFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

export function unpricedLinesNote(count: number, t: Translate): string | null {
  if (!(count > 0)) return null
  const lastTwo = count % 100
  const last = count % 10
  const noun = lastTwo >= 11 && lastTwo <= 14
    ? 'рядків'
    : last === 1 ? 'рядок' : last >= 2 && last <= 4 ? 'рядки' : 'рядків'

  return `${countFormat.format(count)} ${t(noun)} ${t('без ціни не враховано')}`
}

export function compareLineCostUnpricedLast(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1

  return right - left
}
