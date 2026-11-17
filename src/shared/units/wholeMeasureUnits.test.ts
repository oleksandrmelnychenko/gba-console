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

  it('reads the unit name word by word, like the server', () => {
    expect(isWholeMeasureUnit('QA шт')).toBe(true)
    expect(isWholeMeasureUnit('шт (упак.)')).toBe(true)
    expect(isWholeMeasureUnit('Комплект')).toBe(true)
    expect(isWholeMeasureUnit('szt')).toBe(true)
    expect(isWholeMeasureUnit('QA од')).toBe(false)
    expect(isWholeMeasureUnit('штрих')).toBe(false)
    expect(isWholeMeasureUnit('D1 л')).toBe(false)
  })
})
