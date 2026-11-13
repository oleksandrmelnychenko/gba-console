import { expect, it } from 'vitest'
import { competitorPriceBasisCaption } from './competitorPriceBasis'
import { describeFloorBasis } from './priceFloorBasis'

const plain = (value: string | null) => value?.replace(/\u00a0/g, ' ') ?? null

it('builds the competitor caption from the basis the service declares', () => {
  expect(competitorPriceBasisCaption({ currency: 'UAH', price_basis: 'shelf', vat_basis: 'unknown' }))
    .toBe('Ціни — грн, як на сторінці продавця; чи входить ПДВ — невідомо; фасування не приведено до єдиного базису.')
  expect(competitorPriceBasisCaption({ currency: 'UAH', price_basis: 'shelf', vat_basis: 'included' }))
    .toContain('; з ПДВ;')
  expect(competitorPriceBasisCaption({ currency: 'UAH', price_basis: 'net', vat_basis: 'other' }))
    .toBe('Ціни — грн, база ціни: net; ПДВ: other; фасування не приведено до єдиного базису.')
})

it('keeps the cautious caption before a search and for an older service', () => {
  const cautious = 'Ціни — грн, як на сторінці продавця; чи входить ПДВ — невідомо; фасування не приведено до єдиного базису.'
  expect(competitorPriceBasisCaption(null)).toBe(cautious)
  expect(competitorPriceBasisCaption({ currency: 'UAH' })).toBe(cautious)
})

it('describes the price floor only from the figures the service sends', () => {
  expect(plain(describeFloorBasis(12, 10.7))).toBe('мінімальна ціна: націнка 12 % на собівартість (маржа 10,7 %)')
  expect(plain(describeFloorBasis(12, null))).toBe('мінімальна ціна: націнка 12 % на собівартість')
  expect(plain(describeFloorBasis(undefined, 10.71))).toBe('мінімальна ціна: маржа 10,7 %')
  expect(describeFloorBasis(null, undefined)).toBeNull()
})
