import type { FenixDiscountCell } from './originalFenixClientDiscounts'
/** A bounded display projection only. The complete immutable result remains the export input. */
export function fenixDiscountDisplayPage(cells: readonly FenixDiscountCell[], page: number) {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('Некоректна сторінка результату FENIX.')
  const current = Math.min(page, Math.max(0, Math.ceil(cells.length / 50) - 1)), start = current * 50
  return { current, start, total: cells.length, lines: cells.slice(start, start + 50).map(cell => ({ key: JSON.stringify([cell.Recipient, cell.Product]), cells: [cell.RecipientName, cell.ProductName, cell.RegionCode ?? '', cell.Percentage] })) }
}
