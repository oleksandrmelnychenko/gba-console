import { describe, expect, it } from 'vitest'
import { isWarehouseMonetaryCapability, isWarehouseMonetaryCatalogueEntry, normalizeWarehouseMonetary, warehouseMonetaryDefaultMeasures,
  warehouseMonetaryRequest, warehouseMonetaryScaled, WAREHOUSE_MONETARY_SOURCE, WAREHOUSE_MONETARY_DEFINITION,
  type WarehouseMonetaryCapability, type WarehouseMonetaryResources, type WarehouseMonetaryResult } from './originalWarehouseMonetary'
import { warehouseMonetaryCsv, warehouseMonetaryExportError, warehouseMonetaryHeaders, warehouseMonetaryMatrix,
  warehouseMonetaryPdfDefinition, warehouseMonetaryValues } from './originalWarehouseMonetaryExport'
import type { ReportCatalogueEntry } from '../types'
const ref = 'A'.repeat(32)
const capability: WarehouseMonetaryCapability = { Version: 1, World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE,
  DefinitionSha256: WAREHOUSE_MONETARY_DEFINITION, ModuleSha256: 'e5b629dd087052bf882091c962cf994a8fea720146e501d5b3aa3640fabcdc4b',
  QuerySha256: 'e64d3dee516b4eae8c2065f1a89779a6bb35193e48e02661c955c6398355065c', Executable: true, Title: 'Відомість',
  PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true, CurrentWarehouseCaptionChoicesSupported: true,
  MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption', ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false,
  DefaultMeasures: warehouseMonetaryDefaultMeasures, NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const amounts: WarehouseMonetaryResources = { Quantity: { Opening: '9007199254740993.001', Incoming: '0.002', Outgoing: '-0.003', Closing: '9007199254740993.006' },
  Cost: { Opening: '9007199254740993.01', Incoming: '0.02', Outgoing: '-0.03', Closing: '9007199254740993.06' },
  Vat: { Opening: '-10.01', Incoming: '-2.02', Outgoing: '3.03', Closing: '-15.06' } }
const query = warehouseMonetaryRequest(capability, '2026-09-01', '2026-09-30')
function result(): WarehouseMonetaryResult { return { Version: 1, World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE, DefinitionSha256: WAREHOUSE_MONETARY_DEFINITION,
  From: query.From, Through: query.Through, Available: true, Code: 'original_warehouse_monetary_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
  InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Product: ref, Caption: 'Товар', CaptionAvailable: true, Resources: structuredClone(amounts),
    Receipts: [{ Receipt: { Type: '08', Table: '00000115', Reference: ref }, Caption: 'Назва документа недоступна', CaptionAvailable: false, Resources: structuredClone(amounts) }] }],
  Totals: structuredClone(amounts), ProductChoices: [{ Key: ref, Caption: 'Товар' }], MissingCaptionMappings: ['Receipt'], FilterSummary: [], WarehouseChoices: [],
  WarehouseCaptionPolicy: 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation', WarehouseFilterAvailable: false, ReceiptFilterAvailable: false,
  UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion', MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption', ManagementCurrencyPresentationVerified: false,
  AppliesFxConversion: false, NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false } }

