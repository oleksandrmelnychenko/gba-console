import { describe, expect, it } from 'vitest'
import { normalizeWarehouseQuantity, warehouseQuantityRequest, WAREHOUSE_QUANTITY_SOURCE, WAREHOUSE_QUANTITY_DEFINITION,
  type WarehouseQuantityCapability, type WarehouseQuantityRequest, type WarehouseQuantityResult } from './originalWarehouseQuantity'
import { normalizeWarehouseMonetary, warehouseMonetaryRequest, warehouseMonetaryDefaultMeasures, WAREHOUSE_MONETARY_SOURCE, WAREHOUSE_MONETARY_DEFINITION,
  type WarehouseMonetaryCapability, type WarehouseMonetaryRequest, type WarehouseMonetaryResult } from './originalWarehouseMonetary'
import { warehouseQuantityCsv, warehouseQuantityMatrix, warehouseQuantityPdfDefinition } from './originalWarehouseQuantityExport'
import { warehouseMonetaryCsv, warehouseMonetaryMatrix, warehouseMonetaryPdfDefinition } from './originalWarehouseMonetaryExport'
import { receiptCaptionPolicy, receiptChoiceScope, receiptChoiceValues, warehouseReceiptKey, type ReceiptCaptionContext } from './warehouseReceiptCaptions'
const product = 'A'.repeat(32), tuple = { Type: '08', Table: '00000115', Reference: 'B'.repeat(32) }
const q = { Opening: '-2.000', Incoming: '5.000', Outgoing: '-1.000', Closing: '4.000' }
const resources = { Quantity: q, Cost: { Opening: '-20.00', Incoming: '50.00', Outgoing: '-10.00', Closing: '40.00' },
  Vat: { Opening: '-4.00', Incoming: '10.00', Outgoing: '-2.00', Closing: '8.00' } }
const base = { Version: 1 as const, World: 'fenix' as const, Executable: true, Title: 'Відомість', PeriodRequired: true as const,
  MaximumInclusiveDays: 366 as const, RequiresCompleteNormalInputs: true as const, CurrentReceiptCaptionChoicesSupported: true as const,
  NativeVirtualTableVerified: false as const, SourceParityVerified: false as const, OriginalFullTaskAccepted: false as const }
const quantityCap: WarehouseQuantityCapability = { ...base, SourceId: WAREHOUSE_QUANTITY_SOURCE, DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION,
  ModuleSha256: '29bcf58a1951a39cbb6cda7195c7a2da100edb98a2b1b44e2406af5ed5876719', QuerySha256: 'ea18073fc8b3fe0f39652a077391038003f6f0617357d749ec9b4f89da479785' }
