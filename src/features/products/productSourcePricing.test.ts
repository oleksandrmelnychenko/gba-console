import { describe, expect, it } from 'vitest'
import {
  buildEffectivePricingOrder,
  compareSourcePricingNames,
  getPricingBaseName,
  isPolishPricingName,
  isVatPricingName,
} from './productSourcePricing'

describe('product source pricing order', () => {
  it('orders ЦР → ЦО1 → ЦО2 with each VAT price right after its base price', () => {
    const names = ['ЦО2 (НДС)', 'ЦР', 'ЦО1', 'ЦР (НДС)', 'ЦО2', 'ЦО1 (НДС)']

    names.sort((left, right) => compareSourcePricingNames(left, right, new Map()))

    expect(names).toEqual(['ЦР', 'ЦР (НДС)', 'ЦО1', 'ЦО1 (НДС)', 'ЦО2', 'ЦО2 (НДС)'])
  })

  it('keeps the canonical order even when the effective order disagrees', () => {
    const order = buildEffectivePricingOrder([
      { Pricing: { Name: 'ЦО2' } },
      { Pricing: { Name: 'ЦО1' } },
      { Pricing: { Name: 'ЦР' } },
    ])
    const names = ['ЦО2', 'ЦО1', 'ЦР']

    names.sort((left, right) => compareSourcePricingNames(left, right, order))

    expect(names).toEqual(['ЦР', 'ЦО1', 'ЦО2'])
  })

  it('sorts other price types after the canonical ones following the effective order', () => {
    const order = buildEffectivePricingOrder([
      { Pricing: { Name: 'Інтернет' } },
      { Pricing: { Name: 'ЦЗ' } },
    ])
    const names = ['ЦЗ', 'ЦО2', 'Інтернет', 'ЦР (НДС)', 'ЦР']

    names.sort((left, right) => compareSourcePricingNames(left, right, order))

    expect(names).toEqual(['ЦР', 'ЦР (НДС)', 'ЦО2', 'Інтернет', 'ЦЗ'])
  })

  it('sorts price types unknown to both orders alphabetically at the end', () => {
    const names = ['ЦС', 'ЦЗ', 'ЦО1']

    names.sort((left, right) => compareSourcePricingNames(left, right, new Map()))

    expect(names).toEqual(['ЦО1', 'ЦЗ', 'ЦС'])
  })

  it('ranks names with Latin look-alike letters the same as pure Cyrillic ones', () => {
    // Real source data spells retail as "ЦP" with a Latin P (U+0050).
    const names = ['ЦО1 (НДС)', 'ЦО2 (НДС)', 'ЦP (НДС)', 'ЦP']

    names.sort((left, right) => compareSourcePricingNames(left, right, new Map()))

    expect(names).toEqual(['ЦP', 'ЦP (НДС)', 'ЦО1 (НДС)', 'ЦО2 (НДС)'])
  })

  it('detects VAT variants and strips the suffix for the base name', () => {
    expect(isVatPricingName('ЦО2 (НДС)')).toBe(true)
    expect(isVatPricingName('ЦО2')).toBe(false)
    expect(getPricingBaseName('ЦО2 (НДС)')).toBe('ЦО2')
    expect(getPricingBaseName(' ЦР ')).toBe('ЦР')
  })

  it('hides Polish price types in both Latin and mixed-script spellings', () => {
    expect(isPolishPricingName('PL rozn')).toBe(true)
    expect(isPolishPricingName('РL dill')).toBe(true)
    expect(isPolishPricingName('PL1')).toBe(true)
    expect(isPolishPricingName('ЦО2')).toBe(false)
  })
})
