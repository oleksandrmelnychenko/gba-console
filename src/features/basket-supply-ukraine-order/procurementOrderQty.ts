import type { ReorderSuggestion } from './procurementTypes'
import { procurementQuantityFormat as quantity } from './procurementQuantityFormat'

type Translate = (value: string) => string

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
      `${t('Доступно з урахуванням замовлень')} ${quantity.format(position)} `
      + `${t('при точці дозамовлення')} ${quantity.format(reorderPoint)}`,
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

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}
