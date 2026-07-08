import { describe, expect, it } from 'vitest'

import {
  hasDirectOrderProductIncome,
  normalizeDirectOrderProductIncome,
} from './directOrderProductIncomeApi'

describe('direct order product income api helpers', () => {
  it('treats empty payloads as missing income', () => {
    expect(normalizeDirectOrderProductIncome(null)).toBeNull()
    expect(normalizeDirectOrderProductIncome({})).toBeNull()
    expect(hasDirectOrderProductIncome(null)).toBe(false)
  })

  it('keeps real income payloads even when only number is available', () => {
    const income = normalizeDirectOrderProductIncome({ Number: '00000042' })

    expect(income?.Number).toBe('00000042')
    expect(hasDirectOrderProductIncome(income)).toBe(true)
  })
})
