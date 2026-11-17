import { describe, expect, it } from 'vitest'
import { formatQuantityForInput, parseQuantityInput } from './quantityInput'

const t = (text: string, values?: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_match, key: string) => String(values?.[key] ?? ''))

describe('parseQuantityInput', () => {
  it('reads a decimal comma or dot for measured units', () => {
    expect(parseQuantityInput('1,5', { unit: 'кг' }, t)).toEqual({ error: null, qty: 1.5 })
    expect(parseQuantityInput('2.5', { unit: 'л' }, t)).toEqual({ error: null, qty: 2.5 })
  })

  it('refuses fractions of pieces, negatives, text and more than available', () => {
    expect(parseQuantityInput('1,5', { unit: 'шт' }, t).error).toBe('Для одиниці «шт» кількість має бути цілою')
    expect(parseQuantityInput('-1', {}, t).error).toBe('Кількість не може бути від’ємною')
    expect(parseQuantityInput('1e3', {}, t).error).toBe('Введіть число')
    expect(parseQuantityInput('1000', { available: 95.5 }, t).error).toBe('Більше, ніж доступно (95,5)')
    expect(parseQuantityInput('', {}, t).error).toBe('Вкажіть кількість')
  })

  it('shows stored quantities with a decimal comma', () => {
    expect(formatQuantityForInput(95.5)).toBe('95,5')
    expect(formatQuantityForInput(0)).toBe('')
  })
})
