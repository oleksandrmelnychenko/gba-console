import { getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'

export type WizardDetailChip = {
  count: number
  key: string
  name: string
}

export type WizardDetailRow = {
  amount: number
  analyst?: string
  key?: string
  name: string
  regionCode?: string
}

export type WizardStockPriceLine = {
  eurPrice?: number | null
  key: string
  label: string
  localCurrency: string
  localPrice?: number | null
  qty: number
  uahPrice?: number | null
}

export function buildWizardStockPriceLines(
  product: WizardSaleProduct,
  isVatSale: boolean,
  localCurrencyCode: string,
  displayQty: number,
): WizardStockPriceLine[] {
  const storageQty =
    isVatSale
      ? getWizardProductNumber(product.AvailableQtyUkVAT) ?? displayQty
      : getWizardProductNumber(product.AvailableQtyUk) ?? displayQty
  const showNonVatUahConversion = !isVatSale && localCurrencyCode === 'EUR'
  const storageLine: WizardStockPriceLine = {
    eurPrice: showNonVatUahConversion ? null : getWizardProductNumber(product.CurrentPrice),
    key: 'storage',
    label: isVatSale ? 'ПДВ склад' : 'Склад',
    localCurrency: localCurrencyCode,
    localPrice: getWizardProductNumber(product.CurrentLocalPrice),
    qty: storageQty,
    uahPrice: showNonVatUahConversion ? getWizardProductNumber(product.CurrentPriceEurToUah) : null,
  }

  if (isVatSale) {
    return [storageLine]
  }

  const resaleQty = getWizardProductNumber(product.AvailableQtyUkReSale)
  const resaleLine: WizardStockPriceLine = {
    eurPrice: showNonVatUahConversion ? null : getWizardProductNumber(product.CurrentPriceReSale),
    key: 'resale',
    label: 'Перепродаж',
    localCurrency: localCurrencyCode,
    localPrice: getWizardProductNumber(product.CurrentLocalPriceReSale),
    qty: resaleQty ?? 0,
    uahPrice: showNonVatUahConversion ? getWizardProductNumber(product.CurrentPriceReSaleEurToUah) : null,
  }

  return [storageLine, resaleLine]
}

export function getWizardStockCurrencyPrice(line: WizardStockPriceLine, currency: string): number | null | undefined {
  if (currency === line.localCurrency && line.localPrice != null) return line.localPrice
  if (currency === 'EUR') return line.eurPrice
  if (currency === 'UAH') return line.uahPrice
  return null
}
