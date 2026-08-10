import type { SalesUkraineOrderItem } from './types'

const BASE_DISCOUNT_SUPPRESSED_TOPS = new Set(['x9', 'х9'])

export type OrderItemBaseDiscountSuppressionReason = 'sale' | 'x9' | 'zero-sale'

export type SaleDiscountSummary = {
  averageBaseDiscount: number | null
  averageOneTimeDiscount: number | null
  partialAverageBaseDiscount: number | null
  partialUniformBaseDiscount: number | null
  uniformBaseDiscount: number | null
  uniformOneTimeDiscount: number | null
}

type DiscountAccumulator = {
  allEqual: boolean
  allPositive: boolean
  count: number
  first: number | null
  positiveCount: number
  positiveFirst: number | null
  positivesEqual: boolean
  positiveSum: number
  sum: number
}

export function getVisibleOrderItemBaseDiscount(orderItem: SalesUkraineOrderItem): number | null {
  const discount = getNumber(orderItem.Discount)

  if (typeof discount !== 'number') {
    return null
  }

  return getOrderItemBaseDiscountSuppressionReason(orderItem) ? 0 : discount
}

export function getOrderItemBaseDiscountSuppressionReason(
  orderItem: SalesUkraineOrderItem,
): OrderItemBaseDiscountSuppressionReason | null {
  const top = orderItem.Product?.Top?.trim().toLowerCase()

  if (top && BASE_DISCOUNT_SUPPRESSED_TOPS.has(top)) {
    return 'x9'
  }

  if (orderItem.Product?.IsForZeroSale) {
    return 'zero-sale'
  }

  if (orderItem.Product?.IsForSale) {
    return 'sale'
  }

  return null
}

/**
 * Derives every discount value used by the dense sales grid in one pass over
 * the order items. The legacy helpers below stay public for focused call sites,
 * while the hot row-rendering path avoids six map/filter/reduce chains.
 */
export function getSaleDiscountSummary(orderItems: SalesUkraineOrderItem[]): SaleDiscountSummary {
  const base = createDiscountAccumulator()
  const oneTime = createDiscountAccumulator()

  for (const orderItem of orderItems) {
    updateDiscountAccumulator(base, orderItem.Discount)
    updateDiscountAccumulator(oneTime, orderItem.OneTimeDiscount)
  }

  return {
    averageBaseDiscount: getAccumulatorAverage(base),
    averageOneTimeDiscount: getAccumulatorAverage(oneTime),
    partialAverageBaseDiscount: getAccumulatorPositiveAverage(base),
    partialUniformBaseDiscount: getAccumulatorPositiveUniform(base),
    uniformBaseDiscount: getAccumulatorUniform(base),
    uniformOneTimeDiscount: getAccumulatorUniform(oneTime),
  }
}

export function getUniformBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getUniformPositiveDiscount(orderItems.map((item) => item.Discount))
}

export function getAverageBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getAveragePositiveDiscount(orderItems.map((item) => item.Discount))
}

export function getPartialUniformBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getUniformPositiveDiscount(orderItems.map((item) => item.Discount).filter(isPositiveDiscount))
}

export function getPartialAverageBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getAveragePositiveDiscount(orderItems.map((item) => item.Discount).filter(isPositiveDiscount))
}

export function getUniformOneTimeDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getUniformPositiveDiscount(orderItems.map((item) => item.OneTimeDiscount))
}

export function getAverageOneTimeDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getAveragePositiveDiscount(orderItems.map((item) => item.OneTimeDiscount))
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getUniformPositiveDiscount(values: unknown[]): number | null {
  if (!values.length) {
    return null
  }

  const first = getNumber(values[0])

  if (typeof first !== 'number' || first === 0) {
    return null
  }

  return values.every((value) => getNumber(value) === first) ? first : null
}

function getAveragePositiveDiscount(values: unknown[]): number | null {
  if (!values.length) {
    return null
  }

  const discounts = values.map((value) => getNumber(value))

  if (discounts.some((value) => typeof value !== 'number' || value <= 0)) {
    return null
  }

  const sum = (discounts as number[]).reduce((acc, value) => acc + value, 0)

  return Math.round((sum / discounts.length) * 100) / 100
}

function isPositiveDiscount(value: unknown): boolean {
  const discount = getNumber(value)

  return typeof discount === 'number' && discount > 0
}

function createDiscountAccumulator(): DiscountAccumulator {
  return {
    allEqual: true,
    allPositive: true,
    count: 0,
    first: null,
    positiveCount: 0,
    positiveFirst: null,
    positivesEqual: true,
    positiveSum: 0,
    sum: 0,
  }
}

function updateDiscountAccumulator(accumulator: DiscountAccumulator, value: unknown) {
  const discount = getNumber(value)

  if (accumulator.count === 0) {
    accumulator.first = discount
  } else if (discount !== accumulator.first) {
    accumulator.allEqual = false
  }

  accumulator.count += 1

  if (typeof discount !== 'number' || discount <= 0) {
    accumulator.allPositive = false

    return
  }

  accumulator.sum += discount

  if (accumulator.positiveCount === 0) {
    accumulator.positiveFirst = discount
  } else if (discount !== accumulator.positiveFirst) {
    accumulator.positivesEqual = false
  }

  accumulator.positiveCount += 1
  accumulator.positiveSum += discount
}

function getAccumulatorUniform(accumulator: DiscountAccumulator): number | null {
  return accumulator.count > 0
    && typeof accumulator.first === 'number'
    && accumulator.first !== 0
    && accumulator.allEqual
    ? accumulator.first
    : null
}

function getAccumulatorAverage(accumulator: DiscountAccumulator): number | null {
  return accumulator.count > 0 && accumulator.allPositive
    ? roundDiscount(accumulator.sum / accumulator.count)
    : null
}

function getAccumulatorPositiveUniform(accumulator: DiscountAccumulator): number | null {
  return accumulator.positiveCount > 0 && accumulator.positivesEqual
    ? accumulator.positiveFirst
    : null
}

function getAccumulatorPositiveAverage(accumulator: DiscountAccumulator): number | null {
  return accumulator.positiveCount > 0
    ? roundDiscount(accumulator.positiveSum / accumulator.positiveCount)
    : null
}

function roundDiscount(value: number): number {
  return Math.round(value * 100) / 100
}
