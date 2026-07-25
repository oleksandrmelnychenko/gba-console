import { describe, expect, it } from 'vitest'
import { buildUkraineMergedServiceFromForm } from '../buildUkraineMergedService'
import type { NewMergedServiceFormValues } from '../types'

describe('buildUkraineMergedServiceFromForm', () => {
  it('creates distinct true-new management and accounting payment tasks', () => {
    const values = createFormValues()

    const service = buildUkraineMergedServiceFromForm(values)

    expect(service.SupplyPaymentTask).toMatchObject({
      Comment: 'Оплатити',
      IsAccounting: false,
      PayToDate: '2026-07-25T00:00:00.000Z',
      User: values.responsibleForPayment,
    })
    expect(service.AccountingPaymentTask).toMatchObject({
      Comment: 'Оплатити',
      IsAccounting: true,
      PayToDate: '2026-07-25T00:00:00.000Z',
      User: values.responsibleForPayment,
    })
    expect(service.SupplyPaymentTask).not.toBe(service.AccountingPaymentTask)
    expect(service.SupplyPaymentTask).not.toHaveProperty('Id')
    expect(service.SupplyPaymentTask).not.toHaveProperty('NetUid')
    expect(service.AccountingPaymentTask).not.toHaveProperty('Id')
    expect(service.AccountingPaymentTask).not.toHaveProperty('NetUid')
  })
})

function createFormValues(): NewMergedServiceFormValues {
  return {
    accountDocuments: [],
    accountingExchangeRate: '',
    agreement: {
      Id: 5,
      NetUid: '5f9d65fd-cfb8-4bfb-b7b2-b9e429e812b0',
    },
    comment: 'Оплатити',
    consumableProduct: null,
    createAccountingTask: false,
    createTask: false,
    exchangeRate: '',
    files: [],
    fromDate: new Date('2026-07-25T00:00:00.000Z'),
    grossPrice: '100',
    grossPriceAccounting: '120',
    invoiceNumber: 'INV-1',
    isIncludeAccountingValue: false,
    isSupplyInformationTask: false,
    name: 'Доставка',
    payToDate: new Date('2026-07-25T00:00:00.000Z'),
    percent: '20',
    percentAccounting: '20',
    responsibleForPayment: {
      Id: 7,
      NetUid: '5e7c13cc-c2e7-486d-b84e-99582074ef26',
    },
    supplyInformationTaskComment: '',
    supplyInformationTaskGrossPrice: '',
    supplyOrganization: {
      Id: 3,
      NetUid: '1a22c634-737f-40ab-8344-a479e1ddc5aa',
    },
  }
}
