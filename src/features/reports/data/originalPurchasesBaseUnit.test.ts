import { expect, it } from 'vitest'
import { isPurchasesCapability, normalizePurchases, PURCHASES_BASE_UNIT_FIELD, purchasesRequest, type PurchasesBaseUnit } from './originalPurchases'
import { purchasesCsv, purchasesLines, purchasesMatrix, purchasesPdfDefinition, purchasesXlsx } from './originalPurchasesExport'
import { emptyPurchases, purchasesCapability, purchasesResponse } from '../testing/originalPurchasesFixtures'
import { namedPurchasesResponse, purchasesNamedScope } from '../testing/originalPurchasesNamedFixtures'

const ownKey = 'E'.repeat(32)
const observed = (): PurchasesBaseUnit => ({ Field: PURCHASES_BASE_UNIT_FIELD, Type: '08', TableReference: '0000003D', Key: ownKey,
  Caption: 'шт.', CaptionAvailable: true, Code: 'base_unit_description_observed', Deleted: false, NativePresentationVerified: false, SourceParityVerified: false })
function withUnits(unit: PurchasesBaseUnit) {
  const result = namedPurchasesResponse()
  result.BaseMeasurementUnitWitnessSha256 = unit.Code === 'base_product_publication_unavailable' ? null : 'e'.repeat(64)
  for (const row of result.Rows) for (const party of row.Children) for (const product of party.Children) product.AdditionalFields = { [PURCHASES_BASE_UNIT_FIELD]: structuredClone(unit) }
  return result
}
it('requires the exact selected supplementary field and its original same-cell after-group descriptor', () => {
  expect(isPurchasesCapability(purchasesCapability)).toBe(true)
  expect(isPurchasesCapability({ ...purchasesCapability, DefaultAdditionalFields: [] })).toBe(false)
  const setting = purchasesCapability.DefaultAdditionalFieldSettings[0]
  for (const fault of [{ Use: false }, { Placement: 'ВОтдельнойКолонке' }, { Position: 'Перед группировкой' }, { Dimension: 'Контрагент' }, { Field: 'КоличествоБазовыхЕд' }]) {
    expect(isPurchasesCapability({ ...purchasesCapability, DefaultAdditionalFieldSettings: [{ ...setting, ...fault }] })).toBe(false)
  }
})
it('adds the observed own61 unit after the product name in the same cell across screen and exports', async () => {
  const result = normalizePurchases(withUnits(observed()), purchasesNamedScope()), matrix = purchasesMatrix(result)
  expect(matrix[0]).toHaveLength(7)
  expect(matrix[3][2]).toBe('Перший товар, шт.')
  expect(purchasesLines(result).map(row => row.cells)).toEqual(matrix.slice(1, -1))
  expect(purchasesCsv(result)).toContain('Перший товар, шт.')
  expect(JSON.stringify(purchasesPdfDefinition(result))).toContain('Перший товар, шт.')
  const blob = await purchasesXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Закупки'], { header: 1 })).toEqual(matrix)
  expect(book.Sheets['Закупки'].C4).toMatchObject({ t: 's', v: 'Перший товар, шт.' })
})
it.each([
  ['base_product_publication_unavailable', null, null], ['base_product_row_missing', null, null], ['base_unit_link_null', null, null],
  ['base_unit_reference_empty', '0'.repeat(32), null], ['base_unit_publication_unavailable', ownKey, null],
  ['base_unit_row_missing', ownKey, null], ['base_unit_caption_empty', ownKey, false],
] as const)('retains product rows and quantities for exact unavailable state %s', (Code, Key, Deleted) => {
  const result = normalizePurchases(withUnits({ ...observed(), Code, Key, Deleted, Caption: null, CaptionAvailable: false }), purchasesNamedScope())
  expect(result.Rows[0].Children[0].Children).toHaveLength(2)
  expect(result.Rows[0].Children[0].Children[0].AdditionalFields?.[PURCHASES_BASE_UNIT_FIELD].Code).toBe(Code)
  expect(purchasesMatrix(result)[3][2]).toBe('Перший товар, базова одиниця недоступна')
  expect(result.Totals).toEqual(purchasesResponse().Totals)
})
it('rejects coefficient52 identities, invented captions, absent witnesses and impossible empty references', () => {
  const request = purchasesNamedScope()
  for (const unit of [{ ...observed(), TableReference: '00000034' }, { ...observed(), Type: '09' }, { ...observed(), Key: '0'.repeat(32) },
    { ...observed(), Caption: ownKey }, { ...observed(), SourceParityVerified: true }, { ...observed(), Deleted: null },
    { ...observed(), Code: 'base_unit_row_missing' }, { ...observed(), Caption: 'x'.repeat(46) }]) {
    expect(() => normalizePurchases(withUnits(unit as PurchasesBaseUnit), request)).toThrow()
  }
  expect(() => normalizePurchases({ ...withUnits(observed()), BaseMeasurementUnitWitnessSha256: null }, request)).toThrow()
})
it('refuses misplaced or missing supplementary fields while accepting a complete empty result', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'), result = purchasesResponse()
  result.Rows[0].AdditionalFields = { [PURCHASES_BASE_UNIT_FIELD]: observed() }
  expect(() => normalizePurchases(result, request)).toThrow()
  const missing = purchasesResponse(); delete missing.Rows[0].Children[0].Children[0].AdditionalFields
  expect(() => normalizePurchases(missing, request)).toThrow()
  expect(() => normalizePurchases({ ...purchasesResponse(), AdditionalFieldSettings: [] }, request)).toThrow()
  expect(normalizePurchases(emptyPurchases(), request).Available).toBe(true)
})
it('freezes the completed unit caption before later wire mutation without changing stored amount strings', () => {
  const wire = withUnits(observed()), result = normalizePurchases(wire, purchasesNamedScope())
  wire.Rows[0].Children[0].Children[0].AdditionalFields![PURCHASES_BASE_UNIT_FIELD].Caption = 'Later unit'
  expect(purchasesMatrix(result)[3][2]).toBe('Перший товар, шт.')
  expect(purchasesMatrix(result)[3].slice(3)).toEqual(['1.000', '61.73', '12.35', '1.563'])
  expect(purchasesCsv(result)).not.toContain('Later unit')
})
