import { describe, expect, it } from 'vitest'
import { buildIncomeConfirmLines, isFutureOrderDate } from './incomeCashflowConfirm'

describe('income create confirmation', () => {
  it('flags a date after today in the user calendar (cash#16, currency#8)', () => {
    const now = new Date(2026, 10, 17, 23, 30)
    expect(isFutureOrderDate('2030-12-31', now)).toBe(true)
    expect(isFutureOrderDate('2026-11-18', now)).toBe(true)
    expect(isFutureOrderDate('2026-11-17', now)).toBe(false)
    expect(isFutureOrderDate('2026-11-01', now)).toBe(false)
    expect(isFutureOrderDate('', now)).toBe(false)
  })

  it('repeats payer, amount with currency, register and date (cash#17)', () => {
    expect(buildIncomeConfirmLines({
      amount: 1234.5,
      currencyCode: 'UAH',
      date: '2026-11-17',
      formatMoney: (value) => value.toFixed(2).replace('.', ','),
      payer: 'CH2 Покупець',
      register: 'CH2 Каса UAH',
    })).toEqual([
      { label: 'Платник', value: 'CH2 Покупець' },
      { label: 'Сума', value: '1234,50 UAH' },
      { label: 'Каса / рахунок', value: 'CH2 Каса UAH' },
      { label: 'Дата', value: '17.11.2026' },
    ])
  })
})
