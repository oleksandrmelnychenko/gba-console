import { datasetConfigurationError } from './reportDatasets'
import { validateStockReportRequest } from '../api/reportsApi'
import type { ReportDataset, ReportTemplate } from '../types'

// Names emitted by the b4 server's ReportDataSource contract, including the retained legacy pilot.
export const savedNativeReportSources: Readonly<Record<number, string>> = {
  0: 'Operational', 2: 'NativeSalesNet', 3: 'NativePurchases', 4: 'NativeStockCurrent',
  5: 'NativeStockPlacements', 6: 'NativeStockReservations', 7: 'NativeStockLotsCurrent',
  8: 'NativeStockAgreementValuation', 9: 'NativeSupplierReturns', 10: 'NativeCurrentDebt',
  11: 'NativeAccountBalances', 12: 'NativeSaleClientActivity', 13: 'NativeSaleClientPeriodComparison',
  14: 'NativeImportedPayments', 15: 'NativeSalesXyzStability', 16: 'NativeSaleRevenuePeriodComparison',
  17: 'NativeBuyerSalesShare', 18: 'NativeSaleReturnPeriodComparison', 19: 'NativeExchangeRateComparison',
  20: 'NativeSaleMarginPeriodComparison', 21: 'NativeImportedPaymentPeriodComparison',
  22: 'NativeAgreementProductPrices', 23: 'NativeOneCDiscountMarkup', 24: 'NativeOneCProvidedDiscounts',
  25: 'NativeOneCClientDiscounts', 26: 'NativeOneCSalesAbc', 27: 'NativeOneCPriceTypeSalesComparison',
  28: 'NativeOneCPriceAnalysis', 29: 'NativeCurrentAgreementGroupDiscounts', 30: 'NativeRecordedSaleGrossProfit',
  31: 'NativeCurrentAgreementPriceComparison', 32: 'NativeImportedSaleDiscount',
  35: 'NativeDayOrganizationGrossProfit', 36: 'NativeVparivanie', 38: 'NativeSupplierGrossProfit',
  39: 'NativeCurrentVparivanie', 40: 'NativeCashPeriod', 41: 'NativeSettlementPeriod',
}

export function savedNativeReportConfigurationError(template: ReportTemplate, datasets: readonly ReportDataset[]): string | null {
  const matches = datasets.filter(dataset => dataset.DataSource === (template.Data.dataSource ?? 0))
  if (matches.length !== 1) return 'Набір даних збереженого варіанта зараз недоступний.'
  const error = datasetConfigurationError(template.Data, matches[0])
  if (error) return error
  try { validateStockReportRequest(template.Data) }
  catch (cause) { return cause instanceof Error ? cause.message : 'Налаштування збереженого варіанта не підтримуються.' }
  return null
}
