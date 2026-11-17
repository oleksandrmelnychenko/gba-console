import type { SupplyOrderUkraineCartItem } from './types'

function quantity(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

/** Current reserve plus what is still available: the most the server can reserve for the row. */
export function getReserveLimit(item: Pick<SupplyOrderUkraineCartItem, 'AvailableQty' | 'ReservedQty'>): number {
  return quantity(item.ReservedQty) + quantity(item.AvailableQty)
}

/**
 * An empty or non-numeric value used to be "saved" as success, and a value above what is
 * available went to the server only to be refused. Returns the field error or null.
 */
export function validateReserveQty(value: number | '', limit: number, t: (key: string) => string): string | null {
  if (value === '' || !Number.isInteger(value) || value < 0) {
    return t('Вкажіть кількість — ціле число від 0')
  }

  if (value > limit) {
    return `${t('Можна зарезервувати не більше')} ${limit}`
  }

  return null
}
