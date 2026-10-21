import { describe, expect, it } from 'vitest'
import { formatReportDecimal, readNumberPresentation, numberPresentationError, reportValueUnit, type ReportValueSemantics } from './reportNumberPresentation'
import { nativeReportMeasurementUnit } from './nativeReportProfiles'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import type { ReportRequestBody } from '../types'
const money: ReportValueSemantics = { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 }
const request: ReportRequestBody = { dataSource: 38, from: '2026-10-01', to: '2026-10-21', selections: [], sorted: { Row: [], Col: [], Measurements: [] } }
describe('report numeric presentation', () => {
  it('rounds positive and negative midpoint away from zero without floating point and preserves large significant digits', () => {
    expect(formatReportDecimal('1234.567', money, { version: 1, moneyScale: 1000 })).toBe('1,23')
    expect(formatReportDecimal('-1235', money, { version: 1, moneyScale: 1000 })).toBe('-1,24')
    expect(formatReportDecimal('1235', money, { version: 1, moneyScale: 1000 })).toBe('1,24')
    expect(formatReportDecimal('900719925474099312345.995', money, { version: 1, moneyScale: 1 })).toBe('900\u00a0719\u00a0925\u00a0474\u00a0099\u00a0312\u00a0346,00')
    expect(formatReportDecimal('-0.004', money, { version: 1, moneyScale: 1 })).toBe('0,00')
  })
  it('scales only eligible money, not quantity, percentages, counts, rates or unit prices', () => {
    for (const kind of ['quantity', 'percent', 'rate', 'unitPrice'] as const) {
      expect(formatReportDecimal('1234.567', { ...money, kind, scalable: false }, { version: 1, moneyScale: 1000000, decimalPlacesByKind: { [kind]: 3 } })).toBe('1\u00a0234,567')
    }
    expect(formatReportDecimal('10', { ...money, kind: 'count', scalable: false, defaultDecimalPlaces: 0 }, { version: 1, moneyScale: 1000 })).toBe('10')
    expect(reportValueUnit({ ...money, kind: 'percent', unitPolicy: 'percentagePoints' })).toBe('в.п.')
    expect(reportValueUnit(money, { version: 1, moneyScale: 1000 })).toBe('тис. EUR')
  })
  it('rejects unsupported versions and precision while keeping absence canonical and clearing deliberate settings', () => {
    for (const value of [{ version: 2, moneyScale: 1 }, { version: 1, moneyScale: 100 }, { version: 1, moneyScale: 1, decimalPlacesByKind: { money: 7 } }, { version: 1, moneyScale: 1, decimalPlacesByKind: { count: 2 } }]) expect(readNumberPresentation(value)).toBeUndefined()
    expect(numberPresentationError(request)).toBeNull()
    const value = { version: 1, moneyScale: 1000, decimalPlacesByKind: { money: 3 } }
    const stored = { ...request, numberPresentation: value }
    expect(retainStoredTemplateFields(stored, request)).not.toHaveProperty('numberPresentation')
    expect(retainStoredTemplateFields(request, stored)).toHaveProperty('numberPresentation', value)
    expect(numberPresentationError({ ...stored, NumberPresentation: value })).toMatch(/неоднозначно/)
  })
  it('preserves optional producer decimals when only money scale changes, and explicit precision stays fixed', () => {
    const quantity = { ...money, kind: 'quantity' as const, scalable: false, defaultMinimumDecimalPlaces: 0, defaultDecimalPlaces: 8 }
    expect(formatReportDecimal('2.50000000', quantity, { version: 1, moneyScale: 1000 })).toBe('2,5')
    expect(formatReportDecimal('2.5', quantity, { version: 1, moneyScale: 1000, decimalPlacesByKind: { quantity: 3 } })).toBe('2,500')
    expect(formatReportDecimal('0.100000001', quantity, { version: 1, moneyScale: 1 })).toBe('0,1')
  })
  it('identifies management EUR cash measures by stable ID after a custom caption rename', () => {
    expect(nativeReportMeasurementUnit(40, 'Початок управлінський', 92)).toBe('Сума у (EUR)')
    expect(nativeReportMeasurementUnit(40, 'Несправжня назва (EUR)', 84)).toBe('Сума у валюті рахунку (каси)')
  })
})
