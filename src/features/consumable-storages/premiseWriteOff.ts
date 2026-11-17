import { parseQuantityInput, type ParsedQuantityInput } from '../../shared/units/quantityInput'
import type { ConsumableProduct, DeprecatedConsumableOrder, DeprecatedConsumableOrderItem, NamedEntity } from './types'

/** DepreciatedConsumableOrder.Comment column size. */
export const WRITE_OFF_COMMENT_MAX_LENGTH = 500

type Translate = (text: string, values?: Record<string, string | number>) => string

export type WriteOffQuantity = ParsedQuantityInput

/**
 * Reads the typed write-off quantity. «2,5» is 2.5 (never 25); negatives,
 * text and exponent notation are rejected with a message; piece units need a
 * whole number; more than «Доступно» is blocked before the request.
 */
export function parseWriteOffQuantity(
  text: string,
  options: { available?: number; unit?: string | null },
  t: Translate,
): WriteOffQuantity {
  return parseQuantityInput(text, options, t)
}

/** Text shown in the quantity field for a stored quantity. */
export function formatWriteOffQuantityInput(qty: number | undefined): string {
  return typeof qty === 'number' && Number.isFinite(qty) && qty > 0 ? String(qty) : ''
}

export function getWriteOffItemProductKey(item: DeprecatedConsumableOrderItem): string {
  const product = item.ConsumablesOrderItem?.ConsumableProduct

  return product?.NetUid || (product?.Id ? String(product.Id) : '')
}

/**
 * «Доступно» for a write-off row: what is on the premise now plus what THIS
 * write-off already took of the product (only when editing it). Quantities of
 * other write-offs are already gone from the stock and are never added back.
 */
export function getWriteOffAvailableQty(
  item: DeprecatedConsumableOrderItem,
  storageProducts: ConsumableProduct[],
  originalOrder: DeprecatedConsumableOrder | null,
): number | undefined {
  const productKey = getWriteOffItemProductKey(item)
  const stockProduct = productKey
    ? storageProducts.find((product) => (product.NetUid || (product.Id ? String(product.Id) : '')) === productKey)
    : undefined
  const stock = stockProduct ? stockProduct.SpecificationQty ?? stockProduct.TotalQty : undefined
  const alreadyWrittenOff = originalOrder && (originalOrder.Id || originalOrder.NetUid)
    ? (originalOrder.DepreciatedConsumableOrderItems || [])
      .filter((original) => productKey && getWriteOffItemProductKey(original) === productKey)
      .reduce((sum, original) => sum + (original.Qty || 0), 0)
    : 0

  if (typeof stock === 'number' && Number.isFinite(stock)) {
    return stock + alreadyWrittenOff
  }

  if (alreadyWrittenOff > 0) {
    return alreadyWrittenOff
  }

  const fallback = item.ConsumablesOrderItem?.Qty ?? item.ConsumablesOrderItem?.ConsumableProduct?.SpecificationQty
    ?? item.ConsumablesOrderItem?.ConsumableProduct?.TotalQty

  return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : undefined
}

export type WriteOffTotal = {
  currency: string
  qty: number
  total: number
}

/** Footer of «Списані товари»: sums of the write-off rows shown, per currency. */
export function summarizeWriteOffItems(items: DeprecatedConsumableOrderItem[]): WriteOffTotal[] {
  const totals = new Map<string, WriteOffTotal>()

  for (const item of items) {
    const currency = getCurrencyLabel(item.Currency || item.ConsumablesOrderItem?.Currency) || '—'
    const current = totals.get(currency) || { currency, qty: 0, total: 0 }
    current.qty += Number.isFinite(item.Qty) ? item.Qty || 0 : 0
    current.total += Number.isFinite(item.TotalPrice) ? item.TotalPrice || 0 : 0
    totals.set(currency, current)
  }

  return Array.from(totals.values()).map((total) => ({
    ...total,
    qty: Math.round(total.qty * 1000) / 1000,
    total: Math.round(total.total * 100) / 100,
  }))
}

/** One currency label everywhere on the premise screens: the code (UAH), the name only as a fallback. */
export function getCurrencyLabel(currency: NamedEntity | null | undefined): string | undefined {
  return currency?.Code || currency?.Name || undefined
}

const moneyFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const quantityFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

/** Console money format: «1 200,00». */
export function formatPremiseMoney(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormat.format(value) : ''
}

export function formatPremiseQuantity(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? quantityFormat.format(value) : ''
}

/**
 * Measure unit of a write-off row. Rows added «По накладних» carry the income
 * line's product, which may come without its unit; the premise remnants know it.
 */
export function getWriteOffItemUnit(
  item: DeprecatedConsumableOrderItem,
  storageProducts: ConsumableProduct[],
): string | undefined {
  const own = item.ConsumablesOrderItem?.ConsumableProduct?.MeasureUnit?.Name

  if (own?.trim()) {
    return own
  }

  const productKey = getWriteOffItemProductKey(item)
  const stockProduct = productKey
    ? storageProducts.find((product) => (product.NetUid || (product.Id ? String(product.Id) : '')) === productKey)
    : undefined

  return stockProduct?.MeasureUnit?.Name || undefined
}
