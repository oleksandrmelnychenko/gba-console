import { describe, expect, it } from 'vitest'
import { isMoneyField, isMoneyValue } from './moneyTypography'

describe('money typography for mixed fields', () => {
  it.each(['Сума EUR', 'Поточний баланс', 'До оплати', 'TotalAmountLocal', 'overdue_eur_180plus', 'expected_value', 'Виручка, €'])(
    'recognizes monetary field %s', (field) => expect(isMoneyField(field)).toBe(true),
  )

  it.each(['Кількість', 'GrossWeight', 'Борг (днів)', 'debt_count', 'PriceType', 'VatPercent', 'margin_pct', 'ExchangeRate', 'Статус оплати', 'Вартість %'])(
    'does not treat a count, ratio or label as money: %s', (field) => expect(isMoneyField(field)).toBe(false),
  )

  it.each([0, -12.5, '0', '12,50', '€ 1 234,56', '1\u00a0234,56 UAH', 'USD -1,234.56', '−25 грн.', '1.234,50 zł'])(
    'recognizes amount %s', (value) => expect(isMoneyValue(value)).toBe(true),
  )

  it.each(['', ' ', 'Без передплати', 'Передплата 500 грн', '50%', '2026-08-27', '12.08.2026', null, undefined, true, Number.NaN, Number.POSITIVE_INFINITY, { amount: 12 }])(
    'keeps non-monetary content unchanged: %s', (value) => expect(isMoneyValue(value)).toBe(false),
  )
})
