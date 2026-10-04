import { describe, expect, it } from 'vitest'
import { capability, product, resources, response } from '../testing/transferredGoodsFixtures'
import { isTransferredCapability, isTransferredCatalogueEntry, normalizeTransferred, transferredPeriodError, transferredRequest,
  type TransferredReceipt } from './originalTransferredGoods'
import { transferredCsv, transferredExportError, transferredHeaders, transferredMatrix, transferredPdfDefinition, transferredValues, transferredXlsx } from './originalTransferredGoodsExport'
import type { ReportCatalogueEntry } from '../types'
const query = transferredRequest(capability, '2026-09-01', '2026-09-30')

describe('own transferred-goods original/default delivery', () => {
  it('binds exact UUID module query and Receipt then Product order without a warehouse report alias', () => {
    expect(isTransferredCapability(capability)).toBe(true)
    expect(isTransferredCapability({ ...capability, SourceId: 'fde97241-e736-4c21-9e61-2d6ecafa0b91' })).toBe(false)
    expect(isTransferredCapability({ ...capability, ModuleSha256: '0'.repeat(64) })).toBe(false)
    expect(isTransferredCapability({ ...capability, DefaultRows: capability.DefaultRows.slice().reverse() })).toBe(false)
    expect(isTransferredCapability({ ...capability, DefaultMeasures: capability.DefaultMeasures.slice().reverse() })).toBe(false)
  })
  it('launches only own builtin and Fenix source when its world is selected', () => {
    const entry = { Id: 'builtin:ВедомостьПартииТоваровПереданных', Sources: [{ World: 'fenix', SourceId: capability.SourceId }] } as ReportCatalogueEntry
    expect(isTransferredCatalogueEntry(entry)).toBe(true)
    expect(isTransferredCatalogueEntry(entry, ['amg'])).toBe(false)
    expect(isTransferredCatalogueEntry({ ...entry, Id: 'builtin:ВедомостьТоварыУКомиссионеров' })).toBe(false)
    expect(isTransferredCatalogueEntry({ ...entry, Sources: [{ World: 'fenix', SourceId: 'other' }] } as ReportCatalogueEntry)).toBe(false)
  })
  it('requires real explicit calendar dates including leap days and at most 366 inclusive days', () => {
    expect(transferredPeriodError('2024-02-29', '2024-02-29')).toBeNull()
    expect(transferredPeriodError('2026-02-29', '2026-03-01')).not.toBeNull()
    expect(transferredPeriodError('2024-01-01', '2024-12-31')).toBeNull()
    expect(transferredPeriodError('2024-01-01', '2025-01-01')).not.toBeNull()
    expect(transferredPeriodError('0001-01-02', '0001-02-01')).not.toBeNull()
    expect(transferredPeriodError('2026-09-30', '2026-09-01')).not.toBeNull()
  })
  it('copies both bounded filters and refuses malformed or duplicate compound keys independent of property order', () => {
    const products = [product], receipt = { Type: '08', Table: '00000115', Reference: 'C'.repeat(32) }
    const selected = transferredRequest(capability, query.From, query.Through, products, [receipt])
    products[0] = 'B'.repeat(32); receipt.Table = '00000116'
    expect(selected.Products).toEqual([product]); expect(selected.Receipts[0].Table).toBe('00000115')
    const key = selected.Receipts[0]
    expect(() => transferredRequest(capability, query.From, query.Through, [], [key, { Reference: key.Reference, Table: key.Table, Type: key.Type }])).toThrow()
    expect(() => transferredRequest(capability, query.From, query.Through, Array(257).fill(product))).toThrow()
    expect(() => transferredRequest(capability, query.From, query.Through, [], [{ Type: '08', Reference: key.Reference } as TransferredReceipt])).toThrow()
  })
  it('keeps all twelve signed strings beyond Number precision with management and native parity claims false', () => {
    const result = normalizeTransferred(response(), query)
    expect(result.Totals).toEqual(resources); expect(result.Rows[0].Products[0].Resources.Cost.Closing).toBe('9007199254740993.06')
    expect(() => normalizeTransferred({ ...response(), AppliesFxConversion: true }, query)).toThrow()
    expect(() => normalizeTransferred({ ...response(), ManagementCurrencyPresentationVerified: true }, query)).toThrow()
    expect(() => normalizeTransferred({ ...response(), SourceParityVerified: true }, query)).toThrow()
  })
  it.each(['Quantity', 'Cost', 'Vat'] as const)('refuses a broken %s closing equation or group total', field => {
    const result = response(); result.Rows[0].Products[0].Resources[field].Closing = field === 'Quantity' ? '0.000' : '0.00'
    expect(() => normalizeTransferred(result, query)).toThrow()
  })
  it('rejects partial snapshot or missing parents and never exports unavailable rows', () => {
    expect(() => normalizeTransferred({ ...response(), OurSnapshotVerified: false }, query)).toThrow()
    expect(() => normalizeTransferred({ ...response(), NormalInputsComplete: false }, query)).toThrow()
    const missing = { ...response(), Available: false, Code: 'original_transferred_month_publication_unavailable', NormalInputsComplete: false,
      Rows: [], Totals: null, ProductChoices: [], InputWitnessSha256: null, ResultSha256: null }
    expect(normalizeTransferred(missing, query).Available).toBe(false); expect(() => transferredMatrix(missing)).toThrow()
    expect(() => normalizeTransferred({ ...missing, Rows: response().Rows }, query)).toThrow()
  })
  it('keeps unknown human captions and complete compound root keys without merging equal names or dropping zero products', () => {
    const value = response(), other = structuredClone(value.Rows[0])
    const zero = { Quantity: { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' },
      Cost: { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }, Vat: { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' } }
    other.Receipt.Table = '00000116'; other.Resources = zero; other.Products[0].Resources = zero
    other.Products[0].CaptionAvailable = false; other.Products[0].Caption = 'Назва товару недоступна'; value.Rows.push(other)
    expect(normalizeTransferred(value, query).Rows).toHaveLength(2)
    expect(transferredMatrix(value)).toHaveLength(6)
    other.Receipt = { Reference: other.Receipt.Reference, Table: '00000115', Type: other.Receipt.Type }
    expect(() => normalizeTransferred(value, query)).toThrow()
  })
  it('refuses rows outside either exact equality selection', () => {
    expect(() => normalizeTransferred(response(), transferredRequest(capability, query.From, query.Through, ['B'.repeat(32)]))).toThrow()
    expect(() => normalizeTransferred(response(), transferredRequest(capability, query.From, query.Through, [],
      [{ Type: '09', Table: '00000115', Reference: 'C'.repeat(32) }]))).toThrow()
  })
  it('screen CSV and PDF share captured Receipt then Product order and all twelve exact cells', () => {
    const accepted = normalizeTransferred(response(), query), matrix = transferredMatrix(accepted)
    expect(transferredHeaders.slice(0, 2)).toEqual(['Документ надходження', 'Товар']); expect(transferredHeaders).toHaveLength(14)
    expect(matrix[1].slice(0, 2)).toEqual(['Назва документа недоступна', 'Підсумок документа'])
    expect(matrix[2].slice(0, 2)).toEqual(['Назва документа недоступна', 'Наш товар'])
    expect(matrix.at(-1)?.slice(2)).toEqual(transferredValues(resources))
    expect(transferredPdfDefinition(accepted).content.find(row => 'table' in row)?.table?.body).toEqual(matrix)
    expect(transferredCsv(accepted)).toContain(resources.Cost.Closing); expect(transferredCsv(accepted)).not.toContain(product)
  })
  it('XLSX roundtrip retains every resource as a string and uses the same complete matrix', async () => {
    const accepted = normalizeTransferred(response(), query), blob = await transferredXlsx(accepted), XLSX = await import('xlsx')
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob)
    })
    const book = XLSX.read(buffer, { type: 'array' }), sheet = book.Sheets['Передані товари']
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })).toEqual(transferredMatrix(accepted))
    expect(sheet['D3'].t).toBe('s'); expect(sheet['D3'].v).toBe(resources.Cost.Opening)
  })
  it('escapes formula-like human text and refuses a whole oversized export without truncation', () => {
    const value = response(); value.Rows[0].Products[0].Caption = '=2+2'
    expect(transferredCsv(value)).toContain("'=2+2"); expect(transferredCsv(value)).toContain('"-15.06"')
    value.Rows[0].Products = Array(71_427).fill(value.Rows[0].Products[0])
    expect(transferredExportError(value)).not.toBeNull(); expect(() => transferredMatrix(value)).toThrow()
  })
  it('rejects AMG execution while preserving the distinct unavailable world capability', () => {
    const amg = { ...capability, World: 'amg' as const, Executable: false }
    expect(isTransferredCapability(amg)).toBe(true); expect(() => transferredRequest(amg, query.From, query.Through)).toThrow()
  })
})
