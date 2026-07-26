import { describe, expect, it } from 'vitest'
import { PaymentRegisterType } from '../income-cashflows/types'
import {
  OUTCOME_OPERATION_TYPE,
  type OutcomeOperationType,
} from './outgoingCreateTypes'
import {
  buildOutgoingPaymentGroupPayload,
  type OutgoingPaymentGroupPayloadForm,
} from './outgoingPaymentGroupPayload'

const baseForm: OutgoingPaymentGroupPayloadForm = {
  amount: 4435,
  comment: '  Тест валюти та балансу  ',
  date: '2026-07-20',
  exchangeRate: 44.35,
  isAccounting: true,
  isManagementAccounting: false,
  paymentPurpose: '  Оплата за документом  ',
  time: '12:30',
  vatAmount: 0,
  vatRate: 0,
}

const client = { Id: 21, Name: 'Покупець' }
const clientAgreement = {
  Id: 22,
  Agreement: {
    Currency: { Code: 'EUR', Id: 2 },
  },
}
const supplier = { Id: 31, Name: 'Постачальник' }
const supplierAgreement = {
  Currency: { Code: 'EUR', Id: 2 },
  Id: 32,
}

function buildPayload(
  operationType: OutcomeOperationType,
  registerType: number,
  partner: 'client' | 'none' | 'supplier',
) {
  return buildOutgoingPaymentGroupPayload({
    form: baseForm,
    operationType,
    selectedClient: partner === 'client' ? client : null,
    selectedClientAgreement:
      partner === 'client' ? clientAgreement : null,
    selectedCurrencyRegister: {
      Currency: { Code: 'UAH', Id: 10038 },
      Id: 41,
    },
    selectedMovement: { Id: 51 },
    selectedOrganization: { Id: 61 },
    selectedRegister: { Id: 71, Type: registerType },
    selectedSupplyAgreement:
      partner === 'supplier' ? supplierAgreement : null,
    selectedSupplyOrganization:
      partner === 'supplier' ? supplier : null,
    selectedUnpaidOrders: [],
  })
}

describe('buildOutgoingPaymentGroupPayload', () => {
  it.each([
    [
      'оплату постачальнику',
      OUTCOME_OPERATION_TYPE.PaymentToSupplier,
      'supplier',
    ],
    [
      'повернення покупцю',
      OUTCOME_OPERATION_TYPE.BuyerReturn,
      'client',
    ],
    [
      'інші розрахунки з контрагентом',
      OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts,
      'client',
    ],
    [
      'інше списання',
      OUTCOME_OPERATION_TYPE.OtherOutcome,
      'none',
    ],
  ] as const)(
    'creates %s for both bank and cash without losing its operation type',
    (_, operationType, partner) => {
      for (const registerType of [
        PaymentRegisterType.Bank,
        PaymentRegisterType.Cash,
      ]) {
        const payload = buildPayload(operationType, registerType, partner)

        expect(payload).toMatchObject({
          Amount: 4435,
          Comment: 'Тест валюти та балансу',
          ExchangeRate: 44.35,
          FromDate: '2026-07-20T12:30:00',
          IsAccounting: true,
          IsManagementAccounting: false,
          IsUnderReport: false,
          OperationType: operationType,
          PaymentCurrencyRegister: {
            Currency: { Code: 'UAH', Id: 10038 },
            Id: 41,
          },
          PaymentPurpose: 'Оплата за документом',
          PaymentRegister: {
            Id: 71,
            Type: registerType,
          },
        })
      }
    },
  )

  it('uses the supplier agreement only for a supplier operation', () => {
    const payload = buildPayload(
      OUTCOME_OPERATION_TYPE.PaymentToSupplier,
      PaymentRegisterType.Bank,
      'supplier',
    )

    expect(payload).toMatchObject({
      ConsumableProductOrganization: supplier,
      SupplyOrganizationAgreement: supplierAgreement,
    })
    expect(payload.Client).toBeUndefined()
    expect(payload.ClientAgreement).toBeUndefined()
  })

  it.each([
    OUTCOME_OPERATION_TYPE.BuyerReturn,
    OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts,
  ])('uses the client agreement for operation %s', (operationType) => {
    const payload = buildPayload(
      operationType,
      PaymentRegisterType.Cash,
      'client',
    )

    expect(payload.ClientAgreement).toEqual(clientAgreement)
    expect(payload.Client).toBeUndefined()
    expect(payload.ConsumableProductOrganization).toBeUndefined()
    expect(payload.SupplyOrganizationAgreement).toBeUndefined()
  })

  it('keeps an other-expense payment partnerless', () => {
    const payload = buildPayload(
      OUTCOME_OPERATION_TYPE.OtherOutcome,
      PaymentRegisterType.Bank,
      'none',
    )

    expect(payload.Client).toBeUndefined()
    expect(payload.ClientAgreement).toBeUndefined()
    expect(payload.ConsumableProductOrganization).toBeUndefined()
    expect(payload.SupplyOrganizationAgreement).toBeUndefined()
  })
})
