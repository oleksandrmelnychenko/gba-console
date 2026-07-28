import { describe, expect, it } from 'vitest'
import type { AvailablePaymentTaskModel } from '../types'
import { validateAvailablePaymentOutcomeForm } from './availablePaymentOutcomePolicy'

const t = (value: string) => value

const validInput = {
  amount: 100,
  date: '2026-07-28',
  outcomeModels: [{ id: 'task-1' }] as AvailablePaymentTaskModel[],
  selectedCurrencyRegister: {
    Currency: { Code: 'EUR', Id: 2 },
    Id: 3,
  },
  selectedMovement: { Id: 4 },
  selectedOrganization: { Id: 5 },
  selectedRegister: { Id: 6 },
  t,
  time: '12:30',
}

describe('available payment outcome form policy', () => {
  it('accepts a complete payment-task outcome form', () => {
    expect(validateAvailablePaymentOutcomeForm(validInput)).toBeNull()
  })

  it.each([
    ['tasks', { outcomeModels: [] }, 'Виберіть платіжні задачі'],
    ['date', { date: '2026-02-30' }, 'Вкажіть дату видаткового ордера'],
    ['time', { time: '25:00' }, 'Вкажіть час видаткового ордера'],
    ['organization', { selectedOrganization: null }, 'Організація'],
    ['register', { selectedRegister: null }, 'Грошові рахунки'],
    ['currency', { selectedCurrencyRegister: null }, 'Валюта'],
    [
      'movement',
      { selectedMovement: null },
      'Виберіть статтю грошових витрат',
    ],
    ['amount', { amount: 0 }, 'Сума'],
  ])('requires the %s field', (_, override, expectedError) => {
    expect(
      validateAvailablePaymentOutcomeForm({
        ...validInput,
        ...override,
      }),
    ).toBe(expectedError)
  })
})
