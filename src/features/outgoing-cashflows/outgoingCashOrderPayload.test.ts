import { describe, expect, it } from 'vitest'
import { PaymentRegisterType } from '../income-cashflows/types'
import { OUTCOME_OPERATION_TYPE, type CreateFormState } from './outgoingCreateTypes'
import { buildOutgoingCashOrderPayload } from './outgoingCashOrderPayload'

const baseForm: CreateFormState = {
  amount: 150,
  comment: '  Витрати  ',
  date: '2026-07-26',
  invoiceNumber: '',
  isAccounting: false,
  isManagementAccounting: true,
  movementSearch: '',
  organizationValue: '',
  paymentPurpose: '  Господарські витрати  ',
  paymentRegisterValue: '',
  selectedColleagueValue: '',
  selectedCurrencyRegisterValue: '',
  selectedMovementValue: '',
  time: '12:30',
  userSearch: '',
}

describe('buildOutgoingCashOrderPayload', () => {
  it.each([
    ['bank', PaymentRegisterType.Bank, 'EUR'],
    ['cash', PaymentRegisterType.Cash, 'UAH'],
  ])('creates a %s transfer-to-colleague with its exact account and currency', (_, registerType, currencyCode) => {
    const payload = buildOutgoingCashOrderPayload({
      colleague: { Id: 7 },
      form: baseForm,
      selectedCurrencyRegister: {
        Currency: { Code: currencyCode, Id: currencyCode === 'EUR' ? 2 : 10038 },
        Id: 2,
      },
      selectedMovement: { Id: 3 },
      selectedOrganization: { Id: 1 },
      selectedRegister: { Id: 4, Type: registerType },
    })

    expect(payload).toMatchObject({
      Amount: 150,
      Colleague: { Id: 7 },
      Comment: 'Витрати',
      FromDate: '2026-07-26T12:30:00',
      IsAccounting: false,
      IsManagementAccounting: true,
      IsUnderReport: true,
      OperationType: OUTCOME_OPERATION_TYPE.TransferToColleague,
      Organization: { Id: 1 },
      PaymentCurrencyRegister: {
        Currency: { Code: currencyCode },
        Id: 2,
      },
      PaymentMovementOperation: {
        PaymentMovement: { Id: 3 },
      },
      PaymentPurpose: 'Господарські витрати',
      PaymentRegister: {
        Id: 4,
        Type: registerType,
      },
    })
    expect(payload.ClientAgreement).toBeUndefined()
    expect(payload.SupplyOrganizationAgreement).toBeUndefined()
  })
})
