import { expect, it } from 'vitest'
import { isOrderAnalysisCapability, orderAnalysisCatalogueKind, orderAnalysisDefinitions, orderAnalysisPeriodError, orderAnalysisRequest, readOrderAnalysisFilter, orderAnalysisRows } from './originalOrderAnalyses'
import { orderCapabilityFixture, orderRequestFixture } from './originalOrderAnalyses.fixtures'
import { orderAnalysisNumberText, readOrderAnalysisNumber } from './originalOrderAnalysisNumbers'
it.each([0, 1, 2] as const)('original kind %s retains distinct native defaults and exact definition instead of buyer statement', kind => {
  const cap = orderCapabilityFixture(kind), request = orderRequestFixture(kind)
  expect(isOrderAnalysisCapability(cap, kind)).toBe(true); expect(request.Rows).toEqual(orderAnalysisRows(kind)); expect(request.Measures).toHaveLength(kind === 0 ? 5 : kind === 1 ? 8 : 7)
  expect(cap.Measures).toHaveLength(kind === 2 ? 15 : 20); expect(request.SourceId).toBe(orderAnalysisDefinitions[kind].SourceId); expect(request.ShipmentStates).toBeNull(); expect(request.PaymentStates).toBeNull()
  expect(isOrderAnalysisCapability({ ...cap, Definition: orderAnalysisDefinitions[kind === 0 ? 1 : 0] }, kind)).toBe(false)
})
it.each(['2026-02-29', '2026-10-06T00:00:00Z', '2027-10-02', '3999-01-01'])('invalid or oversized period %s cannot dispatch', through => { expect(orderAnalysisPeriodError('2026-10-01', through)).not.toBeNull() })
it('inclusive last whole second uses untouched dates, while enabled empty status list differs from disabled filter', () => {
  const cap = orderCapabilityFixture(), request = orderAnalysisRequest(cap, '2026-10-01', '2026-10-06', cap.DefaultRows, cap.DefaultMeasures, [], [], null)
  expect(request.From).toBe('2026-10-01'); expect(request.Through).toBe('2026-10-06'); expect(request.ShipmentStates).toEqual([]); expect(request.PaymentStates).toBeNull()
  expect(orderAnalysisPeriodError('2024-02-29', '2024-02-29')).toBeNull()
})
it('catalogue chooses only exact internal buyer supplier Fenix definitions and cannot borrow AMG', () => {
  for (const d of orderAnalysisDefinitions) { const report = { Id: `builtin:${d.Name}`, Name: d.Name, Title: '', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: d.SourceId, DefinitionSha256: d.DefinitionSha256, Attributes: [] }] }
    expect(orderAnalysisCatalogueKind(report, ['fenix'])).toBe(d.Kind); expect(orderAnalysisCatalogueKind(report, ['amg'])).toBeNull(); expect(orderAnalysisCatalogueKind({ ...report, Id: 'builtin:ВедомостьЗаказыПокупателей' }, ['fenix'])).toBeNull() }
})
it('typed customer and document references preserve physical identity without treating captions as bindings', () => {
  const a = { Field: 1, Value: { Reference: 'A'.repeat(32), Type: '08', Table: '00000075' } }, b = { ...a, Value: { ...a.Value, Table: '00000061' } }
  expect(readOrderAnalysisFilter(a, 0)).not.toEqual(readOrderAnalysisFilter(b, 0)); expect(() => readOrderAnalysisFilter(a, 1)).toThrow()
  expect(() => readOrderAnalysisFilter({ Field: 3, Value: { Reference: 'B'.repeat(32), Type: null, Table: null } }, 1)).toThrow()
  expect(() => readOrderAnalysisFilter({ Field: 2, Value: { Reference: 'C'.repeat(32), Type: null, Table: null } }, 0)).toThrow()
})
it('request copies real selection vectors and rejects invalid axes measures and internal payment scope', () => {
  const cap = orderCapabilityFixture(0), rows = [...cap.DefaultRows], measures = [...cap.DefaultMeasures], shipment = [0, 2] as (0 | 2)[]
  const request = orderAnalysisRequest(cap, '2026-10-01', '2026-10-06', rows, measures, [], shipment, null); rows.length = 0; measures.length = 0; shipment.length = 0
  expect(request.Rows).toHaveLength(4); expect(request.Measures).toHaveLength(5); expect(request.ShipmentStates).toEqual([0, 2])
  expect(() => orderAnalysisRequest(cap, '2026-10-01', '2026-10-06', [2], cap.DefaultMeasures, [], null, null)).toThrow()
  expect(() => orderAnalysisRequest(cap, '2026-10-01', '2026-10-06', cap.DefaultRows, ['Invented'], [], null, null)).toThrow()
  expect(() => orderAnalysisRequest(cap, '2026-10-01', '2026-10-06', cap.DefaultRows, cap.DefaultMeasures, [], null, [])).toThrow()
})
it('unavailable observed-null and exact zero are distinct, with no inferred native rounding', () => {
  expect(orderAnalysisNumberText(readOrderAnalysisNumber({ Observed: false, Value: null }))).toBe('Недоступно')
  expect(orderAnalysisNumberText(readOrderAnalysisNumber({ Observed: true, Value: null }))).toBe('Немає значення')
  expect(orderAnalysisNumberText(readOrderAnalysisNumber({ Observed: true, Value: { Numerator: '0', Denominator: '1' } }))).toBe('0')
  expect(orderAnalysisNumberText(readOrderAnalysisNumber({ Observed: true, Value: { Numerator: '-3', Denominator: '2' } }))).toBe('-1.5')
  expect(orderAnalysisNumberText(readOrderAnalysisNumber({ Observed: true, Value: { Numerator: '1', Denominator: '3' } }))).toBe('1 / 3')
})
it('exact large number strings stay lossless and unsafe numeric tokens or invalid rationals refuse', () => {
  expect(orderAnalysisNumberText(readOrderAnalysisNumber({ Observed: true, Value: { Numerator: '900719925474099298', Denominator: '100' } }))).toBe('9007199254740992.98')
  expect(() => readOrderAnalysisNumber({ Observed: true, Value: { Numerator: 9007199254740992, Denominator: 1 } })).toThrow()
  expect(() => readOrderAnalysisNumber({ Observed: false, Value: { Numerator: '1', Denominator: '1' } })).toThrow()
  expect(() => readOrderAnalysisNumber({ Observed: true, Value: { Numerator: '1', Denominator: '0' } })).toThrow()
})
