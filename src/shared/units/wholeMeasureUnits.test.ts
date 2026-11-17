import { describe, expect, it } from 'vitest'
import { isWholeMeasureUnit } from './wholeMeasureUnits'

describe('isWholeMeasureUnit', () => {
  it('recognises piece units with or without a trailing dot', () => {
    expect(isWholeMeasureUnit('шт')).toBe(true)
    expect(isWholeMeasureUnit('Шт.')).toBe(true)
    expect(isWholeMeasureUnit('компл')).toBe(true)
    expect(isWholeMeasureUnit('наб')).toBe(true)
  })

  it('leaves measured units fractional', () => {
    expect(isWholeMeasureUnit('кг')).toBe(false)
    expect(isWholeMeasureUnit('л')).toBe(false)
    expect(isWholeMeasureUnit(undefined)).toBe(false)
  })
})
