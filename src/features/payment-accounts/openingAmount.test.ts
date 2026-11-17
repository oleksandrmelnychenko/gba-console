import { describe, expect, it } from 'vitest'
import { getOpeningAmountError } from './openingAmount'

describe('register opening amount (bank#3)', () => {
  it('rejects letters instead of saving 0', () => {
    expect(getOpeningAmountError('abc')).toBe('Введіть число, наприклад 1234,56')
  })

  it('rejects a third decimal before the server answers in English', () => {
    expect(getOpeningAmountError('1.555')).toBe('Не більше 2 знаків після коми')
  })

  it('accepts empty, comma and dot amounts', () => {
    expect(getOpeningAmountError('')).toBeNull()
    expect(getOpeningAmountError('1 234,56')).toBeNull()
    expect(getOpeningAmountError('10.5')).toBeNull()
  })

  it('reports a minus', () => {
    expect(getOpeningAmountError('-5')).toBe('Від’ємне значення не допускається')
  })
})
