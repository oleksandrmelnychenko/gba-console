import { expect, it } from 'vitest'
import { normalizePlannedFlow, normalizePlannedFlowChoices, plannedFlowDefaults, plannedFlowRequest, plannedFlowSelectedStillNamed } from './originalPlannedCashFlow'
import { flowCapability, flowResult } from '../testing/originalPlannedCashClientFixtures'
import { namedFlowCapability, plannedFlowChoices, scenarioKey } from '../testing/originalPlannedCashFlowChoiceFixtures'
const request = () => plannedFlowRequest(namedFlowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults)
it('complete Scenario choices enable only their own field and retain lossless captions and genuine zero references', () => {
  const value = plannedFlowChoices(); value.Fields[0].Choices = [{ Value: '0'.repeat(32), Caption: ' 123 ' }]
  const current = normalizePlannedFlowChoices(value, request())
  expect(current.Fields[0].Available).toBe(true); expect(current.Fields[1].Available).toBe(false)
  expect(current.Fields[0].Choices[0]).toEqual({ Value: '0'.repeat(32), Caption: ' 123 ' })
  expect(plannedFlowRequest(namedFlowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults,
    { Scenarios: ['0'.repeat(32)], Projects: [], Departments: [] }, current).ChoicesWitnessSha256).toBe(current.ChoicesWitnessSha256)
})
it('foreign scope partial family duplicate references and malformed captions refuse rather than creating names', () => {
  const value = plannedFlowChoices()
  for (const delta of [{ World: 'amg' }, { Through: '2026-10-05' }, { FullParentScopeVerified: false }, { RequestedScenarios: [scenarioKey] }, { ChoicesWitnessSha256: null }, { HumanChoicesAvailable: false }])
    expect(() => normalizePlannedFlowChoices({ ...value, ...delta }, request())).toThrow()
  for (const choices of [[value.Fields[0].Choices[0], value.Fields[0].Choices[0]], [{ Value: scenarioKey, Caption: 'Bad\ud800' }], [{ Value: scenarioKey, Caption: ' ' }]])
    expect(() => normalizePlannedFlowChoices({ ...value, Fields: [{ ...value.Fields[0], Choices: choices }, ...value.Fields.slice(1)] }, request())).toThrow()
  expect(() => normalizePlannedFlowChoices({ ...value, Fields: [value.Fields[0], { ...value.Fields[1], Choices: value.Fields[0].Choices }, value.Fields[2]] }, request())).toThrow()
})
it('absent raw branch11 leaves all fields unavailable even when a catalogue could contain names', () => {
  const value = plannedFlowChoices(), code = 'planned_cash_flow_branch11_publication_unavailable'
  const absent = { ...value, Available: false, Code: code, FullParentScopeVerified: false, ChoicesWitnessSha256: null, HumanChoicesAvailable: false,
    Fields: value.Fields.map(field => ({ ...field, Available: false, Code: code, Choices: [] })) }
  expect(normalizePlannedFlowChoices(absent, request()).Available).toBe(false)
  expect(() => normalizePlannedFlowChoices({ ...absent, Fields: value.Fields }, request())).toThrow()
})
it('selected generation requires current full membership witness while legacy unselected preview remains supported', () => {
  const current = normalizePlannedFlowChoices(plannedFlowChoices(), request()), selected = { Scenarios: [scenarioKey], Projects: [], Departments: [] }
  const chosen = plannedFlowRequest(namedFlowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults, selected, current)
  expect(chosen.Scenarios).toEqual([scenarioKey]); expect(chosen.ChoicesWitnessSha256).toBe(current.ChoicesWitnessSha256)
  const reply = { ...flowResult(), Scenarios: chosen.Scenarios, ChoicesWitnessSha256: current.ChoicesWitnessSha256 }
  expect(normalizePlannedFlow(reply, chosen).ChoicesWitnessSha256).toBe(current.ChoicesWitnessSha256)
  expect(() => normalizePlannedFlow({ ...reply, ChoicesWitnessSha256: 'd'.repeat(64) }, chosen)).toThrow()
  expect(() => plannedFlowRequest(namedFlowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults, selected)).toThrow()
  expect(() => plannedFlowRequest(flowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults, selected, current)).toThrow()
  expect(plannedFlowRequest(flowCapability, '2026-10-01', '2026-10-04', plannedFlowDefaults).ChoicesWitnessSha256).toBeUndefined()
  const changed = { ...current, Fields: [{ ...current.Fields[0], Choices: [] }, ...current.Fields.slice(1)] }
  expect(plannedFlowSelectedStillNamed(changed, selected)).toBe(false)
})
