import { describe, expect, it } from 'vitest'
import { capability, resources, response } from '../testing/transferredGoodsFixtures'
import { pointCapability, pointContext, pointResponse, pointReceipt, pointCaption, incompletePointContext } from '../testing/receiptPointFixtures'
import { isTransferredCapability, normalizeTransferred, transferredRequest, type TransferredRequest } from './originalTransferredGoods'
import { transferredCsv, transferredMatrix, transferredPdfDefinition, transferredXlsx } from './originalTransferredGoodsExport'
const query = (selected = false) => transferredRequest(pointCapability, '2026-09-01', '2026-09-30', [], selected ? [pointReceipt] : [], true)
describe('transferred goods optional own receipt captions', () => {
  it('keeps absent default wire and requires the exact Fenix capability for optional mode', () => {
    const old = transferredRequest(capability, '2026-09-01', '2026-09-30')
    expect(old).not.toHaveProperty('CurrentReceiptCaptionChoices'); expect(normalizeTransferred(response(), old)).toEqual(response())
    expect(query().CurrentReceiptCaptionChoices).toBe(true)
    expect(() => transferredRequest(capability, old.From, old.Through, [], [], true)).toThrow()
    const amg = { ...pointCapability, World: 'amg' as const, Executable: false, CurrentReceiptCaptionChoicesSupported: false }
    expect(isTransferredCapability(amg)).toBe(true); expect(isTransferredCapability({ ...amg, CurrentReceiptCaptionChoicesSupported: true })).toBe(false)
    expect(() => transferredRequest(amg, old.From, old.Through, [], [], true)).toThrow()
  })
  it('rejects false or foreign-world receipt modes and captions injected into a legacy result', () => {
    const wrong = { ...query(), CurrentReceiptCaptionChoices: false } as unknown as TransferredRequest
    expect(() => normalizeTransferred(pointResponse(), wrong)).toThrow()
    expect(() => normalizeTransferred(pointResponse(), { ...query(), World: 'amg' })).toThrow()
    expect(() => normalizeTransferred(pointResponse(), transferredRequest(capability, '2026-09-01', '2026-09-30'))).toThrow()
  })
  it('retains two equal references from different document kinds as distinct choices and resource groups', () => {
    const value = pointResponse(), other = structuredClone(value.Rows[0]); other.Receipt.Table = '000000AF'; other.Caption = 'Інший документ'
    const zero = { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' }, money = { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }
    other.Resources = { Quantity: zero, Cost: money, Vat: { ...money } }; other.Products[0].Resources = structuredClone(other.Resources); value.Rows.push(other)
    value.ReceiptCaptions!.Choices.push({ Receipt: other.Receipt, Caption: other.Caption }); value.ReceiptCaptions!.RequiredChoiceTupleCount = 2
    const accepted = normalizeTransferred(value, query()); expect(accepted.Rows).toHaveLength(2); expect(accepted.Totals).toEqual(resources)
    expect(transferredMatrix(accepted)[3][0]).toBe(other.Caption)
    other.Receipt = { Reference: pointReceipt.Reference, Table: pointReceipt.Table, Type: pointReceipt.Type }
    expect(() => normalizeTransferred(value, query())).toThrow()
  })
  it('refuses a forged caption and complete-choice flag while preserving incomplete numeric results', () => {
    const value = pointResponse(); value.ReceiptCaptions = incompletePointContext('transferred'); value.ReceiptFilterAvailable = false
    value.Rows[0].Caption = 'Назва документа недоступна'; value.Rows[0].CaptionAvailable = false
    expect(normalizeTransferred(value, query()).Totals).toEqual(resources)
    expect(() => normalizeTransferred({ ...value, ReceiptFilterAvailable: true }, query())).toThrow()
    const forged = pointResponse(); forged.Rows[0].Caption = 'Чужий номер'; expect(() => normalizeTransferred(forged, query())).toThrow()
    expect(() => normalizeTransferred({ ...pointResponse(), ReceiptCaptions: { ...pointContext(pointReceipt, 'transferred'), PointHeaderWitnessSha256: undefined } }, query())).toThrow()
  })
  it('validates receipt selection by full tuple and keeps the whole chooser independent of selected receipts', () => {
    const value = pointResponse(); value.ReceiptCaptions!.Choices.push({ Receipt: { ...pointReceipt, Table: '000000AF' }, Caption: 'Інший документ' })
    value.ReceiptCaptions!.RequiredChoiceTupleCount = 2
    expect(normalizeTransferred(value, query(true)).ReceiptCaptions?.Choices).toHaveLength(2)
    const wrong = transferredRequest(pointCapability, query().From, query().Through, [], [{ ...pointReceipt, Table: '000000AF' }], true)
    expect(() => normalizeTransferred(value, wrong)).toThrow()
  })
  it('exports the same admitted receipt label and twelve exact resources in CSV PDF and XLSX', async () => {
    const accepted = normalizeTransferred(pointResponse(), query()), matrix = transferredMatrix(accepted)
    expect(matrix[1][0]).toBe(pointCaption); expect(matrix[2].slice(2)).toEqual(transferredMatrix(response())[2].slice(2))
    expect(transferredCsv(accepted)).toContain(pointCaption); expect(transferredCsv(accepted)).not.toContain(pointReceipt.Reference)
    expect(transferredPdfDefinition(accepted).content.find(row => 'table' in row)?.table?.body).toEqual(matrix)
    const blob = await transferredXlsx(accepted), XLSX = await import('xlsx')
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob) })
    const book = XLSX.read(buffer, { type: 'array' }); expect(XLSX.utils.sheet_to_json(book.Sheets['Передані товари'], { header: 1, defval: '' })).toEqual(matrix)
  })
  it.each(['PointCurrentComplete', 'PointParentAuthenticationFailed'])('admits the genuine transferred incomplete wire code=%s without losing resources', PointReadCode => {
    const value = pointResponse(); value.ReceiptFilterAvailable = false
    value.ReceiptCaptions = { ...incompletePointContext('transferred'), PointReadCode,
      Code: `original_transferred_receipt_scope_incomplete:${PointReadCode}` }
    value.Rows[0].Caption = 'Назва документа недоступна'; value.Rows[0].CaptionAvailable = false
    expect(normalizeTransferred(value, query()).Totals).toEqual(resources)
    const Code = value.ReceiptCaptions.Code
    for (const wrong of ['original_transferred_receipt_scope_incomplete',
      'original_transferred_receipt_scope_incomplete:PointParentQueryTimeout',
      'original_transferred_receipt_scope_incomplete:InventedPointComplete', `${Code}:${PointReadCode}`]) {
      expect(() => normalizeTransferred({ ...value, ReceiptCaptions: { ...value.ReceiptCaptions, Code: wrong } }, query())).toThrow()
    }
  })
  it('admits only the unsuffixed transferred unbound code and rejects the warehouse family', () => {
    const value = pointResponse(); value.ReceiptFilterAvailable = false
    value.ReceiptCaptions = { ...incompletePointContext('transferred'), NormalSourceGenerationBound: false,
      WitnessSha256: null, Code: 'original_transferred_receipt_normal_generation_unavailable' }
    value.Rows[0].Caption = 'Назва документа недоступна'; value.Rows[0].CaptionAvailable = false
    expect(normalizeTransferred(value, query()).Totals).toEqual(resources)
    expect(() => normalizeTransferred({ ...value, ReceiptCaptions: { ...value.ReceiptCaptions,
      Code: `${value.ReceiptCaptions!.Code}:PointParentAuthenticationFailed` } }, query())).toThrow()
    expect(() => normalizeTransferred({ ...pointResponse(), ReceiptCaptions: pointContext() }, query())).toThrow()
    const unavailable = { ...value, Available: false, Code: 'original_transferred_normal_inputs_unavailable',
      NormalInputsComplete: false, OurSnapshotVerified: false, Rows: [], Totals: null, ProductChoices: [], InputWitnessSha256: null, ResultSha256: null,
      ReceiptCaptions: { ...value.ReceiptCaptions, RequiredChoiceTupleCount: 0 } }
    expect(normalizeTransferred(unavailable, query()).Available).toBe(false)
    expect(() => normalizeTransferred({ ...unavailable, ReceiptCaptions: { ...unavailable.ReceiptCaptions,
      Code: 'original_warehouse_receipt_normal_generation_crossbinding_unavailable:PointParentAuthenticationFailed' } }, query())).toThrow()
  })
})
