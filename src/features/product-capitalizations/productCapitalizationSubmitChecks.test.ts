import { notifications } from '@mantine/notifications'
import { describe, expect, it, vi } from 'vitest'
import { hasNegativeValue, showSubmitNotice } from './productCapitalizationSubmitChecks'

vi.mock('@mantine/notifications', () => ({ notifications: { hide: vi.fn(), show: vi.fn() } }))

describe('capitalization submit checks (WH2-16)', () => {
  it('flags negative quantity, price or weight from an import', () => {
    expect(hasNegativeValue({ Qty: -2, UnitPrice: 10, Weight: 0.5 })).toBe(true)
    expect(hasNegativeValue({ Qty: 2, UnitPrice: -10, Weight: 0.5 })).toBe(true)
    expect(hasNegativeValue({ Qty: 2, UnitPrice: 10, Weight: -0.5 })).toBe(true)
    expect(hasNegativeValue({ Qty: 2, UnitPrice: 10, Weight: 0.5 })).toBe(false)
  })

  it('replaces the previous notice instead of stacking a copy per click', () => {
    showSubmitNotice({ color: 'yellow', message: 'Заповніть поле - Кількість' })
    showSubmitNotice({ color: 'yellow', message: 'Заповніть поле - Кількість' })

    expect(notifications.hide).toHaveBeenCalledWith('product-capitalization-submit')
    expect(vi.mocked(notifications.show).mock.calls.every(([options]) => options.id === 'product-capitalization-submit')).toBe(true)
  })
})
