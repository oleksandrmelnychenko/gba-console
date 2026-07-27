import { describe, expect, it } from 'vitest'
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
  it('creates a transfer-to-colleague operation for an under-report payment', () => {
    const payload = buildOutgoingCashOrderPayload({
      colleague: { Id: 7 },
      form: baseForm,
      selectedCurrencyRegister: { Id: 2 },
      selectedMovement: { Id: 3 },
      selectedOrganization: { Id: 1 },
      selectedRegister: { Id: 4 },
    })

    expect(payload).toMatchObject({
      Colleague: { Id: 7 },
      IsUnderReport: true,
      OperationType: OUTCOME_OPERATION_TYPE.TransferToColleague,
    })
  })
})
