import { describe, expect, it } from 'vitest'
import { parseSpecificationAmount } from './productSpecificationAmounts'

const t = (value: string) => value

describe('parseSpecificationAmount', () => {
  it('accepts empty and sane non-negative amounts', () => {
    expect(parseSpecificationAmount('', t)).toEqual({ error: null, value: undefined })
    expect(parseSpecificationAmount(0, t)).toEqual({ error: null, value: 0 })
    expect(parseSpecificationAmount('12,5', t)).toEqual({ error: null, value: 12.5 })
  })

  it('rejects negative, non-numeric and absurd values', () => {
    expect(parseSpecificationAmount(-100, t).error).toBe('Значення не може бути відʼємним')
    expect(parseSpecificationAmount('abc', t).error).toBe('Вкажіть число')
    expect(parseSpecificationAmount(99999999999999, t).error).toBe('Занадто велике значення (максимум 1 000 000 000)')
    expect(parseSpecificationAmount(Number.POSITIVE_INFINITY, t).error).toBe('Вкажіть число')
  })
})
