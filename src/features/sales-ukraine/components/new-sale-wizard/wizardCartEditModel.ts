import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem } from '../../types'
import { getOrderItemDiscount, getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'
import type { WizardSplitOrderItem } from './wizardSplitSale'

export type WizardCartEditRow = {
  index: number
  amountLocal: number
  comment: string
  discount: number
  localPrice: number
  name: string
  oneTimeDiscount: number
  originalNumber: string
  price: number
  qty: number
  totalAmount: number
  user: string
  vendorCode: string
}

export function getCurrentCartEditRows(items: SalesUkraineOrderItem[]): WizardCartEditRow[] {
  return items.map((item, index) => ({
    index,
    amountLocal: getWizardProductNumber(item.TotalAmountEurToUah) ?? 0,
    comment: item.Comment || '',
    discount: getOrderItemDiscount(item),
    localPrice: getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPriceEurToUah) ?? 0,
    name: item.Product?.NameUA || item.Product?.Name || '',
    oneTimeDiscount: getWizardProductNumber(item.OneTimeDiscount) ?? 0,
    originalNumber: item.Product?.MainOriginalNumber || '',
    price: getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPrice) ?? 0,
    qty: getWizardProductNumber(item.Qty) ?? 0,
    totalAmount: getWizardProductNumber(item.TotalAmount) ?? 0,
    user: item.User?.LastName || '',
    vendorCode: item.Product?.VendorCode || item.Product?.Articul || '',
  })) satisfies WizardCartEditRow[]
}

export function getSplitCartEditRows(items: WizardSplitOrderItem[]): WizardCartEditRow[] {
  return items.map((item, index) => ({
    index,
    amountLocal: item.TotalAmountEurToUah,
    comment: item.Comment || '',
    discount: getWizardProductNumber(item.OneTimeDiscount) ?? 0,
    localPrice: getWizardProductNumber(item.Product.CurrentPriceEurToUah) ?? 0,
    name: item.Product.NameUA || item.Product.Name || '',
    oneTimeDiscount: getWizardProductNumber(item.OneTimeDiscount) ?? 0,
    originalNumber: item.Product.MainOriginalNumber || '',
    price: getWizardProductNumber(item.Product.CurrentPrice) ?? 0,
    qty: item.Qty,
    totalAmount: item.TotalAmount,
    user: item.User?.LastName || '',
    vendorCode: item.Product.VendorCode || item.Product.Articul || '',
  })) satisfies WizardCartEditRow[]
}

export function getWizardCartEditTotals(rows: WizardCartEditRow[]) {
  let totalQty = 0
  let totalAmount = 0
  let totalAmountLocal = 0
  for (const row of rows) {
    totalQty += row.qty
    totalAmount += row.totalAmount
    totalAmountLocal += row.amountLocal
  }
  return { totalQty, totalAmount: roundMoney(totalAmount), totalAmountLocal: roundMoney(totalAmountLocal) }
}