describe('exact monetary warehouse period delivery', () => {
  it('requires exact monetary original and all twelve advertised measures in retained order', () => {
    expect(isWarehouseMonetaryCapability(capability)).toBe(true)
    expect(isWarehouseMonetaryCapability({ ...capability, SourceId: 'dd98a3b9-e627-4a83-9f66-2dfe7686085c' })).toBe(false)
    expect(isWarehouseMonetaryCapability({ ...capability, DefaultMeasures: capability.DefaultMeasures.slice().reverse() })).toBe(false)
    expect(isWarehouseMonetaryCapability({ ...capability, World: 'amg' })).toBe(false)
  })
  it('adds only own monetary builtin Fenix action and leaves quantity and current-slice choices distinct', () => {
    const entry = { Id: 'builtin:ВедомостьПартииТоваровНаСкладах', Sources: [{ World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE }] } as ReportCatalogueEntry
    expect(isWarehouseMonetaryCatalogueEntry(entry)).toBe(true)
    expect(isWarehouseMonetaryCatalogueEntry(entry, ['amg'])).toBe(false)
    expect(isWarehouseMonetaryCatalogueEntry({ ...entry, Id: 'builtin:ВедомостьПартииТоваровНаСкладахКоличественныйУчет' })).toBe(false)
  })
  it('retains signed exact three-decimal quantities and two-decimal money beyond Number precision', () => {
    expect(warehouseMonetaryScaled(amounts.Cost.Closing, 2)).toBe(900719925474099306n)
    expect(normalizeWarehouseMonetary(result(), query).Totals).toEqual(amounts)
    expect(() => warehouseMonetaryScaled('1.000', 2)).toThrow()
    expect(() => warehouseMonetaryScaled('-0.00', 2)).toThrow()
  })
  it.each(['Quantity', 'Cost', 'Vat'] as const)('rejects broken closing or hierarchy for %s independently', resource => {
    const value = result(); value.Rows[0].Resources[resource].Closing = resource === 'Quantity' ? '0.000' : '0.00'
    expect(() => normalizeWarehouseMonetary(value, query)).toThrow()
  })
  it('does not invent missing money resources or coerce them to zero', () => {
    const value = result() as unknown as { Rows: Array<{ Resources: Record<string, unknown> }> }
    value.Rows[0].Resources.Cost = null
    expect(() => normalizeWarehouseMonetary(value, query)).toThrow()
  })
  it('requires complete snapshot and own parents before any of the twelve fields can be delivered', () => {
    expect(() => normalizeWarehouseMonetary({ ...result(), OurSnapshotVerified: false }, query)).toThrow()
    expect(() => normalizeWarehouseMonetary({ ...result(), NormalInputsComplete: false }, query)).toThrow()
    const missing = { ...result(), Available: false, Code: 'original_warehouse_month_publication_unavailable', NormalInputsComplete: false,
      Rows: [], ProductChoices: [], WarehouseChoices: [], WarehouseCaptionPolicy: undefined, Totals: null, InputWitnessSha256: null, ResultSha256: null }
    expect(normalizeWarehouseMonetary(missing, query).Available).toBe(false)
    expect(() => warehouseMonetaryMatrix(missing)).toThrow()
  })
  it('copies all equality selections without truncating scope and refuses rows outside selected products', () => {
    const products = [ref], warehouses = ['B'.repeat(32)]
    const selected = warehouseMonetaryRequest(capability, query.From, query.Through, products, warehouses)
    products[0] = 'C'.repeat(32); warehouses[0] = 'D'.repeat(32)
    expect(selected.Products).toEqual([ref]); expect(selected.Warehouses).toEqual(['B'.repeat(32)])
    expect(() => warehouseMonetaryRequest(capability, query.From, query.Through, Array(257).fill(ref))).toThrow()
    const value = result(); value.Rows[0].Product = 'B'.repeat(32)
    expect(() => normalizeWarehouseMonetary(value, warehouseMonetaryRequest(capability, query.From, query.Through, [ref]))).toThrow()
  })
  it('uses validated complete receipt tuple rather than JSON property order for duplicate detection', () => {
    const value = result(), child = structuredClone(value.Rows[0].Receipts[0])
    child.Receipt = { Reference: child.Receipt.Reference, Table: child.Receipt.Table, Type: child.Receipt.Type }
    child.Resources = { Quantity: { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' },
      Cost: { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }, Vat: { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' } }
    value.Rows[0].Receipts.push(child)
    expect(() => normalizeWarehouseMonetary(value, query)).toThrow()
  })
  it('authenticates human warehouse choices without aliasing money or receipt references', () => {
    const selected = warehouseMonetaryRequest(capability, query.From, query.Through, [], [ref]), value = result()
    Object.assign(value, { WarehouseChoices: [{ Key: ref, Caption: 'Наш склад' }], WarehouseFilterAvailable: true,
      WarehouseCaptionWitnessSha256: 'c'.repeat(64), FilterSummary: ['Склад: Наш склад'] })
    expect(normalizeWarehouseMonetary(value, selected).Totals).toEqual(amounts)
    expect(warehouseMonetaryCsv(value)).toContain('Склад: Наш склад')
    expect(() => normalizeWarehouseMonetary({ ...value, WarehouseCaptionWitnessSha256: undefined }, selected)).toThrow()
  })
  it('keeps existing currency presentation and FX claims false while raw management resources remain usable', () => {
    expect(normalizeWarehouseMonetary(result(), query).Available).toBe(true)
    expect(() => normalizeWarehouseMonetary({ ...result(), AppliesFxConversion: true }, query)).toThrow()
    expect(() => normalizeWarehouseMonetary({ ...result(), MoneyUnitPolicy: 'EUR' }, query)).toThrow()
    expect(() => normalizeWarehouseMonetary({ ...result(), ManagementCurrencyPresentationVerified: true }, query)).toThrow()
  })
  it('exports exactly the same complete twelve-column source-order result and precise signed strings', () => {
    const accepted = normalizeWarehouseMonetary(result(), query), matrix = warehouseMonetaryMatrix(accepted)
    expect(warehouseMonetaryHeaders).toHaveLength(14)
    expect(matrix.at(-1)?.slice(2)).toEqual(warehouseMonetaryValues(amounts))
    expect(matrix[0].slice(2, 5)).toEqual(['Початковий залишок · кількість', 'Початковий залишок · вартість', 'Початковий залишок · ПДВ'])
    expect(warehouseMonetaryPdfDefinition(accepted).content.find(row => 'table' in row)?.table?.body).toEqual(matrix)
    expect(warehouseMonetaryCsv(accepted)).toContain(amounts.Cost.Closing)
    expect(warehouseMonetaryCsv(accepted)).not.toContain(ref)
  })
  it('escapes human labels but preserves signed amounts and never emits a partial export at the cell bound', () => {
    const value = result(); value.Rows[0].Caption = '=2+2'
    expect(warehouseMonetaryCsv(value)).toContain("'" + '=2+2')
    expect(warehouseMonetaryCsv(value)).toContain('"-15.06"')
    value.Rows[0].Receipts = Array(71_427).fill(value.Rows[0].Receipts[0])
    expect(warehouseMonetaryExportError(value)).not.toBeNull()
    expect(() => warehouseMonetaryMatrix(value)).toThrow()
  })
})
