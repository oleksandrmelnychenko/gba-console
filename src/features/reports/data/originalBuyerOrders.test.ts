import { expect, it } from 'vitest'
import { base, capability, order, product, productValue, response, stored } from '../testing/buyerOrdersFixtures'
import { buyerOrdersPeriodError, buyerOrdersRequest, isBuyerOrdersCapability, isBuyerOrdersCatalogueEntry, normalizeBuyerOrders } from './originalBuyerOrders'
import { buyerOrdersCsv, buyerOrdersExportError, buyerOrdersHeaders, buyerOrdersMatrix, buyerOrdersPdfDefinition, buyerOrdersValues, buyerOrdersXlsx } from './originalBuyerOrdersExport'
import type { ReportCatalogueEntry } from '../types'
const request = buyerOrdersRequest(capability, '2026-09-01', '2026-09-30')
it('binds own source and default eight Order then Product without a report-unit coefficient', () => {
  expect(isBuyerOrdersCapability(capability)).toBe(true)
  for (const invalid of [{ ...capability, SourceId: '7e2c1a1d-c205-4ade-a42b-9a1a5fce2c17' }, { ...capability, DefaultRows: [1, 0] },
    { ...capability, RequiresReportUnitCoefficient: true }, { ...capability, NativeRoundingVerified: true }]) expect(isBuyerOrdersCapability(invalid)).toBe(false)
})
it('launches only own Fenix builtin and source tuple', () => {
  const entry = { Id: 'builtin:ВедомостьЗаказыПокупателей', Sources: [{ World: 'fenix', SourceId: capability.SourceId }] } as ReportCatalogueEntry
  expect(isBuyerOrdersCatalogueEntry(entry)).toBe(true); expect(isBuyerOrdersCatalogueEntry(entry, ['amg'])).toBe(false)
  expect(isBuyerOrdersCatalogueEntry({ ...entry, Id: 'builtin:ВедомостьТоварыНаСкладах' })).toBe(false)
})
it('requires actual calendar dates, a valid opening month and at most366 inclusive days', () => {
  expect(buyerOrdersPeriodError('2024-02-29', '2024-02-29')).toBeNull(); expect(buyerOrdersPeriodError('2026-02-29', '2026-03-01')).not.toBeNull()
  expect(buyerOrdersPeriodError('0001-01-02', '0001-02-01')).not.toBeNull(); expect(buyerOrdersPeriodError('2024-01-01', '2024-12-31')).toBeNull()
  expect(buyerOrdersPeriodError('2024-01-01', '2025-01-01')).not.toBeNull(); expect(buyerOrdersPeriodError('2026-09-30', '2026-09-01')).not.toBeNull()
})
it('copies all four intrinsic equality keys with complete order tuple and bounded alternatives', () => {
  const filters = [structuredClone(order), structuredClone(productValue), { Field: 2 as const, Type: null, Table: null, Reference: '5'.repeat(32) },
    { Field: 3 as const, Type: null, Table: null, Reference: '3'.repeat(32) }]
  const selected = buyerOrdersRequest(capability, request.From, request.Through, filters); filters[0].Table = '00000101'
  expect(selected.Filters[0].Table).toBe('00000100'); expect(selected.Filters).toHaveLength(4)
  expect(() => buyerOrdersRequest(capability, request.From, request.Through, [{ ...order, Table: null }])).toThrow()
  expect(() => buyerOrdersRequest(capability, request.From, request.Through, [order, { Reference: order.Reference, Field: 0, Table: order.Table, Type: order.Type }])).toThrow()
  expect(() => buyerOrdersRequest(capability, request.From, request.Through, Array(257).fill(order))).toThrow()
  expect(buyerOrdersRequest(capability, request.From, request.Through, [], [3, 1]).Rows).toEqual([3, 1])
})
it('keeps all eight exact signed strings beyond Number precision and refuses unproven native claims', () => {
  const result = normalizeBuyerOrders(response(), request); expect(result.BaseTotals).toEqual(base); expect(result.StoredTotals).toEqual(stored)
  expect(() => normalizeBuyerOrders({ ...response(), SourceParityVerified: true }, request)).toThrow()
  expect(() => normalizeBuyerOrders({ ...response(), AppliesFxConversion: true }, request)).toThrow()
})
it.each(['Base', 'Stored'] as const)('rejects broken %s conservation and totals without rounding', field => {
  const broken = response(); broken.Rows[0][field].Closing = '0.000'; expect(() => normalizeBuyerOrders(broken, request)).toThrow()
  const sum = response(); if (field === 'Base') sum.BaseTotals = { Opening: '0.000', Incoming: '2.014', Outgoing: '-6.006', Closing: '8.020' }
  else sum.StoredTotals = { Opening: '0.000', Incoming: '1.007', Outgoing: '-3.003', Closing: '4.010' }
  expect(() => normalizeBuyerOrders(sum, request)).toThrow()
})
it('separates exact missing storage coefficients from missing normal parents and disables exports for either', () => {
  expect(() => normalizeBuyerOrders({ ...response(), OurSnapshotVerified: false }, request)).toThrow()
  const missing = { ...response(), Available: false, Code: 'original_buyer_orders_storage_unit_selected_keys_unavailable', Rows: [], BaseTotals: null,
    StoredTotals: null, MissingStorageUnitKeys: ['B'.repeat(32)], MissingStorageUnitCount: 1 }
  expect(normalizeBuyerOrders(missing, request).NormalInputsComplete).toBe(true); expect(() => buyerOrdersMatrix(missing)).toThrow()
  expect(() => normalizeBuyerOrders({ ...missing, MissingStorageUnitCount: 2 }, request)).toThrow()
  expect(normalizeBuyerOrders({ ...missing, NormalInputsComplete: false, InputWitnessSha256: null, Code: 'original_buyer_orders_month_publication_unavailable' }, request).Available).toBe(false)
})
it('preserves distinct full order tables even with equal reference and caption and keeps zero rows', () => {
  const value = response(), zero = { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' }, other = { ...order, Table: '00000101' }
  value.Rows.push({ Key: [other, productValue], Base: zero, Stored: zero }); value.FieldChoices.push({ Value: other, Caption: 'Замовлення без назви · 2' })
  expect(normalizeBuyerOrders(value, request).Rows).toHaveLength(2); expect(buyerOrdersMatrix(value)).toHaveLength(6)
  value.Rows[1].Key[0] = { ...order }; expect(() => normalizeBuyerOrders(value, request)).toThrow()
})
it('rejects rows outside selected full order table or product equality', () => {
  expect(() => normalizeBuyerOrders(response(), buyerOrdersRequest(capability, request.From, request.Through, [{ ...order, Table: '00000101' }]))).toThrow()
  expect(() => normalizeBuyerOrders(response(), buyerOrdersRequest(capability, request.From, request.Through, [{ ...productValue, Reference: 'E'.repeat(32) }]))).toThrow()
})
it('screen CSV and PDF use captured hierarchy and the same eight exact values', () => {
  const result = normalizeBuyerOrders(response(), request), matrix = buyerOrdersMatrix(result)
  expect(buyerOrdersHeaders).toHaveLength(10); expect(matrix[1].slice(0, 2)).toEqual(['Замовлення без назви · 1', 'Підсумок замовлення'])
  expect(matrix[2]).toEqual(['Замовлення без назви · 1', 'Наш товар', ...buyerOrdersValues(base, stored)])
  expect(buyerOrdersPdfDefinition(result).content.find(c => 'table' in c)?.table?.body).toEqual(matrix)
  expect(buyerOrdersCsv(result)).toContain(base.Closing); expect(buyerOrdersCsv(result)).not.toContain(product)
})
it('XLSX roundtrip retains default eight as string cells without precision loss', async () => {
  const result = normalizeBuyerOrders(response(), request), blob = await buyerOrdersXlsx(result), XLSX = await import('xlsx')
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob) })
  const book = XLSX.read(buffer, { type: 'array' }), sheet = book.Sheets['Замовлення покупців']
  expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })).toEqual(buyerOrdersMatrix(result)); expect(sheet['C3'].t).toBe('s'); expect(sheet['C3'].v).toBe(base.Opening)
})
it('escapes formula-like captions, keeps signed resources and refuses oversized files without truncation', () => {
  const value = response(); value.FieldChoices[1].Caption = '=2+2'; expect(buyerOrdersCsv(value)).toContain("'=2+2"); expect(buyerOrdersCsv(value)).toContain('"-6.006"')
  value.Rows = Array(100_000).fill(value.Rows[0]); expect(buyerOrdersExportError(value)).not.toBeNull(); expect(() => buyerOrdersMatrix(value)).toThrow()
})
it('genuinely complete empty parents need no unit Current and export zero totals', () => {
  const value = response(), zero = { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' }
  value.Rows = []; value.FieldChoices = []; value.ProductChoices = []; value.BaseTotals = zero; value.StoredTotals = zero
  expect(normalizeBuyerOrders(value, request).Available).toBe(true); expect(buyerOrdersMatrix(value)).toHaveLength(2)
})
it('preserves own AMG unavailable capability and refuses its execution', () => {
  const amg = { ...capability, World: 'amg' as const, Executable: false }; expect(isBuyerOrdersCapability(amg)).toBe(true)
  expect(() => buyerOrdersRequest(amg, request.From, request.Through)).toThrow()
})
