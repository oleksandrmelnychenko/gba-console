import type { SalesUkraineOrderItem, SalesUkraineProduct } from '../../types'

export type WizardSaleProduct = SalesUkraineProduct & {
  AnalogueProducts?: WizardProductAnalogue[]
  AvailableQtyPl?: number
  BaseSetProducts?: WizardBaseSetProduct[]
  ComponentProducts?: WizardComponentProduct[]
  CurrentLocalPrice?: number
  CurrentLocalPriceReSale?: number
  CurrentPrice?: number
  CurrentPriceEurToUah?: number
  CurrentPriceReSale?: number
  CurrentPriceReSaleEurToUah?: number
  Description?: string
  HasAnalogue?: boolean
  HasComponent?: boolean
  Image?: string
  MeasureUnit?: { Name?: string } | null
  NextSearchedProducts?: WizardSaleProduct[]
  ProductAvailabilities?: { Amount?: number }[]
  Size?: string
}

export type WizardProductAnalogue = {
  AnalogueProduct?: WizardSaleProduct
}

export type WizardComponentProduct = {
  ComponentProduct?: WizardSaleProduct
  SetComponentsQty?: number
}

export type WizardBaseSetProduct = {
  BaseProduct?: WizardSaleProduct
  SetComponentsQty?: number
}

export type WizardCarouselEntry = {
  product: WizardSaleProduct
  setQty?: number
}

export function getWizardProductNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function getWizardStorageQty(product: WizardSaleProduct, isVatSale: boolean): number | undefined {
  const availableQty = isVatSale ? product.AvailableQtyUkVAT : product.AvailableQtyUk

  return getWizardProductNumber(availableQty) ?? undefined
}

export function getWizardSellableQty(product: WizardSaleProduct, isVatSale: boolean): number | undefined {
  const uk = getWizardStorageQty(product, isVatSale)

  if (isVatSale) {
    return uk
  }

  const reSale = getWizardProductNumber(product.AvailableQtyUkReSale)

  if (uk == null && reSale === null) {
    return undefined
  }

  return (uk ?? 0) + (reSale ?? 0)
}

export function getWizardDisplayQty(product: WizardSaleProduct, isVatSale: boolean): number {
  return getWizardStorageQty(product, isVatSale) ?? 0
}

export function getOrderItemDiscount(item: SalesUkraineOrderItem): number {
  const product = (item.Product ?? {}) as WizardSaleProduct
  const top = product.Top?.trim()

  if (top === 'Х9' || top === 'X9' || product.IsForZeroSale || product.IsForSale) {
    return 0
  }

  return getWizardProductNumber(item.Discount) ?? 0
}

export function getOrderItemLocalPrice(item: SalesUkraineOrderItem, useEurToUah: boolean): number {
  const product = (item.Product ?? {}) as WizardSaleProduct

  return (useEurToUah ? getWizardProductNumber(product.CurrentPriceEurToUah) : getWizardProductNumber(product.CurrentLocalPrice)) ?? 0
}

export function getOrderItemLocalTotal(item: SalesUkraineOrderItem, useEurToUah: boolean): number {
  return (useEurToUah ? getWizardProductNumber(item.TotalAmountEurToUah) : getWizardProductNumber(item.TotalAmountLocal)) ?? 0
}

export function getComponentCarouselEntries(parent: WizardSaleProduct | null): {
  entries: WizardCarouselEntry[]
  isBaseSet: boolean
} {
  if (!parent) {
    return { entries: [], isBaseSet: false }
  }

  const componentEntries = (parent.ComponentProducts ?? [])
    .filter((item) => item.ComponentProduct)
    .map((item) => ({ product: item.ComponentProduct as WizardSaleProduct, setQty: item.SetComponentsQty }))

  if (componentEntries.length > 0) {
    return { entries: componentEntries, isBaseSet: false }
  }

  const baseSetEntries = (parent.BaseSetProducts ?? [])
    .filter((item) => item.BaseProduct)
    .map((item) => ({ product: item.BaseProduct as WizardSaleProduct, setQty: item.SetComponentsQty }))

  return { entries: baseSetEntries, isBaseSet: true }
}
