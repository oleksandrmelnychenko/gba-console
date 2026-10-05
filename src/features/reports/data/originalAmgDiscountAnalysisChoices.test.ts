import { expect, it } from 'vitest'
import { amgDiscountAnalysisMatrix } from './originalAmgDiscountAnalysisExport'
import { normalizeAmgDiscountAnalysisResult, validateAmgDiscountAnalysisRequest } from './originalAmgDiscountAnalysis'
import { emptyAmgDiscountAnalysisSelection, normalizeAmgDiscountAnalysisChoices, normalizeAmgDiscountAnalysisReadiness, selectedAmgDiscountAnalysisRequest } from './originalAmgDiscountAnalysisChoices'
import { amgChoiceWitness, amgNames, amgReadiness } from '../testing/originalAmgDiscountAnalysisChoicesFixtures'
import { amgParty, amgProduct, amgResult, amgScope } from '../testing/originalAmgDiscountAnalysisFixtures'
it('keeps implemented capability separate from actual six-header readiness and refuses invented readiness', () => {
  const ready = amgReadiness(); expect(ready.Executable).toBe(true)
  expect(normalizeAmgDiscountAnalysisReadiness({ ...ready, OrdinaryPublicationAvailable: false, OurSnapshotVerified: false, Executable: false,
    NormalInputsReadinessVerified: false, InputWitnessSha256: null, Dependency: 'ordinary_amg_discount_family_missing:product' }).Executable).toBe(false)
  for (const change of [{ OurSnapshotVerified: false }, { InputWitnessSha256: null }, { CurrentSourceVerified: true }, { Dependency: 'guessed' }]) expect(() => normalizeAmgDiscountAnalysisReadiness({ ...ready, ...change })).toThrow()
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'ModuleSha256', 'QuerySha256', 'Through'])('refuses foreign choices scope %s without borrowing the same source from another world', field => {
  expect(() => normalizeAmgDiscountAnalysisChoices({ ...amgNames(), [field]: 'foreign' }, amgScope())).toThrow()
})
it('authenticates both real caption families and preserves deleted names without technical labels', () => {
  const names = amgNames(); names.Choices.Контрагент[0].Deleted = true
  expect(normalizeAmgDiscountAnalysisChoices(names, amgScope()).Choices.Контрагент[0].Caption).toBe('Клієнт AMG')
  for (const change of [{ TableReference: '00000034' }, { PhysicalTable: '_Reference52' }, { SourceReferenceTypeId: 'warehouse' }, { Caption: amgParty }, { Reference: '0'.repeat(32) }]) {
    const bad = amgNames(); Object.assign(bad.Choices.Контрагент[0], change); expect(() => normalizeAmgDiscountAnalysisChoices(bad, amgScope())).toThrow()
  }
})
it('keeps independently unavailable product names empty while the genuine client field remains available', () => {
  const names = amgNames(); names.FieldAvailability.Номенклатура = false; names.Choices.Номенклатура = []
  names.MissingFamilies = ['Номенклатура']; names.HumanChoicesAvailable = false; names.Dependency = 'ordinary_amg_discount_named_family_unavailable'
  const current = normalizeAmgDiscountAnalysisChoices(names, amgScope()); expect(current.FieldAvailability.Контрагент).toBe(true)
  expect(selectedAmgDiscountAnalysisRequest(current.Through, { Контрагент: [amgParty], Номенклатура: [] }, current).ChoicesWitnessSha256).toBe(amgChoiceWitness)
  expect(() => selectedAmgDiscountAnalysisRequest(current.Through, { Контрагент: [], Номенклатура: [amgProduct] }, current)).toThrow()
})
it('preserves authentic partial-publication names without calling the whole report ready', () => {
  const names = amgNames(); names.OrdinaryPublicationAvailable = false; names.ReferenceCoverageVerified = false; names.HumanChoicesAvailable = false; names.Dependency = 'ordinary_amg_discount_family_missing:characteristic'
  const current = normalizeAmgDiscountAnalysisChoices(names, amgScope()); expect(current.FieldAvailability.Контрагент).toBe(true)
  expect(() => selectedAmgDiscountAnalysisRequest(current.Through, { Контрагент: [amgParty], Номенклатура: [] }, current)).toThrow()
  expect(selectedAmgDiscountAnalysisRequest(current.Through, emptyAmgDiscountAnalysisSelection(), current)).toEqual(amgScope())
})
it('rejects duplicate, unoffered, missing-witness and mismatched availability evidence', () => {
  const names = amgNames(); names.Choices.Контрагент.push(structuredClone(names.Choices.Контрагент[0])); expect(() => normalizeAmgDiscountAnalysisChoices(names, amgScope())).toThrow()
  const mismatch = amgNames(); mismatch.MissingFamilies = ['Номенклатура']; expect(() => normalizeAmgDiscountAnalysisChoices(mismatch, amgScope())).toThrow()
  const selected = { Контрагент: [amgParty], Номенклатура: [] }
  expect(() => selectedAmgDiscountAnalysisRequest(amgScope().Through, selected, null)).toThrow()
  expect(() => selectedAmgDiscountAnalysisRequest('2026-10-01', selected, amgNames())).toThrow()
  expect(() => selectedAmgDiscountAnalysisRequest(amgScope().Through, { ...selected, Контрагент: ['9'.repeat(32)] }, amgNames())).toThrow()
  const noProof = amgNames(); noProof.ChoicesWitnessSha256 = null; expect(() => normalizeAmgDiscountAnalysisChoices(noProof, amgScope())).toThrow()
})
it('detaches selected references and binds the completed export to the same exact current witness', () => {
  const names = amgNames(), selected = { Контрагент: [amgParty], Номенклатура: [amgProduct] }
  const request = selectedAmgDiscountAnalysisRequest(amgScope().Through, selected, names); selected.Контрагент[0] = '9'.repeat(32)
  expect(request.Counterparties).toEqual([amgParty]); expect(request.ChoicesWitnessSha256).toBe(amgChoiceWitness)
  const result = amgResult(request); expect(normalizeAmgDiscountAnalysisResult(result, request).Cells[0].Percentage).toBe('-12.340')
  expect(amgDiscountAnalysisMatrix(result)[1]).toEqual(['Клієнт AMG', 'Роздрібна', '-12.340'])
  expect(() => normalizeAmgDiscountAnalysisResult({ ...result, ChoicesWitnessSha256: 'e'.repeat(64) }, request)).toThrow()
  expect(() => validateAmgDiscountAnalysisRequest({ ...request, ChoicesWitnessSha256: 'bad' })).toThrow()
})
it('requires exact echo of requested filters while retaining the complete offered universe', () => {
  const request = { ...amgScope(), Counterparties: [amgParty] }, names = amgNames()
  expect(() => normalizeAmgDiscountAnalysisChoices(names, request)).toThrow(); names.RequestedCounterparties = [amgParty]
  expect(normalizeAmgDiscountAnalysisChoices(names, request).Choices.Номенклатура).toHaveLength(1)
})

