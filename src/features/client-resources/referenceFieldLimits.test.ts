import { describe, expect, it } from 'vitest'
import { validateCurrencyLimits, validateMeasureUnitLimits, validateStorageLimits } from './referenceFieldLimits'

const t = (text: string) => text

describe('client resource field limits', () => {
  it('accepts currency codes of 2-25 characters A-Z, 0-9 and «-»', () => {
    expect(validateCurrencyLimits({ Code: 'UAH', Name: 'Гривня' }, t)).toBeNull()
    expect(validateCurrencyLimits({ Code: 'USD-CASH-2', Name: 'Долар' }, t)).toBeNull()
  })

  it('rejects other currency codes with a Ukrainian message', () => {
    for (const code of ['', 'U', 'uah', 'UA H', 'ГРН', 'A'.repeat(26)]) {
      expect(validateCurrencyLimits({ Code: code, Name: 'Валюта' }, t)).toMatch(/^Код валюти/)
    }
    expect(validateCurrencyLimits({ Code: 'UAH', Name: 'x'.repeat(151) }, t)).toMatch(/150/)
  })

  it('limits the storage name to its 40-character column (a 315-character name hung the save)', () => {
    expect(validateStorageLimits({ Name: 'x'.repeat(40) }, t)).toBeNull()
    expect(validateStorageLimits({ Name: `  ${'x'.repeat(40)}  ` }, t)).toBeNull()
    expect(validateStorageLimits({ Name: 'Я'.repeat(315) }, t)).toBe('Назва складу не може бути довшою за 40 символів.')
  })

  it('limits measure unit name and 1C code to 25', () => {
    expect(validateMeasureUnitLimits({ CodeOneC: '796', Name: 'шт' }, t)).toBeNull()
    expect(validateMeasureUnitLimits({ CodeOneC: '796', Name: 'x'.repeat(26) }, t)).toMatch(/25/)
    expect(validateMeasureUnitLimits({ CodeOneC: '7'.repeat(26), Name: 'шт' }, t)).toMatch(/25/)
  })
})
