export type ConsumableOrderItemTotalsInput = {
  PricePerItem?: number
  Qty?: number
  TotalPrice?: number
  TotalPriceWithVAT?: number
  VAT?: number
  VatPercent?: number
}

export type ConsumableOrderItemTotals = {
  PricePerItem: number
  Qty: number
  TotalPrice: number
  TotalPriceWithVAT: number
  VAT: number
  VatPercent: number
}

export function calculateConsumableOrderItemTotals(item: ConsumableOrderItemTotalsInput): ConsumableOrderItemTotals {
  const qty = toFiniteNumber(item.Qty)
  const inputVatPercent = toFiniteNumber(item.VatPercent)
  const pricePerItem = toFiniteNumber(item.PricePerItem)
  let totalWithVat = toFiniteNumber(item.TotalPriceWithVAT)
  let totalWithoutVat = toFiniteNumber(item.TotalPrice)
  let vatAmount = toFiniteNumber(item.VAT)
  let vatPercent = inputVatPercent

  if (pricePerItem > 0 && qty > 0) {
    totalWithoutVat = roundConsumableMoney(pricePerItem * qty)
    vatAmount = roundConsumableMoney(totalWithoutVat * (vatPercent / 100))
    totalWithVat = roundConsumableMoney(totalWithoutVat + vatAmount)
  } else if (totalWithVat > 0) {
    if (vatPercent > 0) {
      totalWithoutVat = roundConsumableMoney(totalWithVat / (1 + vatPercent / 100))
      vatAmount = roundConsumableMoney(totalWithVat - totalWithoutVat)
    } else if (vatAmount > 0 && totalWithVat > vatAmount) {
      totalWithoutVat = roundConsumableMoney(totalWithVat - vatAmount)
      vatPercent = roundConsumableMoney((vatAmount / totalWithoutVat) * 100)
    } else {
      totalWithoutVat = totalWithVat
      vatAmount = 0
    }
  }

  return {
    PricePerItem: pricePerItem,
    Qty: qty,
    TotalPrice: totalWithoutVat,
    TotalPriceWithVAT: totalWithVat,
    VAT: vatAmount,
    VatPercent: vatPercent,
  }
}

export function roundConsumableMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function toFiniteNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
