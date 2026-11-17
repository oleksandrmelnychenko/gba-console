import { isWholeMeasureUnit } from './wholeMeasureUnits'

type Translate = (text: string, values?: Record<string, string | number>) => string

export type ParsedQuantityInput = {
  error: string | null
  qty: number | null
}

const availableFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

/**
 * Reads a quantity typed as text. «2,5» and «2.5» are 2.5 (never 25 or 5);
 * negatives, text and exponent notation are rejected with a message instead of
 * being stripped; piece units (шт, компл, …) need a whole number; more than
 * the available stock is refused before any request.
 */
export function parseQuantityInput(
  text: string,
  options: { available?: number; unit?: string | null },
  t: Translate,
): ParsedQuantityInput {
  const normalized = text.trim().replace(',', '.')

  if (!normalized) {
    return { error: t('Вкажіть кількість'), qty: null }
  }

  if (/^-/.test(normalized)) {
    return { error: t('Кількість не може бути від’ємною'), qty: null }
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { error: t('Введіть число'), qty: null }
  }

  const qty = Number(normalized)

  if (qty <= 0) {
    return { error: t('Кількість має бути більшою за 0'), qty }
  }

  if (isWholeMeasureUnit(options.unit) && !Number.isInteger(qty)) {
    return { error: t('Для одиниці «{unit}» кількість має бути цілою', { unit: options.unit?.trim() || '' }), qty }
  }

  if (typeof options.available === 'number' && Number.isFinite(options.available) && qty > options.available) {
    return { error: t('Більше, ніж доступно ({available})', { available: availableFormat.format(options.available) }), qty }
  }

  return { error: null, qty }
}

/** Field text for a stored quantity, with the Ukrainian decimal comma; empty for none. */
export function formatQuantityForInput(qty: number | undefined | null): string {
  return typeof qty === 'number' && Number.isFinite(qty) && qty > 0 ? String(qty).replace('.', ',') : ''
}