const moneyCap: WarehouseMonetaryCapability = { ...base, SourceId: WAREHOUSE_MONETARY_SOURCE, DefinitionSha256: WAREHOUSE_MONETARY_DEFINITION,
  ModuleSha256: 'e5b629dd087052bf882091c962cf994a8fea720146e501d5b3aa3640fabcdc4b', QuerySha256: 'e64d3dee516b4eae8c2065f1a89779a6bb35193e48e02661c955c6398355065c',
  MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption', ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false, DefaultMeasures: warehouseMonetaryDefaultMeasures }
const context = (): ReceiptCaptionContext => ({ Policy: receiptCaptionPolicy, NormalSourceGenerationBound: true, CompleteReceiptChoices: true,
  Code: 'original_warehouse_receipt_selected_scope_complete', Choices: [{ Receipt: { ...tuple }, Caption: 'Н-15 від 10.09.2026' }], WitnessSha256: 'c'.repeat(64),
  AllElevenReceiptKindsAvailable: false, HistoricalCaptionVerified: false, SourceParityVerified: false })
function scenario(money: boolean, enabled = true) {
  const query = money ? warehouseMonetaryRequest(moneyCap, '2026-09-01', '2026-09-30', [], [], enabled)
    : warehouseQuantityRequest(quantityCap, '2026-09-01', '2026-09-30', [], [], enabled)
  const common = { Version: 1, World: 'fenix', SourceId: query.SourceId, DefinitionSha256: query.DefinitionSha256, From: query.From, Through: query.Through,
    Available: true, Code: money ? 'original_warehouse_monetary_OUR_complete' : 'original_warehouse_quantity_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), ProductChoices: [{ Key: product, Caption: 'Товар' }], FilterSummary: [], MissingCaptionMappings: [],
    WarehouseFilterAvailable: false, ReceiptFilterAvailable: enabled, UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion',
    NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
  const captions = enabled ? { ReceiptCaptions: context() } : {}
  const child = { Receipt: { ...tuple }, Caption: enabled ? 'Н-15 від 10.09.2026' : 'Назва документа недоступна', CaptionAvailable: enabled }
  const value = (money ? { ...common, ...captions, MoneyUnitPolicy: moneyCap.MoneyUnitPolicy, ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false,
    Rows: [{ Product: product, Caption: 'Товар', CaptionAvailable: true, Resources: resources, Receipts: [{ ...child, Resources: resources }] }], Totals: resources }
    : { ...common, ...captions, Rows: [{ Product: product, Caption: 'Товар', CaptionAvailable: true, Quantity: q, Receipts: [{ ...child, Quantity: q }] }], Totals: q }) as WarehouseMonetaryResult | WarehouseQuantityResult
  const normalize = (v: unknown) => money ? normalizeWarehouseMonetary(v, query as WarehouseMonetaryRequest) : normalizeWarehouseQuantity(v, query as WarehouseQuantityRequest)
  return { query, value, normalize }
}
describe('same-generation current OUR captions on both original period deliveries', () => {
  it.each([false, true])('keeps the absent optional request and legacy result unchanged money=%s', money => {
    const { query, value, normalize } = scenario(money, false)
    expect(query).not.toHaveProperty('CurrentReceiptCaptionChoices'); expect(query.Receipts).toEqual([])
    expect(normalize(value)).toEqual(value)
    expect(() => normalize({ ...value, ReceiptCaptions: context() })).toThrow()
  })
  it.each([false, true])('exports the same known full-tuple caption and every signed resource money=%s', money => {
    const { value, normalize } = scenario(money), accepted = normalize(value)
    const matrix = money ? warehouseMonetaryMatrix(accepted as WarehouseMonetaryResult) : warehouseQuantityMatrix(accepted as WarehouseQuantityResult)
    const csv = money ? warehouseMonetaryCsv(accepted as WarehouseMonetaryResult) : warehouseQuantityCsv(accepted as WarehouseQuantityResult)
    const pdf = money ? warehouseMonetaryPdfDefinition(accepted as WarehouseMonetaryResult) : warehouseQuantityPdfDefinition(accepted as WarehouseQuantityResult)
    expect(accepted.Totals).toEqual(value.Totals); expect(matrix[2][1]).toBe('Н-15 від 10.09.2026')
    expect(csv).toContain('Н-15 від 10.09.2026'); expect(csv).not.toContain(tuple.Reference)
    expect(pdf.content.find(v => 'table' in v)?.table?.body).toEqual(matrix)
  })
  it.each([false, true])('retains uncovered kinds and all sums while disabling the incomplete chooser money=%s', money => {
    const { value, normalize } = scenario(money); const unknown = structuredClone(value.Rows[0].Receipts[0])
    unknown.Receipt.Table = '0000011C'; unknown.Caption = 'Назва документа недоступна'; unknown.CaptionAvailable = false
    if ('Resources' in unknown) unknown.Resources = { Quantity: { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' },
      Cost: { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }, Vat: { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' } }
    else unknown.Quantity = { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' }
    // Both result variants retain the same full tuple hierarchy.
    ;(value.Rows[0].Receipts as typeof unknown[]).push(unknown)
    value.ReceiptFilterAvailable = false; value.ReceiptCaptions!.CompleteReceiptChoices = false
    value.ReceiptCaptions!.Code = 'original_warehouse_receipt_selected_scope_incomplete'
    expect(normalize(value).Rows[0].Receipts).toHaveLength(2); expect(normalize(value).Totals).toEqual(value.Totals)
    expect(() => normalize({ ...value, ReceiptFilterAvailable: true })).toThrow()
  })
  it.each(['witness', 'complete', 'tuple', 'label', 'duplicate', 'historical', 'foreign-choice'])('refuses fabricated caption evidence %s', fault => {
    const { value, normalize } = scenario(false), c = value.ReceiptCaptions!
    if (fault === 'witness') c.WitnessSha256 = null
    if (fault === 'complete') c.CompleteReceiptChoices = false
    if (fault === 'tuple') c.Choices[0].Receipt.Table = '000000AF'
    if (fault === 'label') value.Rows[0].Receipts[0].Caption = 'Інший номер'
    if (fault === 'duplicate') c.Choices.push({ ...c.Choices[0], Receipt: { Reference: tuple.Reference, Table: tuple.Table, Type: tuple.Type } })
    if (fault === 'historical') Object.assign(c, { HistoricalCaptionVerified: true })
    if (fault === 'foreign-choice') c.Choices.push({ Receipt: { ...tuple, Reference: 'F'.repeat(32) }, Caption: 'Інший документ' })
    expect(() => normalize(value)).toThrow()
  })
  it('never gives old normal parents a caption or loses their resource rows', () => {
    const { value, normalize } = scenario(true); value.ReceiptFilterAvailable = false
    value.ReceiptCaptions = { ...context(), NormalSourceGenerationBound: false, CompleteReceiptChoices: false, WitnessSha256: null, Choices: [], Code: 'original_warehouse_receipt_normal_generation_crossbinding_unavailable' }
    value.Rows[0].Receipts[0].Caption = 'Назва документа недоступна'; value.Rows[0].Receipts[0].CaptionAvailable = false
    expect(normalize(value).Totals).toEqual(resources)
    expect(() => normalize({ ...value, ReceiptCaptions: context() })).toThrow()
  })
  it('copies explicit full-key filters and cannot submit an unadvertised caption mode', () => {
    const selected = [{ ...tuple }], query = warehouseQuantityRequest(quantityCap, '2026-09-01', '2026-09-30', [], [], true, selected)
    selected[0].Table = '000000AF'; expect(query.Receipts).toEqual([tuple])
    expect(() => warehouseQuantityRequest({ ...quantityCap, CurrentReceiptCaptionChoicesSupported: undefined }, query.From, query.Through, [], [], true)).toThrow()
    expect(() => warehouseQuantityRequest(quantityCap, query.From, query.Through, [], [], false, [tuple])).toThrow()
    expect(() => warehouseQuantityRequest(quantityCap, query.From, query.Through, [], [], true, [tuple, { Reference: tuple.Reference, Type: tuple.Type, Table: tuple.Table }])).toThrow()
  })
  it('scopes choices to period/product/warehouse and matches selections by all three components', () => {
    expect(receiptChoiceScope('period', ['A'], ['B'])).not.toBe(receiptChoiceScope('period', ['C'], ['B']))
    const c = context(), key = warehouseReceiptKey(tuple)
    expect(receiptChoiceValues([key], c)).toEqual([tuple])
    expect(() => receiptChoiceValues([warehouseReceiptKey({ ...tuple, Table: '000000AF' })], c)).toThrow()
    expect(() => receiptChoiceValues([key], { ...c, CompleteReceiptChoices: false })).toThrow()
  })
})
