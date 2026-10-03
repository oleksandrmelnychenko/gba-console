import { describe, expect, it } from 'vitest'
import { isWarehouseQuantityCapability, isWarehouseQuantityCatalogueEntry, normalizeWarehouseQuantity, quantityScaled,
  warehouseQuantityPeriodError, warehouseQuantityRequest, WAREHOUSE_QUANTITY_DEFINITION, WAREHOUSE_QUANTITY_SOURCE,
  type WarehouseQuantityCapability, type WarehouseQuantityResult } from './originalWarehouseQuantity'
import { warehouseQuantityCsv, warehouseQuantityExportError, warehouseQuantityMatrix, warehouseQuantityPdfDefinition } from './originalWarehouseQuantityExport'
import type { ReportCatalogueEntry } from '../types'
const ref = 'A'.repeat(32)
const capability: WarehouseQuantityCapability = { Version: 1, World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE,
  DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION, ModuleSha256: '29bcf58a1951a39cbb6cda7195c7a2da100edb98a2b1b44e2406af5ed5876719',
  QuerySha256: 'ea18073fc8b3fe0f39652a077391038003f6f0617357d749ec9b4f89da479785', Executable: true, Title: 'Відомість',
  PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true, NativeVirtualTableVerified: false,
  SourceParityVerified: false, OriginalFullTaskAccepted: false }
