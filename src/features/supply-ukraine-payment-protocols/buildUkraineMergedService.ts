import type {
  MergedService,
  NewMergedServiceFormValues,
  SupplyInformationTask,
} from './types'

/**
 * A priced service carries its new payment tasks («Сплатити до», «Відповідальний за оплату») so the server saves
 * the service, its acts and its tasks together. The server accepts them only from a caller who also holds the
 * payment-task create key (`orders.ukraine.logistic_way.create_payment_task`); without it the service is sent
 * without tasks, which can be added later on the service card by someone who holds the key.
 */
export function buildUkraineMergedServiceFromForm(
  values: NewMergedServiceFormValues,
  { canCreatePaymentTask = true }: { canCreatePaymentTask?: boolean } = {},
): MergedService {
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
  }

  if (canCreatePaymentTask && Number(values.grossPrice) > 0) {
    service.SupplyPaymentTask = {
      Comment: values.comment,
      IsAccounting: false,
      PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
      User: values.responsibleForPayment,
    }
  }

  if (Number(values.grossPriceAccounting) > 0) {
    service.AccountingActProvidingService = {}
  }

  if (canCreatePaymentTask && Number(values.grossPriceAccounting) > 0) {
    service.AccountingPaymentTask = {
      Comment: values.comment,
      IsAccounting: true,
      PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
      User: values.responsibleForPayment,
    }
  }

  return service
}
