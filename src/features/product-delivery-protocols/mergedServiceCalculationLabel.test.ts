import { describe, expect, it } from 'vitest'
import { SupplyExtraChargeType } from './detailTypes'
import { getMergedServiceCalculationLabel } from './mergedServiceCalculationLabel'

const t = (value: string) => value

describe('merged service calculation label', () => {
  it('does not show a label for uncalculated services', () => {
    expect(getMergedServiceCalculationLabel({ IsCalculatedValue: false }, t)).toBeNull()
  })

  it('shows manual calculation label', () => {
    expect(getMergedServiceCalculationLabel({ IsCalculatedValue: true, IsAutoCalculatedValue: false }, t)).toBe('Розраховано вручну')
  })

  it('shows price auto calculation label by default', () => {
    expect(getMergedServiceCalculationLabel({ IsCalculatedValue: true, IsAutoCalculatedValue: true }, t)).toBe('Розраховано по ціні')
  })

  it('shows weight auto calculation label', () => {
    expect(getMergedServiceCalculationLabel({
      IsAutoCalculatedValue: true,
      IsCalculatedValue: true,
      SupplyExtraChargeType: SupplyExtraChargeType.Weight,
    }, t)).toBe('Розраховано по вазі')
  })

  it('shows volume auto calculation label', () => {
    expect(getMergedServiceCalculationLabel({
      IsAutoCalculatedValue: true,
      IsCalculatedValue: true,
      SupplyExtraChargeType: SupplyExtraChargeType.Volume,
    }, t)).toBe("Розраховано по об'єму")
  })
})
