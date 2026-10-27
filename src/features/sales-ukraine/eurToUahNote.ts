import { getSaleLifecycleTypeKey } from './saleStatus'
import type { SalesUkraineSale } from './types'

export const STORED_EUR_TO_UAH_NOTE = 'Збережена сума EUR × поточний курс'
export const CURRENT_PRICE_EUR_TO_UAH_NOTE = 'Поточна ціна EUR × поточний курс'

export function usesCurrentSalePrices(sale: Pick<SalesUkraineSale, 'BaseLifeCycleStatus' | 'IsImported' | 'IsPaymentBillDownloaded'>): boolean {
  return (
    !sale.IsImported &&
    !sale.IsPaymentBillDownloaded &&
    getSaleLifecycleTypeKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType) === '0'
  )
}

export function getEurToUahNote(sale: Pick<SalesUkraineSale, 'BaseLifeCycleStatus' | 'IsImported' | 'IsPaymentBillDownloaded'>): string {
  return usesCurrentSalePrices(sale) ? CURRENT_PRICE_EUR_TO_UAH_NOTE : STORED_EUR_TO_UAH_NOTE
}