const quantity = { Opening: '9007199254740993.001', Incoming: '0.002', Outgoing: '-0.003', Closing: '9007199254740993.006' }
const request = warehouseQuantityRequest(capability, '2026-09-01', '2026-09-30')
function result(): WarehouseQuantityResult { return { Version: 1, World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE, DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION,
  From: request.From, Through: request.Through, Available: true, Code: 'original_warehouse_quantity_OUR_complete', NormalInputsComplete: true,
  OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
  Rows: [{ Product: ref, Caption: 'Товар', CaptionAvailable: true, Quantity: quantity,
    Receipts: [{ Receipt: { Type: '08', Table: '00000115', Reference: ref }, Caption: 'Назва документа недоступна', CaptionAvailable: false, Quantity: quantity }] }],
  Totals: quantity, ProductChoices: [{ Key: ref, Caption: 'Товар' }], MissingCaptionMappings: ['Receipt'], FilterSummary: [], WarehouseFilterAvailable: false, ReceiptFilterAvailable: false,
  UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion', NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false } }
describe('exact warehouse quantity period delivery', () => {
  it('requires own world definition and does not borrow current dataset7 or AMG', () => {
    expect(isWarehouseQuantityCapability(capability)).toBe(true)
    expect(isWarehouseQuantityCapability({ ...capability, World: 'amg' })).toBe(false)
    expect(isWarehouseQuantityCapability({ ...capability, DefinitionSha256: '0'.repeat(64) })).toBe(false)
    expect(isWarehouseQuantityCapability({ ...capability, SourceParityVerified: true })).toBe(false)
  })
  it('requires exact catalogue identity and the visible Fenix source', () => {
    const entry = { Id: 'builtin:ВедомостьПартииТоваровНаСкладахКоличественныйУчет', Sources: [{ World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE }] } as ReportCatalogueEntry
    expect(isWarehouseQuantityCatalogueEntry(entry)).toBe(true)
    expect(isWarehouseQuantityCatalogueEntry(entry, ['amg'])).toBe(false)
    expect(isWarehouseQuantityCatalogueEntry({ ...entry, Id: 'builtin:ВедомостьПартииТоваровНаСкладах' })).toBe(false)
  })
  it.each(['2026-02-30', '3999-01-01', '2026-9-01'])('rejects invalid calendar boundary %s', value => {
    expect(warehouseQuantityPeriodError(value, '2026-09-30')).not.toBeNull()
  })
  it('preserves inclusive calendar dates and rejects longer than366days', () => {
    expect(warehouseQuantityPeriodError('2026-01-01', '2027-01-01')).toBeNull()
    expect(warehouseQuantityPeriodError('2026-01-01', '2027-01-02')).not.toBeNull()
    expect(request.From).toBe('2026-09-01'); expect(request.Through).toBe('2026-09-30')
  })
  it('copies exact filters and never silently truncates them', () => {
    const products = [ref], copy = warehouseQuantityRequest(capability, request.From, request.Through, products)
    products[0] = 'B'.repeat(32); expect(copy.Products).toEqual([ref])
    expect(() => warehouseQuantityRequest(capability, request.From, request.Through, [ref, ref])).toThrow()
    expect(() => warehouseQuantityRequest(capability, request.From, request.Through, Array(257).fill(ref))).toThrow()
  })
  it('retains amounts beyond Number integer precision with signed closing arithmetic', () => {
    expect(quantityScaled(quantity.Closing)).toBe(9007199254740993006n)
    expect(normalizeWarehouseQuantity(result(), request).Totals).toEqual(quantity)
  })
  it.each(['snapshot', 'parents', 'identity', 'closing', 'duplicate', 'caption-alias'])('rejects partial or foreign response %s', fault => {
    const value = result()
    if (fault === 'snapshot') value.OurSnapshotVerified = false
    if (fault === 'parents') value.NormalInputsComplete = false
    if (fault === 'identity') value.World = 'amg'
    if (fault === 'closing') value.Rows[0].Quantity = { ...quantity, Closing: '0.000' }
    if (fault === 'duplicate') value.Rows.push(structuredClone(value.Rows[0]))
    if (fault === 'caption-alias') Object.assign(value.Rows[0].Receipts[0], { CaptionAvailable: true })
    expect(() => normalizeWarehouseQuantity(value, request)).toThrow()
  })
  it('unavailable means no partial rows no totals and no export', () => {
    const value = { ...result(), Available: false, NormalInputsComplete: false, Code: 'original_warehouse_month_publication_unavailable',
      Rows: [], ProductChoices: [], Totals: null, InputWitnessSha256: null, ResultSha256: null }
    expect(normalizeWarehouseQuantity(value, request).Available).toBe(false)
    expect(() => warehouseQuantityMatrix(value)).toThrow()
    expect(() => normalizeWarehouseQuantity({ ...value, Rows: result().Rows }, request)).toThrow()
  })
  it('receipt equality keeps all three components and duplicate triples refuse', () => {
    const value = result(), child = structuredClone(value.Rows[0].Receipts[0])
    value.Rows[0].Receipts.push(child)
    expect(() => normalizeWarehouseQuantity(value, request)).toThrow()
  })
  it('every export uses the same complete matrix including exact totals and caption gaps', () => {
    const accepted = normalizeWarehouseQuantity(result(), request), matrix = warehouseQuantityMatrix(accepted), pdf = warehouseQuantityPdfDefinition(accepted)
    expect(matrix).toHaveLength(4); expect(matrix.at(-1)?.slice(2)).toEqual(Object.values(quantity))
    expect(pdf.content.find(row => 'table' in row)?.table?.body).toEqual(matrix)
    expect(warehouseQuantityCsv(accepted)).toContain(quantity.Closing)
    expect(warehouseQuantityCsv(accepted)).not.toContain(ref)
  })
  it('caption formulas are escaped without altering signed quantity strings', () => {
    const value = result(); value.Rows[0].Caption = '=2+2'
    expect(warehouseQuantityCsv(value)).toContain("'" + '=2+2')
    expect(warehouseQuantityCsv(value)).toContain('"-0.003"')
  })
  it('resource boundary counts complete product and receipt rows before allocation', () => {
    const value = result()
    value.Rows[0].Receipts = new Array(166_665).fill(value.Rows[0].Receipts[0])
    expect(warehouseQuantityExportError(value)).not.toBeNull()
    expect(() => warehouseQuantityMatrix(value)).toThrow()
  })
})
