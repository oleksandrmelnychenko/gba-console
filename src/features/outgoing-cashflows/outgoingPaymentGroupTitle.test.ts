import { describe, expect, it } from 'vitest'
import { PaymentRegisterType } from '../income-cashflows/types'
import { OUTCOME_OPERATION_TYPE } from './outgoingCreateTypes'
import {
  getOutgoingPaymentGroupTitle,
  parseOutgoingPaymentOperationType,
  parseOutgoingPaymentRegisterType,
} from './outgoingPaymentGroupTitle'

const t = (value: string) => value

describe('outgoing payment group title', () => {
  it('parses supported deep-link operation and register values', () => {
    expect(
      parseOutgoingPaymentOperationType(
        String(OUTCOME_OPERATION_TYPE.BuyerReturn),
      ),
    ).toBe(OUTCOME_OPERATION_TYPE.BuyerReturn)
    expect(
      parseOutgoingPaymentRegisterType(
        String(PaymentRegisterType.Cash),
      ),
    ).toBe(PaymentRegisterType.Cash)
  })

  it('uses safe supplier and bank defaults for invalid values', () => {
    expect(
      parseOutgoingPaymentOperationType('invalid'),
    ).toBe(OUTCOME_OPERATION_TYPE.PaymentToSupplier)
    expect(
      parseOutgoingPaymentRegisterType('invalid'),
    ).toBe(PaymentRegisterType.Bank)
  })

  it('keeps the drawer title synchronized with operation and register', () => {
    expect(
      getOutgoingPaymentGroupTitle(
        OUTCOME_OPERATION_TYPE.PaymentToSupplier,
        PaymentRegisterType.Bank,
        t,
      ),
    ).toBe('Оплата постачальнику, банківський')
    expect(
      getOutgoingPaymentGroupTitle(
        OUTCOME_OPERATION_TYPE.OtherOutcome,
        PaymentRegisterType.Cash,
        t,
      ),
    ).toBe('Інші витрати грошових коштів')
  })
})
