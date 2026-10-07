import { expect, it } from 'vitest'
import { emptyMoneyFlowSelection, isMoneyFlowCapability, moneyFlowDefaults, moneyFlowFilters, moneyFlowMeasures, moneyFlowRequest, moneyFlowRequestFields,
  normalizeMoneyFlow } from './originalMoneyFlowAnalysis'
import { emptyMoneyFlow, moneyFlowCapability, moneyFlowRef, moneyFlowResponse, unavailableMoneyFlow } from '../testing/originalMoneyFlowAnalysisFixtures'
const request = () => moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12')
it('binds the own Fenix source, two-level hierarchy, no columns and exactly four income/net defaults', () => {
  expect(isMoneyFlowCapability(moneyFlowCapability)).toBe(true)
  expect(request()).toEqual({ Version: 1, World: 'fenix', SourceId: moneyFlowCapability.SourceId, DefinitionSha256: moneyFlowCapability.DefinitionSha256,
    From: '2026-09-10', Through: '2026-09-12', Organizations: [], Divisions: [], Projects: [], Measures: [...moneyFlowDefaults] })
  expect(moneyFlowCapability.DefaultColumns).toEqual([]); expect(request().Measures).not.toContain('СуммаРасходВал'); expect(request().Measures).not.toContain('СуммаРасходУпр')
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'ModuleSha256', 'QuerySha256', 'DefaultScopeCode', 'MoneyPolicy', 'DatePolicy', 'DivisionPolicy', 'MissingPropertyPolicy'])('refuses a foreign original or altered capability policy %s', field => { expect(isMoneyFlowCapability({ ...moneyFlowCapability, [field]: 'foreign' })).toBe(false) })
it('refuses a pivot, altered default expenses, reordered hierarchy and fabricated Source readiness', () => {
  for (const patch of [{ DefaultColumns: ['ВидДенежныхСредств'] }, { DefaultMeasures: moneyFlowMeasures }, { DefaultRows: [...moneyFlowCapability.DefaultRows].reverse() },
    { HumanChoicesAvailable: true }, { SourceSyncEnabled: true }, { SourceParityVerified: true }, { MeasureDefinitions: [] }])
    expect(isMoneyFlowCapability({ ...moneyFlowCapability, ...patch })).toBe(false)
})
it('normalizes independently typed selectors and selected resources without retaining caller arrays', () => {
  const selected = emptyMoneyFlowSelection()
  for (const field of moneyFlowFilters) selected[field] = [moneyFlowRef(12), moneyFlowRef(1)]
  const measures = [...moneyFlowMeasures].reverse(), result = moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', selected, measures)
  for (const field of moneyFlowFilters) { expect(result[moneyFlowRequestFields[field]]).toEqual([moneyFlowRef(1), moneyFlowRef(12)]); selected[field].length = 0 }
  measures.length = 0; expect(result.Measures).toEqual(moneyFlowMeasures); expect(result.Organizations).toHaveLength(2)
})
it.each([...moneyFlowFilters])('rejects invalid, duplicated, compound or excessive simple %s references', field => {
  const selection = emptyMoneyFlowSelection()
  for (const keys of [[moneyFlowRef(1), moneyFlowRef(1)], [moneyFlowRef(10).toLowerCase()], [`08:00000069:${moneyFlowRef(1)}`], ['NULL'], Array.from({ length: 257 }, (_, i) => moneyFlowRef(i))]) {
    selection[field] = keys; expect(() => moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', selection)).toThrow()
  }
})
it('rejects no measures, duplicate resources, unknown resource and undeclared selector fields', () => {
  for (const measures of [[], ['СуммаПриходВал', 'СуммаПриходВал'], ['Unknown']])
    expect(() => moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', emptyMoneyFlowSelection(), measures as never)).toThrow()
  expect(() => moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', Object.assign(emptyMoneyFlowSelection(), { Articles: [] }))).toThrow()
})
it.each([['2026-02-30', '2026-03-01'], ['2026-09-12', '2026-09-10'], ['2026-09-10', '2027-09-10'], ['1999-12-31', '2000-01-01']])('refuses invalid or oversized calendar interval %s to %s', (from, through) => { expect(() => moneyFlowRequest(moneyFlowCapability, from, through)).toThrow() })
it.each([...moneyFlowFilters])('binds the response to the exact current %s filter echo', field => {
  const value = moneyFlowResponse(); value.Selectors[field] = [moneyFlowRef(1)]; expect(() => normalizeMoneyFlow(value, request())).toThrow()
})
it('refuses stale dates, resource order and a hierarchy outside the selected organization', () => {
  expect(() => normalizeMoneyFlow({ ...moneyFlowResponse(), Through: '2026-09-11' }, request())).toThrow()
  const reordered = moneyFlowResponse(); reordered.Measures.reverse(); expect(() => normalizeMoneyFlow(reordered, request())).toThrow()
  const selected = emptyMoneyFlowSelection(); selected.Организация = [moneyFlowRef(1)]
  const scoped = moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', selected)
  expect(() => normalizeMoneyFlow(moneyFlowResponse(scoped), scoped)).toThrow()
})
it('retains signed zero, large decimal strings and server subtotals without UI arithmetic', () => {
  const value = moneyFlowResponse(); value.Totals!.ДенежныйПотокВал = '-1234567890123456789.01'
  const result = normalizeMoneyFlow(value, request())
  expect(result.Totals!.ДенежныйПотокВал).toBe('-1234567890123456789.01'); expect(result.Rows[0].Values.ДенежныйПотокВал).toBe('0.00')
})
it.each(['-0.00', '01.00', '1e3', '1.2', '1', ' 1.00'])('refuses noncanonical stored money %s', money => {
  const value = moneyFlowResponse(); value.Rows[0].Values.ДенежныйПотокВал = money; expect(() => normalizeMoneyFlow(value, request())).toThrow()
})
it('requires exact resources at every level and rejects extra levels, duplicate siblings and NULL contributions', () => {
  const missing = moneyFlowResponse(); delete missing.Rows[0].Values.ДенежныйПотокВал; expect(() => normalizeMoneyFlow(missing, request())).toThrow()
  const extra = moneyFlowResponse(); extra.Rows[0].Values.Other = '1.00'; expect(() => normalizeMoneyFlow(extra, request())).toThrow()
  const nul = moneyFlowResponse(); nul.Rows[0].Children[0].Values.ДенежныйПотокВал = null; expect(() => normalizeMoneyFlow(nul, request())).toThrow()
  const duplicate = moneyFlowResponse(); duplicate.Rows.push(structuredClone(duplicate.Rows[0])); expect(() => normalizeMoneyFlow(duplicate, request())).toThrow()
  const deep = moneyFlowResponse(); deep.Rows[0].Children[0].Children.push(structuredClone(deep.Rows[0])); expect(() => normalizeMoneyFlow(deep, request())).toThrow()
})
it('allows the same article under separate organizations while keeping ordinal missing captions honest', () => {
  const value = moneyFlowResponse(); expect(value.Rows[0].Children[0].Key).toBe(value.Rows[1].Children[0].Key)
  value.Rows[0].Children[0].Caption = 'Назва недоступна'; value.Rows[0].Children[0].CaptionAvailable = false; value.MissingCaptionMappings.push('СтатьяДвиженияДенежныхСредств')
  const result = normalizeMoneyFlow(value, request()); expect(result.Rows).toHaveLength(2); expect(result.Rows[0].Children[0].CaptionAvailable).toBe(false)
})
it('refuses raw reference captions, invented absent captions and foreign choice keys', () => {
  const raw = moneyFlowResponse(); raw.Rows[0].Caption = raw.Rows[0].Key; expect(() => normalizeMoneyFlow(raw, request())).toThrow()
  const falseCaption = moneyFlowResponse(); falseCaption.Choices.Подразделение[0].Caption = 'Fabricated'; expect(() => normalizeMoneyFlow(falseCaption, request())).toThrow()
  const typed = moneyFlowResponse(); typed.Choices.Проект[0].Key = `08:00000069:${moneyFlowRef(4)}`; expect(() => normalizeMoneyFlow(typed, request())).toThrow()
})
it('complete empty, missing parents and numeric cancellation remain distinct with no partial amounts', () => {
  expect(normalizeMoneyFlow(emptyMoneyFlow(), request()).Totals!.ДенежныйПотокВал).toBeNull()
  expect(normalizeMoneyFlow(unavailableMoneyFlow(), request()).OurSnapshotVerified).toBe(false)
  const fabricated = unavailableMoneyFlow(); fabricated.Totals = emptyMoneyFlow().Totals; expect(() => normalizeMoneyFlow(fabricated, request())).toThrow()
  const zero = emptyMoneyFlow(); zero.Totals!.ДенежныйПотокВал = '0.00'; expect(() => normalizeMoneyFlow(zero, request())).toThrow()
})
it('requires original closed Snapshot authority, full input/result witnesses and observed management currency', () => {
  for (const patch of [{ OurSnapshotVerified: false }, { InputWitnessSha256: null }, { ResultSha256: null }, { ManagementCurrency: null }, { NormalInputsComplete: false }, { Dependency: { Kind: 'missing', MissingMonth: null } }])
    expect(() => normalizeMoneyFlow({ ...moneyFlowResponse(), ...patch }, request())).toThrow()
  expect(() => normalizeMoneyFlow({ ...unavailableMoneyFlow(), OurSnapshotVerified: true }, request())).toThrow()
})
it('detaches completed rows, choices and selector values from subsequently mutated transport arrays', () => {
  const value = moneyFlowResponse(), result = normalizeMoneyFlow(value, request())
  value.Rows.length = 0; value.Choices.Организация[0].Caption = 'Changed'; value.Selectors.Проект.push(moneyFlowRef(9))
  expect(result.Rows).toHaveLength(2); expect(result.Choices.Организация[0].Caption).toBe('Перша організація'); expect(result.Selectors.Проект).toEqual([])
})
