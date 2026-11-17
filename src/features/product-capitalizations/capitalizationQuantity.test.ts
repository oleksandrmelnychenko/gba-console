import { describe, expect, it } from 'vitest'
import { formatCapitalizationQtyText, parseCapitalizationQty, readCapitalizationQtyValue } from './capitalizationQuantity'

const t = (text: string, values?: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_match, key: string) => String(values?.[key] ?? ''))

/* /products/capitalization › «Оприходування» › Кількість (full-warehouse.json, deep-lots.json). Before: typed «2,5» and
   «2.5» → 25, pasted «2,5» → 2, 0 → 1, -3 → 3; an imported 2,5 l was posted as 2. */
describe('capitalization «Кількість»', () => {
  it.each([
    ['2,5', 2.5],
    ['2.5', 2.5],
    [' 2,5 ', 2.5],
    ['0,001', 0.001],
  ])('keeps «%s» as %s for a litre product', (input, qty) => {
    expect(parseCapitalizationQty(input, 'D1 л', t)).toEqual({ error: null, qty })
  })

  it.each([
    ['0', 'Кількість має бути більшою за 0'],
    ['-3', 'Кількість не може бути від’ємною'],
    ['1e3', 'Введіть число'],
    ['1 000', 'Введіть число'],
    ['', 'Вкажіть кількість'],
  ])('refuses «%s» instead of changing it: %s', (input, error) => {
    expect(parseCapitalizationQty(input, 'D1 л', t).error).toBe(error)
  })

  it('needs whole pieces for «QA шт» and takes them as typed', () => {
    expect(parseCapitalizationQty('2,5', 'QA шт', t).error).toBe('Для одиниці «QA шт» кількість має бути цілою')
    expect(parseCapitalizationQty('3', 'QA шт', t)).toEqual({ error: null, qty: 3 })
  })

  it('accepts a fraction when the unit is not known (the server checks the file rows)', () => {
    expect(parseCapitalizationQty('2,5', undefined, t)).toEqual({ error: null, qty: 2.5 })
  })

  it('shows an imported quantity as it is: 2.5 stays 2,5 up to «Провести», a minus stays and is flagged', () => {
    expect(formatCapitalizationQtyText(2.5)).toBe('2,5')
    expect(parseCapitalizationQty(formatCapitalizationQtyText(2.5), 'D1 л', t).qty).toBe(2.5)
    expect(formatCapitalizationQtyText(-2)).toBe('-2')
    expect(readCapitalizationQtyValue('-2')).toBe(-2)
    expect(readCapitalizationQtyValue('2,5')).toBe(2.5)
    expect(readCapitalizationQtyValue('abc')).toBeUndefined()
    expect(formatCapitalizationQtyText(undefined)).toBe('')
  })
})
