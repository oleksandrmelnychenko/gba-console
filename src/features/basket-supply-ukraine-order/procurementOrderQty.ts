import type { ReorderSuggestion } from './procurementTypes'

type Translate = (value: string) => string

/**
 * The optimizer works in fractional units (3.87 шт), which is fine for budget math but
 * cannot be ordered. The buyer sees a whole, orderable quantity that also respects the
 * supplier MOQ and order multiple; the plan totals stay on the optimizer's own numbers.
 */
export function toOrderableQty(item: Pick<ReorderSuggestion, 'moq' | 'order_multiple' | 'suggested_qty'>): number {
  const suggested = Number.isFinite(item.suggested_qty) ? item.suggested_qty : 0

  if (suggested <= 0) {
    return 0
  }

  let qty = Math.ceil(suggested)

  const moq = positiveOrNull(item.moq)
  if (moq !== null && qty < moq) {
    qty = Math.ceil(moq)
  }

  const multiple = positiveOrNull(item.order_multiple)
  if (multiple !== null) {
    qty = Math.ceil(qty / multiple) * multiple
  }

  return roundToUnit(qty)
}

export function isOrderableQtyAdjusted(
  item: Pick<ReorderSuggestion, 'moq' | 'order_multiple' | 'suggested_qty'>,
): boolean {
  return Math.abs(toOrderableQty(item) - item.suggested_qty) > 0.001
}

export function buildOrderableQtyHint(
  item: Pick<ReorderSuggestion, 'moq' | 'order_multiple' | 'suggested_qty'>,
  t: Translate,
  formatQty: (value: number) => string,
): string {
  if (!isOrderableQtyAdjusted(item)) {
    return ''
  }

  const parts = [`${t('Розрахунок')}: ${formatQty(item.suggested_qty)}`]
  const moq = positiveOrNull(item.moq)
  const multiple = positiveOrNull(item.order_multiple)

  if (moq !== null) {
    parts.push(`${t('мінімальна партія')} ${formatQty(moq)}`)
  }

  if (multiple !== null) {
    parts.push(`${t('кратність')} ${formatQty(multiple)}`)
  }

  parts.push(t('суми плану рахуються за розрахунковою кількістю'))

  return parts.join(' · ')
}

/**
 * The service explains its decision in English shorthand
 * («position 0 vs reorder_point 3; 0d cover, lead 7d»), so the sheet rebuilds the same
 * sentence from the item's own numbers and falls back to nothing rather than showing it raw.
 */
export function buildReorderExplanation(item: ReorderSuggestion, t: Translate): string {
  const sentences: string[] = []
  const position = item.inventory?.position
  const reorderPoint = item.reorder_point

  if (Number.isFinite(position) && Number.isFinite(reorderPoint)) {
    sentences.push(
      `${t('Доступно з урахуванням замовлень')} ${formatNumber(position)} ${t('шт')} `
      + `${t('при точці дозамовлення')} ${formatNumber(reorderPoint)} ${t('шт')}`,
    )
  }

  if (Number.isFinite(item.days_of_cover)) {
    sentences.push(
      item.days_of_cover > 0
        ? `${t('запасу вистачить на')} ${formatNumber(item.days_of_cover)} ${t('дн.')}`
        : t('запасу вже немає'),
    )
  }

  const leadDays = parseLeadDays(item.reason)
  if (leadDays !== null) {
    sentences.push(`${t('постачання')} ${formatNumber(leadDays)} ${t('дн.')}`)
  }

  if (sentences.length === 0) {
    return t('AI зіставив прогноз попиту, залишки, точку дозамовлення і правила закупівлі')
  }

  return `${sentences.join('; ')}.`
}

function parseLeadDays(reason: string | null | undefined): number | null {
  const match = /lead\s+(\d+(?:\.\d+)?)d/i.exec(reason || '')

  return match ? Number(match[1]) : null
}

function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function roundToUnit(value: number): number {
  return Math.round(value * 1000) / 1000
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}
