import { describe, expect, it } from 'vitest'
import { OUTCOME_OPERATION_TYPE } from './outgoingCreateTypes'
import { buildOutgoingOrganizationPaymentPayload } from './outgoingOrganizationPaymentPayload'

describe('buildOutgoingOrganizationPaymentPayload', () => {
  it('marks a service-supplier balance payment as supplier payment', () => {
    const payload = buildOutgoingOrganizationPaymentPayload({
      amount: 875,
      comment: '  Поповнення балансу  ',
      exchangeRate: 1,
      fromDate: '2026-07-26T09:00:00.000Z',
      isAccounting: true,
      isManagementAccounting: false,
      organization: { Id: 1 },
      paymentCurrencyRegister: { Id: 2 },
      paymentMovement: { Id: 3 },
      paymentRegister: { Id: 4 },
      supplyOrganization: { Id: 5 },
      supplyOrganizationAgreement: { Id: 6 },
    })

    expect(payload).toMatchObject({
      Comment: 'Поповнення балансу',
      ConsumableProductOrganization: { Id: 5 },
      IsUnderReport: false,
      OperationType: OUTCOME_OPERATION_TYPE.PaymentToSupplier,
      SupplyOrganizationAgreement: { Id: 6 },
    })
  })
})
