import type { ProductSiblingCard, ProductSiblingCardRef } from './types'

export type ProductSiblingScope = 'card' | 'all'

export const productSiblingScopeOptions: Array<{ label: string; value: ProductSiblingScope }> = [
  { label: 'Ця картка', value: 'card' },
  { label: 'Разом', value: 'all' },
]

const ukrainianPluralRules = new Intl.PluralRules('uk-UA')
const productCardForms = ['картка', 'картки', 'карток'] as const
const productCardAccusativeForms = ['картку', 'картки', 'карток'] as const

export function pluralizeUk(count: number, forms: readonly [string, string, string]): string {
  const rule = ukrainianPluralRules.select(count)

  if (rule === 'one') {
    return forms[0]
  }

  return rule === 'few' ? forms[1] : forms[2]
}

export function formatProductSiblingNotice(otherCardsCount: number): string {
  return `Цей артикул має ще ${otherCardsCount} ${pluralizeUk(otherCardsCount, productCardAccusativeForms)}`
}

export function formatProductCardsCount(cardsCount: number): string {
  return `${cardsCount} ${pluralizeUk(cardsCount, productCardForms)}`
}

export function formatProductSiblingCountHint(siblingCount: number): string {
  return `Є ще ${siblingCount} ${pluralizeUk(siblingCount, productCardForms)}`
}

export function hasProductSiblingCards(cards: readonly ProductSiblingCard[]): boolean {
  return cards.length > 1
}

export function findCurrentProductSiblingCard(
  cards: readonly ProductSiblingCard[],
  currentProductNetId?: string | null,
): ProductSiblingCard | null {
  const normalizedNetId = normalizeNetId(currentProductNetId)

  return cards.find((card) => card.IsCurrent === true)
    || cards.find((card) => normalizedNetId !== '' && normalizeNetId(card.ProductNetId) === normalizedNetId)
    || null
}

export function getProductSiblingSourceLabel(card: ProductSiblingCardRef): string {
  const parts = [
    isSourceCode(card.SourceAmgCode) ? `AMG ${card.SourceAmgCode}` : '',
    isSourceCode(card.SourceFenixCode) ? `Fenix ${card.SourceFenixCode}` : '',
  ].filter(Boolean)

  if (parts.length > 0) {
    return parts.join(' · ')
  }

  return typeof card.ProductId === 'number' ? `ID ${card.ProductId}` : 'Без коду 1С'
}

export function getProductSiblingCardLabel(card: ProductSiblingCardRef): string {
  return [card.VendorCode?.trim(), getProductSiblingSourceLabel(card)].filter(Boolean).join(' · ')
}

export function getProductSiblingCardStockQty(card: ProductSiblingCard): number {
  if (typeof card.StockQty === 'number' && Number.isFinite(card.StockQty)) {
    return card.StockQty
  }

  return card.Availabilities.reduce((total, availability) => total + toFiniteNumber(availability.Amount), 0)
}

export function getProductSiblingCardSoldQty(card: ProductSiblingCard): number {
  return toFiniteNumber(card.SoldQty)
}

export function getProductSiblingCardsTotals(cards: readonly ProductSiblingCard[]): { soldQty: number; stockQty: number } {
  return cards.reduce(
    (totals, card) => ({
      soldQty: totals.soldQty + getProductSiblingCardSoldQty(card),
      stockQty: totals.stockQty + getProductSiblingCardStockQty(card),
    }),
    { soldQty: 0, stockQty: 0 },
  )
}

export function getProductSiblingRowKey(card: ProductSiblingCardRef | null | undefined, rowKey: string): string {
  return typeof card?.ProductId === 'number' ? `${card.ProductId}:${rowKey}` : rowKey
}

function isSourceCode(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeNetId(value?: string | null): string {
  return value?.trim().toLowerCase() || ''
}
