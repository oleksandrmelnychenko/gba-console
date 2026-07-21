import { describe, expect, it } from 'vitest'
import { OUTCOME_OPERATION_TYPE } from './outgoingCreateTypes'
import { buildOutgoingClientReturnPayload } from './outgoingClientReturnPayload'

describe('buildOutgoingClientReturnPayload', () => {
  it('marks the payment order as a buyer return', () => {
    const payload = buildOutgoingClientReturnPayload({
      amount: 1250,
      clientAgreement: { NetUid: 'client-agreement' },
      comment: '  Повернення клієнту  ',
      exchangeRate: 1,
      fromDate: '2026-07-21T12:30:00.000Z',
      isAccounting: true,
      isManagementAccounting: false,
      organization: { NetUid: 'organization' },
      paymentCurrencyRegister: { NetUid: 'currency-register' },
      paymentMovement: { NetUid: 'payment-movement' },
      paymentRegister: { NetUid: 'payment-register' },
    })

    expect(payload).toMatchObject({
      Amount: 1250,
      ClientAgreement: { NetUid: 'client-agreement' },
      Comment: 'Повернення клієнту',
      IsUnderReport: false,
      OperationType: OUTCOME_OPERATION_TYPE.BuyerReturn,
      PaymentMovementOperation: {
        PaymentMovement: { NetUid: 'payment-movement' },
      },
    })
    expect(payload.OperationType).toBe(6)
  })
})
