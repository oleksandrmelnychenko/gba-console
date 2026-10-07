import { describe, expect, it } from 'vitest'
import { pointContext, pointReceipt, pointCaption, incompletePointContext } from '../testing/receiptPointFixtures'
import { receiptCaptionPolicy, validReceiptCaptions, receiptChoiceValues, warehouseReceiptKey } from './warehouseReceiptCaptions'
const tables = ['000000A2', '000000AF', '000000DB', '000000F2', '000000F9', '000000FA', '00000104', '00000113', '00000115', '00000116', '0000011C']
function rows(receipt = pointReceipt) { return [{ Receipts: [{ Receipt: receipt, Caption: pointCaption, CaptionAvailable: true }] }] }
describe('connected own inbound and point receipt caption evidence', () => {
  it.each(tables)('accepts exact authenticated document tuple table=%s without asserting all-kind parity', Table => {
    const key = { ...pointReceipt, Table }, context = pointContext(key)
    expect(validReceiptCaptions(context, true, true, true, rows(key), [])).toBe(true)
    expect(context.AllElevenReceiptKindsAvailable).toBe(false)
    expect(validReceiptCaptions({ ...context, Policy: receiptCaptionPolicy, PointReadCode: undefined, PointHeaderWitnessSha256: undefined }, true, true, true, rows(key), [])).toBe(true)
  })
  it.each(['unbound', 'missing-code', 'failure-code', 'unknown-code', 'null-code', 'missing-point-witness', 'malformed-point-witness', 'inbound-with-point-witness', 'parity', 'foreign-type', 'foreign-table'])('refuses a fabricated combined context %s', fault => {
    const context = pointContext()
    if (fault === 'unbound') context.NormalSourceGenerationBound = false
    if (fault === 'missing-code') delete context.PointReadCode
    if (fault === 'failure-code') context.PointReadCode = 'PointParentQueryTimeout'
    if (fault === 'unknown-code') context.PointReadCode = 'InventedPointComplete'
    if (fault === 'null-code') Object.assign(context, { PointReadCode: null })
    if (fault === 'missing-point-witness') delete context.PointHeaderWitnessSha256
    if (fault === 'malformed-point-witness') context.PointHeaderWitnessSha256 = 'D'.repeat(64)
    if (fault === 'inbound-with-point-witness') context.Policy = receiptCaptionPolicy
    if (fault === 'parity') Object.assign(context, { SourceParityVerified: true })
    if (fault === 'foreign-type') context.Choices[0].Receipt.Type = '09'
    if (fault === 'foreign-table') context.Choices[0].Receipt.Table = '00000117'
    expect(validReceiptCaptions(context, true, true, true, rows(), [])).toBe(false)
  })
  it('keeps inbound-only policy when point has no contributing facts or cannot authenticate', () => {
    for (const code of ['PointCurrentComplete', 'PointParentAuthenticationFailed', 'PointQueryTimeout']) {
      const context = { ...pointContext(), Policy: receiptCaptionPolicy, PointReadCode: code, PointHeaderWitnessSha256: undefined }
      expect(validReceiptCaptions(context, true, true, true, rows(), [])).toBe(true)
    }
  })
  it('removes prior selected full keys with incomplete choices but never adds an unproven alternative', () => {
    const other = { ...pointReceipt, Table: '000000AF' }, selected = [pointReceipt, other], context = incompletePointContext()
    expect(receiptChoiceValues([warehouseReceiptKey(other)], context, selected)).toEqual([other])
    expect(receiptChoiceValues([], context, selected)).toEqual([])
    expect(() => receiptChoiceValues([warehouseReceiptKey({ ...other, Table: '000000F2' })], context, selected)).toThrow()
    expect(() => receiptChoiceValues([warehouseReceiptKey(other), warehouseReceiptKey(other)], context, selected)).toThrow()
    expect(receiptChoiceValues([warehouseReceiptKey(pointReceipt)], undefined, selected)).toEqual([pointReceipt])
  })
  it('admits the genuine warehouse failure suffix for bound and unbound incomplete scopes', () => {
    const missingRows = [{ Receipts: [{ Receipt: pointReceipt, Caption: 'Назва документа недоступна', CaptionAvailable: false }] }]
    for (const bound of [true, false]) {
      const context = { ...incompletePointContext(), NormalSourceGenerationBound: bound, WitnessSha256: bound ? 'c'.repeat(64) : null,
        Code: `${bound ? 'original_warehouse_receipt_selected_scope_incomplete' : 'original_warehouse_receipt_normal_generation_crossbinding_unavailable'}:PointParentAuthenticationFailed` }
      expect(validReceiptCaptions(context, false, true, true, missingRows, [])).toBe(true)
    }
  })
  it('keeps missing warehouse labels unsuffixed after a successful point read', () => {
    const context = { ...incompletePointContext(), PointReadCode: 'PointCurrentComplete', Code: 'original_warehouse_receipt_selected_scope_incomplete' }
    const missingRows = [{ Receipts: [{ Receipt: pointReceipt, Caption: 'Назва документа недоступна', CaptionAvailable: false }] }]
    expect(validReceiptCaptions(context, false, true, true, missingRows, [])).toBe(true)
    expect(validReceiptCaptions({ ...context, Code: `${context.Code}:PointCurrentComplete` }, false, true, true, missingRows, [])).toBe(false)
  })
  it('rejects foreign receipt code families and missing mismatched or extra warehouse suffixes', () => {
    expect(validReceiptCaptions(pointContext(pointReceipt, 'transferred'), true, true, true, rows(), [])).toBe(false)
    const context = incompletePointContext(), missingRows = [{ Receipts: [{ Receipt: pointReceipt, Caption: 'Назва документа недоступна', CaptionAvailable: false }] }]
    for (const Code of ['original_warehouse_receipt_selected_scope_incomplete',
      'original_warehouse_receipt_selected_scope_incomplete:PointParentQueryTimeout',
      'original_warehouse_receipt_selected_scope_incomplete:InventedPointComplete', `${context.Code}:PointParentAuthenticationFailed`]) {
      expect(validReceiptCaptions({ ...context, Code }, false, true, true, missingRows, [])).toBe(false)
    }
  })
})
