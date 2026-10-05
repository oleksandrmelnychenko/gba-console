import { expect, it } from 'vitest'
import { normalizePurchases, purchasesRequest, purchasesResultRequest, validatePurchasesRequest } from './originalPurchases'
import { emptyPurchasesSelections, normalizePurchasesChoices, purchasesNamedRequest } from './originalPurchasesChoices'
import { purchasesCapability, purchasesParty, purchasesProduct, purchasesResponse, purchasesStatus } from '../testing/originalPurchasesFixtures'
import { namedPurchasesResponse, purchasesAllSelected, purchasesDistributionProject, purchasesMainProject, purchasesMissingNames, purchasesNamedChoices, purchasesNamedScope } from '../testing/originalPurchasesNamedFixtures'

it('enables four genuine typed fields independently while global names and Status remain unavailable', () => {
  const names = normalizePurchasesChoices(purchasesNamedChoices(), purchasesNamedScope())
  expect(names.HumanChoicesAvailable).toBe(false); expect(names.MissingFamilies).toEqual(['СтатусПартии'])
  expect(names.FieldAvailability).toEqual({ СтатусПартии: false, Контрагент: true, Номенклатура: true, Подразделение: true, Проект: true })
  expect(() => purchasesNamedRequest(purchasesNamedScope(), { ...emptyPurchasesSelections(), СтатусПартии: [purchasesStatus] }, names)).toThrow()
})
it('distinguishes complete empty field publications from absent fields without invented choices', () => {
  const complete = purchasesNamedChoices(); complete.Choices.Номенклатура = []
  const normalized = normalizePurchasesChoices(complete, purchasesNamedScope())
  expect(normalized.FieldAvailability.Номенклатура).toBe(true); expect(normalized.Choices.Номенклатура).toEqual([])
  expect(normalized.FieldWitnessSha256.Номенклатура).toBe('d'.repeat(64))
  expect(normalizePurchasesChoices(purchasesMissingNames(), purchasesNamedScope()).FieldAvailability.Номенклатура).toBe(false)
  expect(() => purchasesNamedRequest(purchasesNamedScope(), { ...emptyPurchasesSelections(), Номенклатура: [purchasesProduct] }, normalized)).toThrow()
})
it('retains equal references in distinct Project types and never merges names across fields', () => {
  const names = purchasesNamedChoices(); names.Choices.Подразделение[0].Key = purchasesParty
  const normalized = normalizePurchasesChoices(names, purchasesNamedScope())
  const scope = purchasesNamedRequest(purchasesNamedScope(), { ...purchasesAllSelected(), Подразделение: [purchasesParty] }, normalized)
  expect(scope.Projects).toEqual([purchasesDistributionProject, purchasesMainProject]); expect(scope.Counterparties).toEqual(scope.Divisions)
  expect(normalized.Choices.Подразделение[0].Caption).toBe('Відділ закупівель'); expect(normalized.Choices.Контрагент[0].Caption).toBe('Постачальник')
  expect(scope.NamedChoiceWitnesses?.Подразделение).not.toBe(scope.NamedChoiceWitnesses?.Контрагент)
})
it.each(['field', 'type', 'tref', 'key', 'caption', 'duplicate', 'project'])('refuses foreign or malformed named choice %s', fault => {
  const names = purchasesNamedChoices(), row = names.Choices.Контрагент[0]
  if (fault === 'field') row.Field = 'Номенклатура'
  if (fault === 'type') Object.assign(row, { Type: '09' })
  if (fault === 'tref') row.TableReference = '00000054'
  if (fault === 'key') row.Key = row.Key.toLowerCase()
  if (fault === 'caption') row.Caption = row.Key
  if (fault === 'duplicate') names.Choices.Контрагент.push({ ...row })
  if (fault === 'project') names.Choices.Проект[0].Key = purchasesMainProject
  expect(() => normalizePurchasesChoices(names, purchasesNamedScope())).toThrow()
})
it('refuses stale scope identity dates selectors resources and unclosed availability', () => {
  const names = purchasesNamedChoices(), request = purchasesNamedScope()
  for (const field of ['World', 'SourceId', 'DefinitionSha256', 'From', 'Through']) expect(() => normalizePurchasesChoices({ ...names, [field]: 'foreign' }, request)).toThrow()
  expect(() => normalizePurchasesChoices({ ...names, Selectors: { ...names.Selectors, Контрагент: [purchasesParty] } }, request)).toThrow()
  expect(() => normalizePurchasesChoices({ ...names, Measures: ['КоличествоОборот'] }, request)).toThrow()
  expect(() => normalizePurchasesChoices({ ...names, OurSnapshotVerified: false }, request)).toThrow()
})
it('requires exact source-field missing flags and current witnesses for each available field', () => {
  const names = purchasesNamedChoices(), request = purchasesNamedScope()
  expect(() => normalizePurchasesChoices({ ...names, MissingFamilies: ['status'] }, request)).toThrow()
  expect(() => normalizePurchasesChoices({ ...names, FieldWitnessSha256: { ...names.FieldWitnessSha256, Номенклатура: undefined } }, request)).toThrow()
  expect(() => normalizePurchasesChoices({ ...names, FieldAvailability: { ...names.FieldAvailability, СтатусПартии: true } }, request)).toThrow()
  expect(() => normalizePurchasesChoices({ ...names, FieldWitnessSha256: { ...names.FieldWitnessSha256, СтатусПартии: '2'.repeat(64) } }, request)).toThrow()
})
it('detaches requests choices and completed names with exact per-field witnesses', () => {
  const wire = purchasesNamedChoices(), choices = normalizePurchasesChoices(wire, purchasesNamedScope()), selection = purchasesAllSelected()
  const request = purchasesNamedRequest(purchasesNamedScope(), selection, choices), detached = validatePurchasesRequest(request)
  selection.Контрагент.length = 0; wire.Choices.Контрагент[0].Caption = 'Later caption'; if (request.NamedChoiceWitnesses) request.NamedChoiceWitnesses.Контрагент = '2'.repeat(64)
  expect(detached.Counterparties).toEqual([purchasesParty]); expect(detached.NamedChoiceWitnesses?.Контрагент).toBe('c'.repeat(64))
  expect(choices.Choices.Контрагент[0].Caption).toBe('Постачальник')
  const resultWire = namedPurchasesResponse(detached), result = normalizePurchases(resultWire, detached)
  resultWire.Rows[0].Children[0].Caption = 'Later caption'
  expect(result.Rows[0].Children[0].Caption).toBe('Постачальник'); expect(purchasesResultRequest(result).Projects).toEqual([purchasesDistributionProject, purchasesMainProject])
})
it('retains unfiltered amounts when names are absent and refuses stale or missing filtered evidence', () => {
  const base = purchasesNamedScope(); expect(purchasesNamedRequest(base, emptyPurchasesSelections(), null)).toEqual(base)
  expect(normalizePurchases(purchasesResponse(), base).Available).toBe(true)
  const request = purchasesNamedRequest(base, { ...emptyPurchasesSelections(), Контрагент: [purchasesParty] }, purchasesNamedChoices()), result = namedPurchasesResponse(request)
  expect(normalizePurchases(result, request).Available).toBe(true)
  expect(() => normalizePurchases(result, { ...request, NamedChoiceWitnesses: {} })).toThrow()
  expect(() => normalizePurchases(result, { ...request, NamedChoiceWitnesses: { Контрагент: '2'.repeat(64) } })).toThrow()
  expect(() => normalizePurchases({ ...result, NamedChoiceWitnesses: null, NamedFieldAvailability: null }, request)).toThrow()
})
it('rejects forged caption availability and witness families before rendering or exporting quantities', () => {
  const request = purchasesNamedScope(), result = namedPurchasesResponse()
  result.Rows[0].CaptionAvailable = true; result.Rows[0].Caption = 'Invented status'; expect(() => normalizePurchases(result, request)).toThrow()
  const missing = namedPurchasesResponse(); missing.NamedFieldAvailability = { ...purchasesNamedChoices().FieldAvailability, Контрагент: false }
  expect(() => normalizePurchases(missing, request)).toThrow()
  const opaque = namedPurchasesResponse(); opaque.Rows[0].Children[0].Caption = purchasesParty; expect(() => normalizePurchases(opaque, request)).toThrow()
})
it('a canonical period-wide catalogue does not shrink when resource columns or selected filters change', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12', ['КоличествоЕдиницОтчетов'])
  const selection = { ...emptyPurchasesSelections(), Номенклатура: [purchasesProduct] }
  expect(purchasesNamedRequest(request, selection, purchasesNamedChoices()).Measures).toEqual(['КоличествоЕдиницОтчетов'])
  const shrunk = purchasesNamedChoices(); shrunk.Selectors.Номенклатура = [purchasesProduct]
  expect(() => purchasesNamedRequest(request, selection, shrunk)).toThrow()
  expect(() => purchasesNamedRequest({ ...request, Through: '2026-09-13' }, selection, purchasesNamedChoices())).toThrow()
})
