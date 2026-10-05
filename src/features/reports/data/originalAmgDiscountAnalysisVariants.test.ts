import { expect, it } from 'vitest'
import { amgDiscountVariantScope, normalizeAmgDiscountVariant, normalizeAmgDiscountVariantList, restoreAmgDiscountVariantSelection, validateAmgDiscountVariantSave } from './originalAmgDiscountAnalysisVariants'
import { amgNames, amgChoiceWitness } from '../testing/originalAmgDiscountAnalysisChoicesFixtures'
import { amgParty, amgProduct, amgScope } from '../testing/originalAmgDiscountAnalysisFixtures'
import { amgVariant, amgVariantList } from '../testing/originalAmgDiscountVariantFixtures'
it('persists only detached own date filters and captured default grouping, never a publication witness', () => {
  const request = { ...amgScope(), Counterparties: [amgParty], ChoicesWitnessSha256: amgChoiceWitness }, scope = amgDiscountVariantScope(request)
  request.Counterparties.length = 0; expect(scope.Request.Counterparties).toEqual([amgParty]); expect(scope.Request.ChoicesWitnessSha256).toBeUndefined()
  expect(scope.Rows).toEqual(['Контрагент']); expect(scope.Columns).toEqual(['Номенклатура']); expect(scope.Measures).toEqual(['ТипЦен', 'ПроцентСкидкиНаценки'])
})
it.each(['world', 'source', 'shape', 'authority', 'revision'])('refuses an unsupported own saved variant %s', field => {
  const value = amgVariant()
  if (field === 'world') value.Scope.Request.World = 'fenix' as 'amg'
  if (field === 'source') Object.assign(value.Scope.Request, { SourceId: '56e2ad4b-9f75-4461-a742-eb54ae01823f' })
  if (field === 'shape') value.Scope.Measures[0] = 'other' as 'ТипЦен'
  if (field === 'authority') value.Scope.Request.ChoicesWitnessSha256 = amgChoiceWitness
  if (field === 'revision') value.Revision = 0
  expect(() => normalizeAmgDiscountVariant(value)).toThrow()
})
it('requires fresh matching full names and retains every saved reference until it is explicitly cleared', () => {
  const saved = amgVariant(), names = amgNames(); expect(restoreAmgDiscountVariantSelection(saved.Scope, names)).toBeNull()
  names.RequestedCounterparties = [amgParty]; names.RequestedProducts = [amgProduct]
  expect(restoreAmgDiscountVariantSelection(saved.Scope, names)).toEqual({ Контрагент: [amgParty], Номенклатура: [amgProduct] })
  saved.Scope.Request.Products = ['9'.repeat(32)]; names.RequestedProducts = ['9'.repeat(32)]
  expect(restoreAmgDiscountVariantSelection(saved.Scope, names)).toBeNull(); expect(saved.Scope.Request.Products).toEqual(['9'.repeat(32)])
})
it('distinguishes unavailable storage from a complete empty owner list and rejects duplicate ids', () => {
  expect(normalizeAmgDiscountVariantList({ StorageAvailable: false, Dependency: 'original_amg_discount_variant_storage_unavailable', Items: [] }).StorageAvailable).toBe(false)
  expect(normalizeAmgDiscountVariantList({ StorageAvailable: true, Dependency: null, Items: [] }).StorageAvailable).toBe(true)
  const list = amgVariantList(); list.Items.push(amgVariant()); expect(() => normalizeAmgDiscountVariantList(list)).toThrow()
})
it('validates create versus revision CAS and detaches save payloads', () => {
  const value = amgVariant(); expect(() => validateAmgDiscountVariantSave({ Id: null, Revision: 1, Name: 'mine', Scope: value.Scope })).toThrow()
  const saved = validateAmgDiscountVariantSave({ Id: value.Id, Revision: 1, Name: '  mine  ', Scope: value.Scope }); value.Scope.Request.Products.length = 0
  expect(saved.Name).toBe('mine'); expect(saved.Scope.Request.Products).toEqual([amgProduct])
})
