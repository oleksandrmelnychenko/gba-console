import { describe, expect, it } from 'vitest'
import { fenixDateError, fenixDiscountFields, fenixPercentage, fenixRecipientKey, emptyFenixSelection, normalizeFenixChoices, normalizeFenixDiscounts, normalizeFenixReadiness, selectedFenixRequest, validateFenixDiscountRequest } from './originalFenixClientDiscounts'
import { fenixChoices, fenixClient, fenixEmpty, fenixMissing, fenixProduct, fenixReadiness, fenixRegion, fenixResult, fenixScope, fenixWitness } from '../testing/originalFenixClientDiscountsFixtures'
describe('own FENIX default scope and normal evidence', () => {
  it('uses actual OUR header readiness while current Source and parity remain false', () => {
    expect(normalizeFenixReadiness(fenixReadiness)).toMatchObject({ Executable: true, CurrentSourceVerified: false, SourceParityVerified: false, HumanChoicesAvailable: false })
    expect(normalizeFenixReadiness({ ...fenixReadiness, Executable: false, OurSnapshotVerified: false }).Executable).toBe(false)
    expect(() => normalizeFenixReadiness({ ...fenixReadiness, World: 'amg' })).toThrow()
    expect(() => normalizeFenixReadiness({ ...fenixReadiness, OurSnapshotVerified: false })).toThrow()
  })
  it('canonicalizes and detaches typed recipients without collapsing equal RRefs', () => {
    const request = fenixScope(); request.Recipients = [{ ...fenixClient, Table: '0000002A' }, { ...fenixClient }]
    const detached = validateFenixDiscountRequest(request); request.Recipients[0].Reference = '3'.repeat(32)
    expect(detached.Recipients.map(fenixRecipientKey)).toEqual([`08:0000002A:${fenixClient.Reference}`, fenixRecipientKey(fenixClient)])
  })
  it('rejects duplicate selectors, invalid calendar days and unknown witness formats', () => {
    expect(fenixDateError('2026-02-29')).not.toBeNull(); expect(fenixDateError('2024-02-29')).toBeNull()
    expect(() => validateFenixDiscountRequest({ ...fenixScope(), Products: [fenixProduct, fenixProduct] })).toThrow()
    expect(() => validateFenixDiscountRequest({ ...fenixScope(), ChoicesWitnessSha256: 'B'.repeat(64) })).toThrow()
  })
  it('retains exact signed numeric(5,2) values and rejects rounding/negative-zero/overflow', () => {
    expect(fenixPercentage('-999.99')).toBe(-99999n); expect(fenixPercentage('0.00')).toBe(0n)
    for (const v of ['-0.00', '01.00', '1000.00', '1.234', 1.23]) expect(() => fenixPercentage(v)).toThrow()
  })
  it('distinguishes a complete empty result from missing publication and keeps detached bytes', () => {
    expect(normalizeFenixDiscounts(fenixEmpty(), fenixScope()).InputAvailable).toBe(true)
    expect(normalizeFenixDiscounts(fenixMissing(), fenixScope()).InputAvailable).toBe(false)
    const raw = fenixResult(), normalized = normalizeFenixDiscounts(raw, fenixScope()); raw.Cells[0].Percentage = '99.00'
    expect(normalized.Cells[0].Percentage).toBe('-12.34')
  })
  it('rejects foreign scope, stale witness, duplicate grain and invented maximum', () => {
    for (const change of [{ World: 'amg' }, { Through: '2026-09-29' }, { ChoicesWitnessSha256: fenixWitness }, { MaximumPercentage: '0.00' }, { Cells: [...fenixResult().Cells, ...fenixResult().Cells] }]) {
      expect(() => normalizeFenixDiscounts({ ...fenixResult(), ...change }, fenixScope())).toThrow()
    }
  })
  it('rejects recipient aliases and selected rows outside the exact requested typed scope', () => {
    expect(() => normalizeFenixDiscounts({ ...fenixResult(), Cells: [{ ...fenixResult().Cells[0], Recipient: { ...fenixClient, Table: '0000002C' } }] }, fenixScope())).toThrow()
    expect(() => normalizeFenixDiscounts(fenixResult({ ...fenixScope(), Products: ['F'.repeat(32)] }), { ...fenixScope(), Products: ['F'.repeat(32)] })).toThrow()
  })
  it('allows independently available human selector families and retains complete empty families', () => {
    const raw = fenixChoices(); raw.FieldAvailability.КодПоРегиону = false; raw.Choices.КодПоРегиону = []; raw.MissingFamilies = ['КодПоРегиону']; raw.HumanChoicesAvailable = false; raw.Dependency = 'ordinary_fenix_discount_caption_unavailable'
    expect(normalizeFenixChoices(raw, fenixScope()).FieldAvailability.Номенклатура).toBe(true)
    const empty = fenixChoices(); for (const f of fenixDiscountFields) empty.Choices[f] = []
    expect(normalizeFenixChoices(empty, fenixScope()).HumanChoicesAvailable).toBe(true)
  })
  it('rejects fake catalogue types, raw RRef recipient keys and fabricated regional names', () => {
    for (const mutate of [() => { const v = fenixChoices(); v.Choices.ПолучательСкидки[0].Key = fenixClient.Reference; return v },
      () => { const v = fenixChoices(); v.Choices.Номенклатура[0].TableReference = '0000006C'; return v },
      () => { const v = fenixChoices(); v.Choices.КодПоРегиону[0].Caption = 'Область замість коду'; return v }]) expect(() => normalizeFenixChoices(mutate(), fenixScope())).toThrow()
  })
  it('preserves genuine padded, numeric and reference-like captions but refuses malformed UTF16', () => {
    for (const caption of ['  caption  ', '123', fenixProduct]) {
      const choices = fenixChoices(); choices.Choices.Номенклатура[0].Caption = caption
      expect(normalizeFenixChoices(choices, fenixScope()).Choices.Номенклатура[0].Caption).toBe(caption)
      const result = fenixResult(); result.Cells[0].ProductName = caption
      expect(normalizeFenixDiscounts(result, fenixScope()).Cells[0].ProductName).toBe(caption)
    }
    const broken = fenixChoices(); broken.Choices.Номенклатура[0].Caption = '\ud800'
    expect(() => normalizeFenixChoices(broken, fenixScope())).toThrow()
  })
  it('binds all selected fields to genuine current choices and preserves direct region', () => {
    const selected = { Номенклатура: [fenixProduct], ПолучательСкидки: [fenixRecipientKey(fenixClient)], КодПоРегиону: [fenixRegion] }
    expect(selectedFenixRequest(fenixScope().Through, selected, fenixChoices())).toMatchObject({ Products: [fenixProduct], Recipients: [fenixClient], RegionCodes: [fenixRegion], ChoicesWitnessSha256: fenixWitness })
    expect(() => selectedFenixRequest('2026-10-01', selected, fenixChoices())).toThrow()
    expect(() => selectedFenixRequest(fenixScope().Through, { ...emptyFenixSelection(), Номенклатура: ['F'.repeat(32)] }, fenixChoices())).toThrow()
  })
})
