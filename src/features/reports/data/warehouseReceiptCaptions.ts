export type WarehouseReceiptKey = { Type: string; Table: string; Reference: string }
export const receiptCaptionPolicy = 'CurrentOURAuthenticatedInboundHeaderSameNormalSourceGeneration'
export type ReceiptCaptionContext = { Policy: typeof receiptCaptionPolicy; NormalSourceGenerationBound: boolean;
  CompleteReceiptChoices: boolean; SelectedReceiptScopeComplete: boolean; RequiredChoiceTupleCount: number; Code: string; Choices: Array<{ Receipt: WarehouseReceiptKey; Caption: string }>;
  WitnessSha256: string | null; AllElevenReceiptKindsAvailable: false; HistoricalCaptionVerified: false; SourceParityVerified: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
export const isWarehouseReceiptKey = (v: unknown): v is WarehouseReceiptKey => object(v)
  && typeof v.Type === 'string' && /^[0-9A-F]{2}$/.test(v.Type) && typeof v.Table === 'string' && /^[0-9A-F]{8}$/.test(v.Table)
  && typeof v.Reference === 'string' && /^[0-9A-F]{32}$/.test(v.Reference)
export const warehouseReceiptKey = (v: WarehouseReceiptKey) => JSON.stringify([v.Type, v.Table, v.Reference])
export function receiptCaptionRequest(supported: boolean, enabled: boolean, receipts: readonly WarehouseReceiptKey[]) {
  if (enabled && !supported || !enabled && receipts.length || receipts.length > 256 || receipts.some(v => !isWarehouseReceiptKey(v))
    || new Set(receipts.map(warehouseReceiptKey)).size !== receipts.length) throw new Error('Некоректний відбір документів надходження.')
  return enabled ? { CurrentReceiptCaptionChoices: true as const, Receipts: receipts.map(v => ({ ...v })) } : { Receipts: [] }
}
type CaptionChild = { Receipt: WarehouseReceiptKey; Caption: string; CaptionAvailable: boolean }
/** Validate current-OUR display evidence separately from quantities/money; equality always uses all three key components. */
export function validReceiptCaptions(value: unknown, filterAvailable: unknown, enabled: boolean,
  available: boolean, rows: Array<{ Receipts: CaptionChild[] }>, selected: readonly WarehouseReceiptKey[]): boolean {
  if (!enabled) return value === undefined && filterAvailable === false
  if (!object(value) || value.Policy !== receiptCaptionPolicy || typeof value.NormalSourceGenerationBound !== 'boolean'
    || typeof value.CompleteReceiptChoices !== 'boolean' || typeof value.SelectedReceiptScopeComplete !== 'boolean'
    || !Number.isSafeInteger(value.RequiredChoiceTupleCount) || (value.RequiredChoiceTupleCount as number) < 0
    || (value.RequiredChoiceTupleCount as number) > 200_000 || !Array.isArray(value.Choices) || value.Choices.length > 200_256
    || value.AllElevenReceiptKindsAvailable !== false || value.HistoricalCaptionVerified !== false || value.SourceParityVerified !== false) return false
  const bound = value.NormalSourceGenerationBound, complete = value.CompleteReceiptChoices
  if (value.Code !== (!bound ? 'original_warehouse_receipt_normal_generation_crossbinding_unavailable'
    : complete ? 'original_warehouse_receipt_selected_scope_complete' : 'original_warehouse_receipt_selected_scope_incomplete')
    || bound && (!available || !hash(value.WitnessSha256)) || !bound && (complete || value.WitnessSha256 !== null || value.Choices.length)
    || filterAvailable !== (bound && complete && value.Choices.length > 0)) return false
  const names = new Map<string, string>()
  for (const choice of value.Choices) {
    if (!object(choice) || !isWarehouseReceiptKey(choice.Receipt) || choice.Receipt.Type !== '08'
      || !['000000AF', '000000F2', '00000115'].includes(choice.Receipt.Table) || choice.Receipt.Reference === '0'.repeat(32)
      || typeof choice.Caption !== 'string' || !choice.Caption.trim() || names.has(warehouseReceiptKey(choice.Receipt))) return false
    names.set(warehouseReceiptKey(choice.Receipt), choice.Caption)
  }
  const required = new Set(selected.map(warehouseReceiptKey)), requested = new Set(selected.map(warehouseReceiptKey))
  for (const row of rows) for (const child of row.Receipts) {
    const key = warehouseReceiptKey(child.Receipt); required.add(key)
    if (requested.size && !requested.has(key) || child.CaptionAvailable !== names.has(key)
      || child.CaptionAvailable && child.Caption !== names.get(key)) return false
  }
  if (names.size > (value.RequiredChoiceTupleCount as number) || selected.length === 0
    && ((value.RequiredChoiceTupleCount as number) !== required.size || [...names.keys()].some(key => !required.has(key)))) return false
  return complete === (bound && names.size === value.RequiredChoiceTupleCount)
    && value.SelectedReceiptScopeComplete === (bound && [...required].every(key => names.has(key)))
}
/** A scope change invalidates document choices, independently of the receipt selection itself. */
export const receiptChoiceScope = (period: string, products: readonly string[], warehouses: readonly string[]) => JSON.stringify([period, products, warehouses])
export function receiptChoiceValues(values: readonly string[], context: ReceiptCaptionContext | undefined): WarehouseReceiptKey[] {
  if (!context?.NormalSourceGenerationBound || !context.CompleteReceiptChoices) {
    if (values.length) throw new Error('Повний відбір документів надходження не підтверджено.')
    return []
  }
  const choices = new Map(context.Choices.map(v => [warehouseReceiptKey(v.Receipt), v.Receipt]))
  return values.map(value => { const key = choices.get(value); if (!key) throw new Error('Документ не належить підтвердженому відбору.'); return { ...key } })
}
export function receiptCaptionNote(context: ReceiptCaptionContext | undefined): string {
  if (!context) return 'Назви документів недоступні; відповідність 1С не підтверджена.'
  if (!context.NormalSourceGenerationBound) return 'Підписи документів недоступні до синхронізації узгодженої версії джерела. Усі рядки й суми збережено.'
  if (!context.SelectedReceiptScopeComplete) return 'Поточні підписи вибраних документів неповні. Змініть відбір; усі наявні рядки й суми збережено.'
  return context.CompleteReceiptChoices
    ? 'Підписи — поточні дані документів GBA для цього відбору. Історична відповідність 1С не підтверджена.'
    : 'Показано підтверджені поточні підписи GBA; для решти документів підписи недоступні. Повний відбір документів вимкнений; усі рядки й суми збережено.'
}