it('keeps complete empty named families distinct from a missing unowned frame', () => {
  const empty = amgNames(); empty.Choices = { Контрагент: [], Номенклатура: [] }
  expect(normalizeAmgDiscountAnalysisChoices(empty, amgScope()).HumanChoicesAvailable).toBe(true)
  const missing = { ...empty, OrdinaryPublicationAvailable: false, ReferenceCoverageVerified: false, OurSnapshotVerified: false, HumanChoicesAvailable: false,
    FieldAvailability: { Контрагент: false, Номенклатура: false }, MissingFamilies: ['Контрагент', 'Номенклатура'], InputWitnessSha256: null,
    ChoicesWitnessSha256: null, Dependency: 'ordinary_amg_discount_family_missing:register' }
  expect(normalizeAmgDiscountAnalysisChoices(missing, amgScope()).HumanChoicesAvailable).toBe(false)
  expect(() => normalizeAmgDiscountAnalysisChoices({ ...missing, OurSnapshotVerified: true, HumanChoicesAvailable: true }, amgScope())).toThrow()
})
it('requires agreement and characteristic coverage for every supplied preview witness and rejects excess saved selections', () => {
  const names = amgNames(); names.ReferenceCoverageVerified = false
  expect(() => normalizeAmgDiscountAnalysisChoices(names, amgScope())).toThrow()
  expect(() => selectedAmgDiscountAnalysisRequest(amgScope().Through, { Контрагент: [amgParty], Номенклатура: [] }, names)).toThrow()
  const tooMany = Array.from({ length: 257 }, (_, i) => (i + 1).toString(16).toUpperCase().padStart(32, '0'))
  expect(() => validateAmgDiscountAnalysisRequest({ ...amgScope(), Counterparties: tooMany, ChoicesWitnessSha256: amgChoiceWitness })).toThrow()
})
