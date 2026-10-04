import { receiptCaptionPolicy, pointReceiptCaptionPolicy, type ReceiptCaptionContext, type WarehouseReceiptKey } from '../data/warehouseReceiptCaptions'
import { capability, response } from './transferredGoodsFixtures'
import type { TransferredResult } from '../data/originalTransferredGoods'
export const pointReceipt: WarehouseReceiptKey = { Type: '08', Table: '0000011C', Reference: 'C'.repeat(32) }
export const pointCaption = 'Н-27 від 10.09.2026'
export const pointCapability = { ...capability, CurrentReceiptCaptionChoicesSupported: true }
export function pointContext(receipt: WarehouseReceiptKey = pointReceipt): ReceiptCaptionContext {
  return { Policy: pointReceiptCaptionPolicy, NormalSourceGenerationBound: true, CompleteReceiptChoices: true,
    SelectedReceiptScopeComplete: true, RequiredChoiceTupleCount: 1, Code: 'original_warehouse_receipt_selected_scope_complete',
    Choices: [{ Receipt: { ...receipt }, Caption: pointCaption }], WitnessSha256: 'c'.repeat(64),
    PointReadCode: 'PointCurrentComplete', PointHeaderWitnessSha256: 'd'.repeat(64),
    AllElevenReceiptKindsAvailable: false, HistoricalCaptionVerified: false, SourceParityVerified: false }
}
export function pointResponse(): TransferredResult {
  const result = response(); result.Rows[0].Receipt = { ...pointReceipt }; result.Rows[0].Caption = pointCaption
  result.Rows[0].CaptionAvailable = true; result.ReceiptFilterAvailable = true; result.ReceiptCaptions = pointContext()
  result.MissingCaptionMappings = []; return result
}
export function emptyPointResponse(): TransferredResult {
  const result = pointResponse()
  const zero = { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' }, money = { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }
  result.Rows = []; result.Totals = { Quantity: zero, Cost: { ...money }, Vat: { ...money } }; result.ProductChoices = []
  result.ReceiptFilterAvailable = false; result.ReceiptCaptions = { ...pointContext(), SelectedReceiptScopeComplete: false, RequiredChoiceTupleCount: 0, Choices: [] }
  return result
}
export function incompletePointContext(): ReceiptCaptionContext {
  return { Policy: receiptCaptionPolicy, NormalSourceGenerationBound: true, CompleteReceiptChoices: false,
    SelectedReceiptScopeComplete: false, RequiredChoiceTupleCount: 1, Code: 'original_warehouse_receipt_selected_scope_incomplete',
    Choices: [], WitnessSha256: 'c'.repeat(64), PointReadCode: 'PointParentAuthenticationFailed',
    AllElevenReceiptKindsAvailable: false, HistoricalCaptionVerified: false, SourceParityVerified: false }
}
