import { parseQuantityInput, type ParsedQuantityInput } from '../../shared/units/quantityInput'

type Translate = (text: string, values?: Record<string, string | number>) => string

/**
 * One position of the «Попередній перегляд» group operation (write-off or transfer of several rows).
 * The quantity is the typed text, read by the same rule as the single-row dialog (parseQuantityInput):
 * «2,5» and «2.5» are 2.5, a minus or «1e3» is refused (never stripped to 3 or 13), «1 000» is refused
 * as text, empty or 0 means nothing and blocks «Виконати», piece units need a whole number and more
 * than «Доступно» is refused before any request.
 */
export type StorageActionRowQuantity = {
  available?: number
  qtyText: string
  unit?: string | null
}

/** The preview starts empty: an untouched «Виконати» must never write off or move the whole stock. */
export const INITIAL_STORAGE_ACTION_ROW_QTY_TEXT = ''

export function parseStorageActionRowQty(row: StorageActionRowQuantity, t: Translate): ParsedQuantityInput {
  return parseQuantityInput(row.qtyText, { available: row.available, unit: row.unit }, t)
}

/** The quantity sent for the row, or null when the row may not be sent. */
export function getStorageActionRowQty(row: StorageActionRowQuantity, t: Translate): number | null {
  const parsed = parseStorageActionRowQty(row, t)

  return parsed.error ? null : parsed.qty
}

/** First problem of the rows («Виконати» and the operation dialog refuse while there is one). */
export function getStorageActionRowsError(rows: StorageActionRowQuantity[], t: Translate): string | null {
  for (const row of rows) {
    const { error } = parseStorageActionRowQty(row, t)

    if (error) {
      return error
    }
  }

  return null
}

/** «Разом»: sum of the quantities that will be sent (rows still being typed count as 0). */
export function sumStorageActionRows(rows: StorageActionRowQuantity[], t: Translate): number {
  const total = rows.reduce((sum, row) => sum + (getStorageActionRowQty(row, t) ?? 0), 0)

  return Math.round(total * 1000) / 1000
}
