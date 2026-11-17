import { describe, expect, it } from 'vitest'
import { normalizeCustomsCode, validateCustomsCode } from './customsCode'

const t = (key: string) => key

describe('customs code', () => {
  it('accepts 4 to 10 digits, ignoring spaces between groups', () => {
    expect(validateCustomsCode('8421230000', t)).toBeNull()
    expect(validateCustomsCode('8421 23 00 00', t)).toBeNull()
    expect(normalizeCustomsCode('8421 23 00 00')).toBe('8421230000')
  })

  it('refuses markup, letters and overlong values before calling the server', () => {
    expect(validateCustomsCode('<b>x</b>😀' + '1'.repeat(120), t)).toBe('Митний код (УКТЗЕД) — від 4 до 10 цифр')
    expect(validateCustomsCode('12345678901', t)).toBe('Митний код (УКТЗЕД) — від 4 до 10 цифр')
    expect(validateCustomsCode('   ', t)).toBe('Заповніть поле - Митний код')
  })
})
