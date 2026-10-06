import { expect, it } from 'vitest'
import { normalizeOrderAnalysisChoices, normalizeOrderAnalysisResult } from './originalOrderAnalysisResponse'
import { orderChoicesWireFixture, orderNumberFixture, orderRequestFixture, orderResultWireFixture } from './originalOrderAnalyses.fixtures'
it.each([0, 1, 2] as const)('Pascal native wire kind %s retains exact date definition and root group', kind => {
  const request = orderRequestFixture(kind), wire = orderResultWireFixture(request), result = normalizeOrderAnalysisResult(wire, request)
  expect(result.Request).toEqual(request); expect(result.Groups).toEqual(wire.Groups); expect(result.Available).toBe(true)
})
it('full request echo rejects a different date, definition, state subset or typed filter', () => {
  const request = orderRequestFixture(), wire = orderResultWireFixture()
  for (const Request of [{ ...wire.Request, Through: '2026-10-05' }, { ...wire.Request, Definition: { ...wire.Request.Definition, Kind: 2 } }, { ...wire.Request, ShipmentStates: [] }, { ...wire.Request, Filters: [{ Field: 4, Value: { Reference: 'F'.repeat(32), Type: null, Table: null } }] }]) expect(() => normalizeOrderAnalysisResult({ ...wire, Request }, request)).toThrow()
})
it('confirmed names keep reference and witness while unsupported units stay explicitly unresolved', () => {
  const request = orderRequestFixture(), raw = orderChoicesWireFixture(), result = normalizeOrderAnalysisChoices(raw, request)
  expect(result.Choices[0]).toEqual(raw.Choices[0]); expect(result.NormalReportAccepted).toBe(false)
  expect(() => normalizeOrderAnalysisChoices({ ...raw, Choices: [{ ...raw.Choices[0], Caption: '' }] }, request)).toThrow()
  expect(() => normalizeOrderAnalysisChoices({ ...raw, Choices: [...raw.Choices, raw.Choices[0]] }, request)).toThrow()
  expect(() => normalizeOrderAnalysisChoices({ ...raw, UnresolvedChoices: [{ ...raw.Choices[0], Code: 'missing' }] }, request)).toThrow()
  expect(() => normalizeOrderAnalysisChoices({ ...raw, NormalReportAccepted: true }, request)).toThrow()
})
it('partial known zero and observed null survive without becoming a complete result', () => {
  const request = orderRequestFixture(), wire = orderResultWireFixture(), values = { ...wire.Groups[0].Measures, [request.Measures[0]]: orderNumberFixture('0'), [request.Measures[1]]: { Observed: true, Value: null }, [request.Measures[2]]: { Observed: false, Value: null } }
  const result = normalizeOrderAnalysisResult({ ...wire, Available: false, NormalInputsComplete: false, SelectedNumbersObserved: false, Groups: [{ ...wire.Groups[0], Measures: values }] }, request)
  expect(result.Groups[0].Measures).toEqual(values)
  expect(() => normalizeOrderAnalysisResult({ ...wire, NormalInputsComplete: false }, request)).toThrow()
})
it('group prefix order and exact requested measures refuse swapped axes invented measures or duplicate groups', () => {
  const request = orderRequestFixture(), wire = orderResultWireFixture(), group = wire.Groups[0]
  expect(() => normalizeOrderAnalysisResult({ ...wire, Groups: [{ ...group, Key: [{ Field: 4, Value: 'A'.repeat(32) }] }] }, request)).toThrow()
  expect(() => normalizeOrderAnalysisResult({ ...wire, Groups: [{ ...group, Measures: { ...group.Measures, Invented: orderNumberFixture() } }] }, request)).toThrow()
  expect(() => normalizeOrderAnalysisResult({ ...wire, Groups: [group, group] }, request)).toThrow()
})
it('native statuses preserve numeric zero and reject an invented caption or Source parity claim', () => {
  const request = orderRequestFixture(), wire = orderResultWireFixture(), group = wire.Groups[0]
  expect(normalizeOrderAnalysisResult(wire, request).Groups[0].Shipment.NumericZero).toBe(true)
  expect(() => normalizeOrderAnalysisResult({ ...wire, Groups: [{ ...group, Shipment: { Observed: true, NumericZero: false, Caption: 'Everything fine' } }] }, request)).toThrow()
  expect(() => normalizeOrderAnalysisResult({ ...wire, SourceParityVerified: true }, request)).toThrow()
})
