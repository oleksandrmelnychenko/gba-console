import { expect, it } from 'vitest'
import { createPlannedCashRequest, isPlannedCashCapabilities, normalizePlannedCashReport } from './plannedCash'
import { createPlannedCashScenarioChoicesRequest, normalizePlannedCashScenarioChoices } from './plannedCashScenarioChoices'
import { PLANNED_CASH_TEST_CHOICE, plannedCashCapability, plannedCashChoices, plannedCashCalendarKinds,
  plannedCashDdsKinds, plannedCashFilters, plannedCashKinds, plannedCashReport, plannedCashTestRequest } from './plannedCash.test-fixtures'

it.each(plannedCashDdsKinds)('copies exact %s identity/periods and selects only the supplied opaque choice', kind => {
  const cap = plannedCashCapability(kind), filters = plannedCashFilters()
  expect(createPlannedCashRequest(cap, filters, PLANNED_CASH_TEST_CHOICE)).toEqual(plannedCashTestRequest(kind))
  const req = createPlannedCashScenarioChoicesRequest(cap, filters, 'fixture-continuation')
  expect(req).toEqual({ Version: cap.Version, SourceIdentity: cap.SourceIdentity, CurrentPeriod: plannedCashTestRequest(kind).CurrentPeriod,
    PreviousPeriod: plannedCashTestRequest(kind).PreviousPeriod, ContinuationKey: 'fixture-continuation' })
  expect(req.SourceIdentity).not.toBe(cap.SourceIdentity); cap.SourceIdentity.DefinitionSha256 = '0'.repeat(64)
  expect(req.SourceIdentity.DefinitionSha256).toBe('a'.repeat(64))
})
it.each(plannedCashCalendarKinds)('keeps %s calendar behavior and refuses a scenario list or token', kind => {
  expect(() => createPlannedCashScenarioChoicesRequest(plannedCashCapability(kind), plannedCashFilters())).toThrow()
  expect(() => createPlannedCashRequest(plannedCashCapability(kind), plannedCashFilters(), PLANNED_CASH_TEST_CHOICE)).toThrow('не має вибору сценарію')
})
it.each(plannedCashKinds)('requires the actual %s choice capabilities independently of legacy labels flag', kind => {
  const cap = plannedCashCapability(kind); expect(isPlannedCashCapabilities(cap)).toBe(true)
  Reflect.set(cap, 'ScenarioChoiceApiImplemented', !cap.ScenarioChoiceApiImplemented); expect(isPlannedCashCapabilities(cap)).toBe(false)
})
it.each(['2026-02-30', '8000-01-01', '', '2026-08-01Z', ' 2026-08-01'])('rejects dirty previous boundary %s before requesting choices', PreviousFrom => {
  expect(() => createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), { ...plannedCashFilters(), PreviousFrom })).toThrow('попереднього періоду')
})
it('preserves duplicate human names, whitespace and supplementary Unicode as distinct actual choices', () => {
  const page = plannedCashChoices(); page.Choices.push({ Key: 'another-opaque-key', Caption: page.Choices[0].Caption })
  const value = normalizePlannedCashScenarioChoices(page, createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters()))
  expect(value.Choices.map(choice => choice.Caption)).toEqual(['  План ДДС 🌍  ', '  План ДДС 🌍  ']); expect(value.Choices[0].Key).not.toBe(value.Choices[1].Key)
})
it.each(['', '   ', '\u0085', '\ud800', '\udc00', 'a'.repeat(101), `${'a'.repeat(99)}🌍`])('rejects a nameless or malformed UTF16 caption %j', Caption => {
  const page = plannedCashChoices(); page.Choices[0].Caption = Caption
  expect(() => normalizePlannedCashScenarioChoices(page, createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters()))).toThrow()
})
it.each(['Version', 'Identity', 'Current', 'Previous', 'NativeVisibility', 'NativeDefault', 'Parity', 'Policy', 'Duplicate', 'TooMany', 'RawReference', 'UnknownRow'])('refuses unbound or unsafe choice page %s', field => {
  const page = plannedCashChoices()
  if (field === 'Version') Reflect.set(page, 'Version', 2)
  if (field === 'Identity') page.SourceIdentity.DefinitionSha256 = '0'.repeat(64)
  if (field === 'Current') page.CurrentPeriod.From = '2026-09-02T00:00:00.000'
  if (field === 'Previous') page.PreviousPeriod.ThroughExclusive = '2026-09-02T00:00:00.000'
  if (field === 'NativeVisibility') Reflect.set(page, 'NativeChoiceVisibilityVerified', true)
  if (field === 'NativeDefault') Reflect.set(page, 'NativeChoiceDefaultVerified', true)
  if (field === 'Parity') Reflect.set(page, 'SourceParityVerified', true)
  if (field === 'Policy') Reflect.set(page, 'SelectionPolicy', 'NativeDefault')
  if (field === 'Duplicate') page.Choices.push({ ...page.Choices[0] })
  if (field === 'TooMany') page.Choices = Array.from({ length: 257 }, (_, i) => ({ Key: `opaque-${i}`, Caption: 'План' }))
  if (field === 'RawReference') Reflect.set(page, 'ScenarioRRef', 'synthetic-reference')
  if (field === 'UnknownRow') Reflect.set(page.Choices[0], 'Reference', 'synthetic-reference')
  expect(() => normalizePlannedCashScenarioChoices(page, createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters()))).toThrow()
})
it.each(['', 'a'.repeat(4097), ' leading', 'trailing ', 'line\nbreak', 'nul\u0000key'])('rejects invalid opaque key %j without interpreting its contents', Key => {
  const page = plannedCashChoices(); page.Choices[0].Key = Key
  expect(() => normalizePlannedCashScenarioChoices(page, createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters()))).toThrow()
  expect(() => createPlannedCashRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters(), Key)).toThrow('Оберіть сценарій')
})
it.each(['pending', 'empty', 'empty-next'])('keeps %s separate from a fabricated scenario/default', state => {
  const page = plannedCashChoices(); page.Choices = []; page.Available = state !== 'pending'; page.Code = state === 'pending' ? 'catalogue_not_ready' : 'available'
  page.ContinuationKey = state === 'empty-next' ? 'actual-opaque-continuation' : null
  expect(normalizePlannedCashScenarioChoices(page, createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters()))).toEqual(page)
})
it('does not admit a pending catalogue with selectable entries or a continuation', () => {
  const page = plannedCashChoices(); page.Available = false
  const command = createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters())
  expect(() => normalizePlannedCashScenarioChoices(page, command)).toThrow()
  page.Choices = []; page.ContinuationKey = 'opaque-next'; expect(() => normalizePlannedCashScenarioChoices(page, command)).toThrow()
})
it.each(['ScenarioBindingSha256', 'ScenarioChoiceBindingSha256'])('requires %s on a genuine DDS preview while preserving server scalars', field => {
  const report = plannedCashReport('DdsPayouts'); Reflect.set(report, field, null)
  expect(() => normalizePlannedCashReport(report, plannedCashTestRequest('DdsPayouts'))).toThrow()
})
it('rejects a raw scenario object and a scenario-bound calendar result', () => {
  const command = plannedCashTestRequest('DdsPayouts'); Reflect.set(command, 'Scenario', { Type: '08', Table: '0000008A', Value: 'synthetic-native-key' })
  expect(() => normalizePlannedCashReport(plannedCashReport('DdsPayouts'), command)).toThrow()
  const report = plannedCashReport(); report.ScenarioChoiceBindingSha256 = '8'.repeat(64)
  expect(() => normalizePlannedCashReport(report, plannedCashTestRequest())).toThrow()
})
