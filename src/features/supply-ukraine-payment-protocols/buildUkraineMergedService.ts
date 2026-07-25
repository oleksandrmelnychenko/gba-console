import type {
  MergedService,
  NewMergedServiceFormValues,
  SupplyInformationTask,
} from './types'

export function buildUkraineMergedServiceFromForm(values: NewMergedServiceFormValues): MergedService {
  const service: MergedService = {
    AccountingGrossPrice: Number(values.grossPriceAccounting) || 0,
    AccountingVatPercent: Number(values.percentAccounting) || 0,
    ConsumableProduct: values.consumableProduct,
    FromDate: values.fromDate ? values.fromDate.toISOString() : undefined,
    GrossPrice: Number(values.grossPrice) || 0,
    IsIncludeAccountingValue: values.isIncludeAccountingValue,
    Name: values.name,
    Number: values.invoiceNumber,
    SupplyOrganization: values.supplyOrganization,
    SupplyOrganizationAgreement: values.agreement,
    VatPercent: Number(values.percent) || 0,
  }

  if (values.exchangeRate && Number(values.exchangeRate) > 0) {
    service.ExchangeRate = Number(values.exchangeRate)
  }

  if (values.accountingExchangeRate && Number(values.accountingExchangeRate) > 0) {
    service.AccountingExchangeRate = Number(values.accountingExchangeRate)
  }

  if (values.isSupplyInformationTask) {
    const informationTask: SupplyInformationTask = {
      Comment: values.supplyInformationTaskComment,
      GrossPrice: Number(values.supplyInformationTaskGrossPrice) || 0,
    }
    service.SupplyInformationTask = informationTask
  }

  if (Number(values.grossPrice) > 0) {
    service.ActProvidingService = {}
    service.SupplyPaymentTask = {
      Comment: values.comment,
      IsAccounting: false,
      PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
      User: values.responsibleForPayment,
    }
  }

  if (Number(values.grossPriceAccounting) > 0) {
    service.AccountingActProvidingService = {}
    service.AccountingPaymentTask = {
      Comment: values.comment,
      IsAccounting: true,
      PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
      User: values.responsibleForPayment,
    }
  }

  return service
}
