import { expect, it } from 'vitest'
import { flowCapability, flowResult, missingFlow } from '../testing/originalPlannedCashClientFixtures'
import { isPlannedFlowCapability, normalizePlannedFlow, plannedFlowDefaults, plannedFlowMeasures, plannedFlowPeriodError, plannedFlowRequest } from './originalPlannedCashFlow'
const request = () => plannedFlowRequest(flowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults)
it('own E124 capability requires exact measures and admits no named choices or parity claims', () => {
  expect(isPlannedFlowCapability(flowCapability)).toBe(true)
  for (const changed of [{ World: 'amg' }, { SourceId: 'fb9a5d53-8a42-4d2d-ab19-a58603d36bd9' }, { HumanChoicesAvailable: true }, { CurrentDataReadinessVerified: true }, { Measures: plannedFlowDefaults }, { SourceParityVerified: true }])
    expect(isPlannedFlowCapability({ ...flowCapability, ...changed })).toBe(false)
})
it('own request defaults4 while all6 may be selected in canonical order and all unavailable named filters stay empty', () => {
  expect(request()).toMatchObject({ Scenarios: [], Projects: [], Departments: [], Measures: plannedFlowDefaults })
  expect(plannedFlowRequest(flowCapability, '2026-10-01', '2026-10-04', [...plannedFlowMeasures].reverse()).Measures).toEqual(plannedFlowMeasures)
  expect(() => plannedFlowRequest(flowCapability, '2026-10-01', '2026-10-04', [])).toThrow()
})
it('calendar validates real dates and the exact366-day exclusive duration independently of client report range', () => {
  expect(plannedFlowPeriodError('2024-02-29', '2025-02-28')).toBeNull()
  expect(plannedFlowPeriodError('2024-02-29', '2025-03-01')).not.toBeNull()
  expect(plannedFlowPeriodError('2026-02-29', '2026-03-01')).not.toBeNull()
})
it('signed six resources survive exact response normalization without FX or local zero replacement', () => {
  expect(normalizePlannedFlow(flowResult(), request())).toEqual(flowResult())
  const empty = { ...flowResult(), Rows: [], Totals: null }
  expect(normalizePlannedFlow(empty, request()).Totals).toBeNull()
  expect(() => normalizePlannedFlow({ ...empty, Totals: flowResult().Totals }, request())).toThrow()
})
it('partial inputs forbid witness totals rows while known unavailable response remains representable', () => {
  expect(normalizePlannedFlow(missingFlow(), request()).Available).toBe(false)
  expect(() => normalizePlannedFlow({ ...missingFlow(), Rows: flowResult().Rows }, request())).toThrow()
  expect(() => normalizePlannedFlow({ ...flowResult(), OurSnapshotVerified: false }, request())).toThrow()
})
it('response period filters identity and selected measures must exactly echo the original request', () => {
  for (const changed of [{ From: '2026-09-01' }, { Departments: ['F'.repeat(32)] }, { DefinitionSha256: '0'.repeat(64) }, { Measures: plannedFlowMeasures }, { SourceParityVerified: true }])
    expect(() => normalizePlannedFlow({ ...flowResult(), ...changed }, request())).toThrow()
})
it('own lossless descriptions preserve padding numeric text while null stays absent and malformed UTF16 or float resources refuse', () => {
  const result = flowResult(); result.Rows[0].Caption = null
  expect(normalizePlannedFlow(result, request()).Rows[0].Caption).toBeNull()
  for (const caption of ['  Збережена назва  ', '123', 'A'.repeat(32), 'bad\ncaption'])
    expect(normalizePlannedFlow({ ...result, Rows: [{ ...result.Rows[0], Caption: caption }] }, request()).Rows[0].Caption).toBe(caption)
  for (const caption of ['Bad\ud800', 'x'.repeat(101), ' \t\u0085']) expect(() => normalizePlannedFlow({ ...result, Rows: [{ ...result.Rows[0], Caption: caption }] }, request())).toThrow()
  expect(() => normalizePlannedFlow({ ...result, Rows: [{ ...result.Rows[0], Values: { ...result.Rows[0].Values, СуммаПриходВал: 2 } }] }, request())).toThrow()
})
