import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_PAYMENT_REGISTER_TYPE,
} from '../accounting/accountingOperationCatalog'
import {
  parseOutgoingCashOrderRegisterType,
  validateOutgoingCashOrderForm,
} from './outgoingCashOrderPolicy'

const t = (value: string) => value

const validInput = {
  amount: 150,
  selectedColleague: { Id: 1 },
  selectedCurrencyRegister: {
    Currency: { Code: 'EUR', Id: 2 },
    Id: 3,
  },
  selectedMovement: { Id: 4 },
  selectedOrganization: { Id: 5 },
  selectedRegister: { Id: 6 },
  t,
}

describe('outgoing accountable-person transfer policy', () => {
  it.each([
    ['0', ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash],
    ['2', ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank],
  ])('parses register type %s from the canonical route', (value, expected) => {
    expect(parseOutgoingCashOrderRegisterType(value)).toBe(expected)
  })

  it.each([null, '', '1', '33'])(
    'rejects unsupported register filter %s',
    (value) => {
      expect(parseOutgoingCashOrderRegisterType(value)).toBeNull()
    },
  )

  it('accepts the complete accountable-person transfer form', () => {
    expect(validateOutgoingCashOrderForm(validInput)).toBeNull()
  })

  it.each([
    ['organization', { selectedOrganization: null }, 'Організація'],
    ['register', { selectedRegister: null }, 'Грошові рахунки'],
    ['currency', { selectedCurrencyRegister: null }, 'Валюта'],
    [
      'movement',
      { selectedMovement: null },
      'Виберіть статтю грошових витрат',
    ],
    [
      'accountable person',
      { selectedColleague: null },
      'Виберіть відповідального',
    ],
    ['amount', { amount: 0 }, 'Сума'],
  ])('requires the %s field', (_, override, expectedError) => {
    expect(
      validateOutgoingCashOrderForm({
        ...validInput,
        ...override,
      }),
    ).toBe(expectedError)
  })
})
