import type { CalculatedProductPrice } from './types'

const VAT_SUFFIX_PATTERN = /\s*\((?:[НH]Д[СC]|ПД[ВB])\)\s*$/iu

/* Source systems mix Latin look-alikes into Cyrillic price names (e.g. "ЦP"
   with Latin P), so ranking keys fold homoglyphs before comparison. */
const LATIN_TO_CYRILLIC_HOMOGLYPHS = new Map([
  ['a', 'а'],
  ['b', 'в'],
  ['c', 'с'],
  ['e', 'е'],
  ['h', 'н'],
  ['i', 'і'],
  ['k', 'к'],
  ['m', 'м'],
  ['o', 'о'],
  ['p', 'р'],
  ['t', 'т'],
  ['x', 'х'],
  ['y', 'у'],
])

function normalizePricingKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('uk')
    .replace(/[a-z]/gu, (letter) => LATIN_TO_CYRILLIC_HOMOGLYPHS.get(letter) || letter)
}

export function getPricingBaseName(pricingName: string | null | undefined): string {
  return (pricingName || '').replace(VAT_SUFFIX_PATTERN, '').trim()
}

export function isVatPricingName(pricingName: string | null | undefined): boolean {
  return VAT_SUFFIX_PATTERN.test(pricingName?.trim() || '')
}

export function isPolishPricingName(pricingName: string | null | undefined): boolean {
  return /^[PР]L/iu.test(pricingName?.trim() || '')
}

/* CalculatedPrices preserve the established business order of price types;
   VAT variants collapse onto their base type so base/VAT pairs stay together. */
export function buildEffectivePricingOrder(prices: CalculatedProductPrice[]): Map<string, number> {
  const order = new Map<string, number>()

  prices.forEach((price, index) => {
    const key = normalizePricingKey(getPricingBaseName(price.Pricing?.Name))

    if (key && !order.has(key)) {
      order.set(key, index)
    }
  })

  return order
}

/* Canonical assortment order: retail first, then bulk tiers; every other
   price type follows the effective order after them. */
const PRIMARY_PRICING_ORDER = ['цр', 'цо1', 'цо2']

function getBaseRank(baseKey: string, baseOrder: Map<string, number>): number {
  const primaryRank = PRIMARY_PRICING_ORDER.indexOf(baseKey)

  if (primaryRank !== -1) {
    return primaryRank
  }

  const effectiveRank = baseOrder.get(baseKey)

  return effectiveRank === undefined
    ? Number.MAX_SAFE_INTEGER
    : PRIMARY_PRICING_ORDER.length + effectiveRank
}

export function compareSourcePricingNames(
  leftName: string,
  rightName: string,
  baseOrder: Map<string, number>,
): number {
  const leftBaseKey = normalizePricingKey(getPricingBaseName(leftName))
  const rightBaseKey = normalizePricingKey(getPricingBaseName(rightName))
  const leftRank = getBaseRank(leftBaseKey, baseOrder)
  const rightRank = getBaseRank(rightBaseKey, baseOrder)

  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }

  const baseCompare = leftBaseKey.localeCompare(rightBaseKey, 'uk', { sensitivity: 'base' })

  if (baseCompare !== 0) {
    return baseCompare
  }

  const leftVat = isVatPricingName(leftName)
  const rightVat = isVatPricingName(rightName)

  if (leftVat !== rightVat) {
    return leftVat ? 1 : -1
  }

  return leftName.localeCompare(rightName, 'uk', { sensitivity: 'base' })
}
