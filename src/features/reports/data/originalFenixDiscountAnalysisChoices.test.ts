import { expect, it } from 'vitest'
import { fenixDiscountMatrix } from './originalFenixDiscountAnalysisExport'
import { normalizeFenixDiscountResult, validateFenixDiscountRequest } from './originalFenixDiscountAnalysis'
import { emptyFenixDiscountSelection, normalizeFenixDiscountChoices, normalizeFenixDiscountReadiness, selectedFenixDiscountRequest } from './originalFenixDiscountAnalysisChoices'
import { fenixChoiceWitness, fenixNames, fenixReadiness } from '../testing/originalFenixDiscountAnalysisChoicesFixtures'
import { fenixParty, fenixProduct, fenixResult, fenixScope } from '../testing/originalFenixDiscountAnalysisFixtures'
it('keeps implemented capability separate from actual six-header readiness and refuses invented readiness', () => {
  const ready = fenixReadiness(); expect(ready.Executable).toBe(true)
  expect(normalizeFenixDiscountReadiness({ ...ready, OrdinaryPublicationAvailable: false, OurSnapshotVerified: false, Executable: false,
    NormalInputsReadinessVerified: false, InputWitnessSha256: null, Dependency: 'ordinary_discount_family_missing:product' }).Executable).toBe(false)
  for (const change of [{ OurSnapshotVerified: false }, { InputWitnessSha256: null }, { CurrentSourceVerified: true }, { Dependency: 'guessed' }]) expect(() => normalizeFenixDiscountReadiness({ ...ready, ...change })).toThrow()
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'ModuleSha256', 'QuerySha256', 'Through'])('refuses foreign choices scope %s without borrowing the same source from another world', field => {
  expect(() => normalizeFenixDiscountChoices({ ...fenixNames(), [field]: 'foreign' }, fenixScope())).toThrow()
})
it('authenticates both real caption families and preserves deleted names without technical labels', () => {
  const names = fenixNames(); names.Choices.Контрагент[0].Deleted = true
  expect(normalizeFenixDiscountChoices(names, fenixScope()).Choices.Контрагент[0].Caption).toBe('Клієнт Fenix')
  for (const change of [{ TableReference: '00000034' }, { PhysicalTable: '_Reference52' }, { SourceReferenceTypeId: 'warehouse' }, { Caption: fenixParty }, { Reference: '0'.repeat(32) }]) {
    const bad = fenixNames(); Object.assign(bad.Choices.Контрагент[0], change); expect(() => normalizeFenixDiscountChoices(bad, fenixScope())).toThrow()
  }
})
it('keeps independently unavailable product names empty while the genuine client field remains available', () => {
  const names = fenixNames(); names.FieldAvailability.Номенклатура = false; names.Choices.Номенклатура = []
  names.MissingFamilies = ['Номенклатура']; names.HumanChoicesAvailable = false; names.Dependency = 'ordinary_discount_named_family_unavailable'
  const current = normalizeFenixDiscountChoices(names, fenixScope()); expect(current.FieldAvailability.Контрагент).toBe(true)
  expect(selectedFenixDiscountRequest(current.Through, { Контрагент: [fenixParty], Номенклатура: [] }, current).ChoicesWitnessSha256).toBe(fenixChoiceWitness)
  expect(() => selectedFenixDiscountRequest(current.Through, { Контрагент: [], Номенклатура: [fenixProduct] }, current)).toThrow()
})
it('preserves authentic partial-publication names without calling the whole report ready', () => {
  const names = fenixNames(); names.OrdinaryPublicationAvailable = false; names.Dependency = 'ordinary_discount_family_missing:characteristic'
  const current = normalizeFenixDiscountChoices(names, fenixScope()); expect(current.FieldAvailability.Контрагент).toBe(true)
  expect(() => selectedFenixDiscountRequest(current.Through, { Контрагент: [fenixParty], Номенклатура: [] }, current)).toThrow()
  expect(selectedFenixDiscountRequest(current.Through, emptyFenixDiscountSelection(), current)).toEqual(fenixScope())
})
it('rejects duplicate, unoffered, missing-witness and mismatched availability evidence', () => {
  const names = fenixNames(); names.Choices.Контрагент.push(structuredClone(names.Choices.Контрагент[0])); expect(() => normalizeFenixDiscountChoices(names, fenixScope())).toThrow()
  const mismatch = fenixNames(); mismatch.MissingFamilies = ['Номенклатура']; expect(() => normalizeFenixDiscountChoices(mismatch, fenixScope())).toThrow()
  const selected = { Контрагент: [fenixParty], Номенклатура: [] }
  expect(() => selectedFenixDiscountRequest(fenixScope().Through, selected, null)).toThrow()
  expect(() => selectedFenixDiscountRequest('2026-10-01', selected, fenixNames())).toThrow()
  expect(() => selectedFenixDiscountRequest(fenixScope().Through, { ...selected, Контрагент: ['9'.repeat(32)] }, fenixNames())).toThrow()
  const noProof = fenixNames(); noProof.ChoicesWitnessSha256 = null; expect(() => normalizeFenixDiscountChoices(noProof, fenixScope())).toThrow()
})
it('detaches selected references and binds the completed export to the same exact current witness', () => {
  const names = fenixNames(), selected = { Контрагент: [fenixParty], Номенклатура: [fenixProduct] }
  const request = selectedFenixDiscountRequest(fenixScope().Through, selected, names); selected.Контрагент[0] = '9'.repeat(32)
  expect(request.Counterparties).toEqual([fenixParty]); expect(request.ChoicesWitnessSha256).toBe(fenixChoiceWitness)
  const result = fenixResult(request); expect(normalizeFenixDiscountResult(result, request).Cells[0].Percentage).toBe('-12.340')
  expect(fenixDiscountMatrix(result)[1]).toEqual(['Клієнт Fenix', 'Роздрібна', '-12.340'])
  expect(() => normalizeFenixDiscountResult({ ...result, ChoicesWitnessSha256: 'e'.repeat(64) }, request)).toThrow()
  expect(() => validateFenixDiscountRequest({ ...request, ChoicesWitnessSha256: 'bad' })).toThrow()
})
it('requires exact echo of requested filters while retaining the complete offered universe', () => {
  const request = { ...fenixScope(), Counterparties: [fenixParty] }, names = fenixNames()
  expect(() => normalizeFenixDiscountChoices(names, request)).toThrow(); names.RequestedCounterparties = [fenixParty]
  expect(normalizeFenixDiscountChoices(names, request).Choices.Номенклатура).toHaveLength(1)
})
