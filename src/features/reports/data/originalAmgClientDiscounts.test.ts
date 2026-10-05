import { describe, expect, it } from 'vitest'
import { amgDateError, amgDiscountFields, amgPercentage, amgRecipientKey, emptyAmgSelection, normalizeAmgChoices, normalizeAmgDiscounts, normalizeAmgReadiness, selectedAmgRequest, validateAmgDiscountRequest } from './originalAmgClientDiscounts'
import { amgChoices, amgClient, amgEmpty, amgMissing, amgProduct, amgReadiness, amgRegion, amgResult, amgScope, amgWitness } from '../testing/originalAmgClientDiscountsFixtures'
describe('own AMG default scope and normal evidence', () => {
  it('uses actual OUR header readiness while current Source and parity remain false', () => {
    expect(normalizeAmgReadiness(amgReadiness)).toMatchObject({ Executable: true, CurrentSourceVerified: false, SourceParityVerified: false, HumanChoicesAvailable: false })
    expect(normalizeAmgReadiness({ ...amgReadiness, Executable: false, OurSnapshotVerified: false }).Executable).toBe(false)
    expect(() => normalizeAmgReadiness({ ...amgReadiness, World: 'fenix' })).toThrow()
    expect(() => normalizeAmgReadiness({ ...amgReadiness, OurSnapshotVerified: false })).toThrow()
  })
  it('canonicalizes and detaches typed recipients without collapsing equal RRefs', () => {
    const request = amgScope(); request.Recipients = [{ ...amgClient, Table: '0000002A' }, { ...amgClient }]
    const detached = validateAmgDiscountRequest(request); request.Recipients[0].Reference = '3'.repeat(32)
    expect(detached.Recipients.map(amgRecipientKey)).toEqual([`08:0000002A:${amgClient.Reference}`, amgRecipientKey(amgClient)])
  })
  it('rejects duplicate selectors, invalid calendar days and unknown witness formats', () => {
    expect(amgDateError('2026-02-29')).not.toBeNull(); expect(amgDateError('2024-02-29')).toBeNull()
    expect(() => validateAmgDiscountRequest({ ...amgScope(), Products: [amgProduct, amgProduct] })).toThrow()
    expect(() => validateAmgDiscountRequest({ ...amgScope(), ChoicesWitnessSha256: 'B'.repeat(64) })).toThrow()
  })
  it('retains exact signed numeric(5,2) values and rejects rounding/negative-zero/overflow', () => {
    expect(amgPercentage('-999.99')).toBe(-99999n); expect(amgPercentage('0.00')).toBe(0n)
    for (const v of ['-0.00', '01.00', '1000.00', '1.234', 1.23]) expect(() => amgPercentage(v)).toThrow()
  })
  it('distinguishes a complete empty result from missing publication and keeps detached bytes', () => {
    expect(normalizeAmgDiscounts(amgEmpty(), amgScope()).InputAvailable).toBe(true)
    expect(normalizeAmgDiscounts(amgMissing(), amgScope()).InputAvailable).toBe(false)
    const raw = amgResult(), normalized = normalizeAmgDiscounts(raw, amgScope()); raw.Cells[0].Percentage = '99.00'
    expect(normalized.Cells[0].Percentage).toBe('-12.34')
  })
  it('rejects foreign scope, stale witness, duplicate grain and invented maximum', () => {
    for (const change of [{ World: 'fenix' }, { Through: '2026-09-29' }, { ChoicesWitnessSha256: amgWitness }, { MaximumPercentage: '0.00' }, { Cells: [...amgResult().Cells, ...amgResult().Cells] }]) {
      expect(() => normalizeAmgDiscounts({ ...amgResult(), ...change }, amgScope())).toThrow()
    }
  })
  it('rejects recipient aliases and selected rows outside the exact requested typed scope', () => {
    expect(() => normalizeAmgDiscounts({ ...amgResult(), Cells: [{ ...amgResult().Cells[0], Recipient: { ...amgClient, Table: '0000002C' } }] }, amgScope())).toThrow()
    expect(() => normalizeAmgDiscounts(amgResult({ ...amgScope(), Products: ['F'.repeat(32)] }), { ...amgScope(), Products: ['F'.repeat(32)] })).toThrow()
  })
  it('allows independently available human selector families and retains complete empty families', () => {
    const raw = amgChoices(); raw.FieldAvailability.КодПоРегиону = false; raw.Choices.КодПоРегиону = []; raw.MissingFamilies = ['КодПоРегиону']; raw.HumanChoicesAvailable = false; raw.Dependency = 'ordinary_amg_discount_caption_unavailable'
    expect(normalizeAmgChoices(raw, amgScope()).FieldAvailability.Номенклатура).toBe(true)
    const empty = amgChoices(); for (const f of amgDiscountFields) empty.Choices[f] = []
    expect(normalizeAmgChoices(empty, amgScope()).HumanChoicesAvailable).toBe(true)
  })
  it('rejects fake catalogue types, raw RRef recipient keys and fabricated regional names', () => {
    for (const mutate of [() => { const v = amgChoices(); v.Choices.ПолучательСкидки[0].Key = amgClient.Reference; return v },
      () => { const v = amgChoices(); v.Choices.Номенклатура[0].TableReference = '00000054'; return v },
      () => { const v = amgChoices(); v.Choices.КодПоРегиону[0].Caption = 'Область замість коду'; return v }]) expect(() => normalizeAmgChoices(mutate(), amgScope())).toThrow()
  })
  it('binds all selected fields to genuine current choices and preserves direct region', () => {
    const selected = { Номенклатура: [amgProduct], ПолучательСкидки: [amgRecipientKey(amgClient)], КодПоРегиону: [amgRegion] }
    expect(selectedAmgRequest(amgScope().Through, selected, amgChoices())).toMatchObject({ Products: [amgProduct], Recipients: [amgClient], RegionCodes: [amgRegion], ChoicesWitnessSha256: amgWitness })
    expect(() => selectedAmgRequest('2026-10-01', selected, amgChoices())).toThrow()
    expect(() => selectedAmgRequest(amgScope().Through, { ...emptyAmgSelection(), Номенклатура: ['F'.repeat(32)] }, amgChoices())).toThrow()
  })
})
