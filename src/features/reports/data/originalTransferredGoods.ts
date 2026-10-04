import { validReceiptCaptions, warehouseReceiptKey, type ReceiptCaptionContext } from './warehouseReceiptCaptions'
import type { ReportCatalogueEntry } from '../types'
import { warehouseMonetaryScaled } from './originalWarehouseMonetary'
export const TRANSFERRED_GOODS_SOURCE = '7e2c1a1d-c205-4ade-a42b-9a1a5fce2c17'
export const TRANSFERRED_GOODS_DEFINITION = 'e4999dd622ee36bb6c0b347deb63d04f998a5907b7e9855695d0d8fa214c356f'
const moduleHash = '0d93fdd553d70b94fdf53d6477dc792c3ddd40b8fea9d9b2a26d13f90a1696e9'
const queryHash = 'a3b945d8ffe18a56468a8c27229a4c9ce8750f93e8cdc4d539f3e0c59747cfe2'
export const transferredGoodsMeasures = ['КоличествоНачальныйОстаток', 'СтоимостьНачальныйОстаток', 'НДСНачальныйОстаток',
  'КоличествоПриход', 'СтоимостьПриход', 'НДСПриход', 'КоличествоРасход', 'СтоимостьРасход', 'НДСРасход',
  'КоличествоКонечныйОстаток', 'СтоимостьКонечныйОстаток', 'НДСКонечныйОстаток']
export type TransferredReceipt = { Type: string; Table: string; Reference: string }
export type TransferredMeasure = { Opening: string; Incoming: string; Outgoing: string; Closing: string }
export type TransferredResources = { Quantity: TransferredMeasure; Cost: TransferredMeasure; Vat: TransferredMeasure }
export type TransferredCapability = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; ModuleSha256: string;
  QuerySha256: string; Executable: boolean; Title: string; PeriodRequired: true; MaximumInclusiveDays: 366; RequiresCompleteNormalInputs: true;
  DefaultRows: string[]; DefaultFilterFields: string[]; DefaultMeasures: string[]; UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion';
  MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption'; ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false;
  ReceiptFilterChoicesSupported: false; CurrentReceiptCaptionChoicesSupported?: boolean; NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type TransferredRequest = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Products: string[]; Receipts: TransferredReceipt[]; CurrentReceiptCaptionChoices?: true }
export type TransferredResult = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: Array<{ Receipt: TransferredReceipt; Caption: string; CaptionAvailable: boolean; Resources: TransferredResources;
    Products: Array<{ Product: string; Caption: string; CaptionAvailable: boolean; Resources: TransferredResources }> }>;
  Totals: TransferredResources | null; ProductChoices: Array<{ Key: string; Caption: string }>; MissingCaptionMappings: string[]; FilterSummary: string[];
  UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion'; MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption';
  ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false; ReceiptFilterAvailable: boolean; ReceiptCaptions?: ReceiptCaptionContext;
  NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const ref = (v: unknown) => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const receipt = (v: unknown): v is TransferredReceipt => object(v) && typeof v.Type === 'string' && /^[0-9A-F]{2}$/.test(v.Type)
  && typeof v.Table === 'string' && /^[0-9A-F]{8}$/.test(v.Table) && ref(v.Reference)
const tuple = warehouseReceiptKey
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg')
  && v.SourceId === TRANSFERRED_GOODS_SOURCE && v.DefinitionSha256 === TRANSFERRED_GOODS_DEFINITION
  && v.UnitPolicy === 'NativeStoredQuantityNoCoefficientConversion' && v.MoneyUnitPolicy === 'NativeManagementResourceNoCurrencyIdentityAssumption'
  && v.ManagementCurrencyPresentationVerified === false && v.AppliesFxConversion === false
  && v.NativeVirtualTableVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
const listEquals = (v: unknown, expected: string[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])
export function isTransferredCapability(v: unknown): v is TransferredCapability {
  return object(v) && identity(v) && v.ModuleSha256 === moduleHash && v.QuerySha256 === queryHash && v.Executable === (v.World === 'fenix')
    && typeof v.Title === 'string' && v.Title.trim().length > 0 && v.PeriodRequired === true && v.MaximumInclusiveDays === 366
    && v.RequiresCompleteNormalInputs === true && v.ReceiptFilterChoicesSupported === false
    && (v.CurrentReceiptCaptionChoicesSupported === undefined || v.CurrentReceiptCaptionChoicesSupported === (v.World === 'fenix'))
    && listEquals(v.DefaultRows, ['ДокументОприходования', 'Номенклатура'])
    && listEquals(v.DefaultFilterFields, ['Номенклатура', 'ДокументОприходования']) && listEquals(v.DefaultMeasures, transferredGoodsMeasures)
}
export function isTransferredCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[] = ['fenix']) {
  return report.Id === 'builtin:ВедомостьПартииТоваровПереданных' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === TRANSFERRED_GOODS_SOURCE)
}
const date = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '0001-02-01' || v >= '3999-01-01') return null
  const ms = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? ms : null
}
export function transferredPeriodError(from: string, through: string): string | null {
  const a = date(from), b = date(through)
  return a === null || b === null || a > b || (b - a) / 86_400_000 >= 366 ? 'Оберіть явний період до 366 календарних днів.' : null
}
export function transferredRequest(capability: TransferredCapability, from: string, through: string,
  products: readonly string[] = [], receipts: readonly TransferredReceipt[] = [], currentReceiptCaptions = false): TransferredRequest {
  if (!isTransferredCapability(capability) || !capability.Executable || transferredPeriodError(from, through)
    || typeof currentReceiptCaptions !== 'boolean' || currentReceiptCaptions && (capability.World !== 'fenix' || capability.CurrentReceiptCaptionChoicesSupported !== true)
    || products.length > 256 || products.some(p => !ref(p)) || new Set(products).size !== products.length
    || receipts.length > 256 || receipts.some(r => !receipt(r)) || new Set(receipts.map(tuple)).size !== receipts.length)
    throw new Error('Некоректний запит відомості переданих товарів.')
  return { Version: 1, World: capability.World, SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256,
    From: from, Through: through, Products: [...products], Receipts: receipts.map(r => ({ ...r })),
    ...(currentReceiptCaptions ? { CurrentReceiptCaptionChoices: true as const } : {}) }
}
const measure = (v: unknown, scale: 2 | 3): v is TransferredMeasure => object(v)
  && warehouseMonetaryScaled(v.Closing, scale) === warehouseMonetaryScaled(v.Opening, scale)
    + warehouseMonetaryScaled(v.Incoming, scale) - warehouseMonetaryScaled(v.Outgoing, scale)
const resources = (v: unknown): v is TransferredResources => object(v) && measure(v.Quantity, 3) && measure(v.Cost, 2) && measure(v.Vat, 2)
const keys = ['Quantity', 'Cost', 'Vat'] as const, stages = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
const totalEquals = (total: TransferredResources, parts: TransferredResources[]) => keys.every(resource => stages.every(stage =>
  warehouseMonetaryScaled(total[resource][stage], resource === 'Quantity' ? 3 : 2)
    === parts.reduce((sum, p) => sum + warehouseMonetaryScaled(p[resource][stage], resource === 'Quantity' ? 3 : 2), 0n)))
/** The exact Receipt -> Product hierarchy is verified before screen or export receives it. */
export function normalizeTransferred(v: unknown, request: TransferredRequest): TransferredResult {
  const invalid = () => { throw new Error('Сервер не підтвердив повний результат переданих товарів.') }
  if (request.CurrentReceiptCaptionChoices !== undefined && request.CurrentReceiptCaptionChoices !== true
    || request.CurrentReceiptCaptionChoices === true && request.World !== 'fenix' || request.Version !== 1 || request.SourceId !== TRANSFERRED_GOODS_SOURCE || request.DefinitionSha256 !== TRANSFERRED_GOODS_DEFINITION
    || !object(v) || !identity(v) || v.World !== request.World || v.From !== request.From || v.Through !== request.Through
    || typeof v.Available !== 'boolean' || typeof v.NormalInputsComplete !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || typeof v.Code !== 'string' || !v.Code.startsWith('original_transferred_') || !Array.isArray(v.Rows) || !Array.isArray(v.ProductChoices)
    || !Array.isArray(v.MissingCaptionMappings) || v.MissingCaptionMappings.some(s => typeof s !== 'string')
    || !Array.isArray(v.FilterSummary) || v.FilterSummary.some(s => typeof s !== 'string')) return invalid()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.ProductChoices.length || v.InputWitnessSha256 !== null || v.ResultSha256 !== null) return invalid()
    if (!validReceiptCaptions(v.ReceiptCaptions, v.ReceiptFilterAvailable, !!request.CurrentReceiptCaptionChoices, false, [], request.Receipts)) return invalid()
    return structuredClone(v) as TransferredResult
  }
  if (v.World !== 'fenix' || !v.NormalInputsComplete || !v.OurSnapshotVerified || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256)
    || v.Code !== 'original_transferred_OUR_complete' || !resources(v.Totals) || v.Rows.length > 200_000) return invalid()
  const receipts = new Set<string>(), productsFilter = new Set(request.Products), receiptFilter = new Set(request.Receipts.map(tuple))
  let groups = 0
  for (const row of v.Rows) {
    if (!object(row) || !receipt(row.Receipt) || typeof row.Caption !== 'string' || !row.Caption.trim() || (request.CurrentReceiptCaptionChoices ? typeof row.CaptionAvailable !== 'boolean' : row.CaptionAvailable !== false)
      || !resources(row.Resources) || !Array.isArray(row.Products) || !row.Products.length) return invalid()
    const key = tuple(row.Receipt)
    if (receipts.has(key) || receiptFilter.size > 0 && !receiptFilter.has(key)) return invalid()
    receipts.add(key); const products = new Set<string>(), parts: TransferredResources[] = []
    for (const child of row.Products) {
      if (!object(child) || !ref(child.Product) || products.has(child.Product as string) || typeof child.Caption !== 'string' || !child.Caption.trim()
        || typeof child.CaptionAvailable !== 'boolean' || !resources(child.Resources)
        || productsFilter.size > 0 && !productsFilter.has(child.Product as string)) return invalid()
      products.add(child.Product as string); parts.push(child.Resources); if (++groups > 200_000) return invalid()
    }
    if (!totalEquals(row.Resources, parts)) return invalid()
  }
  if (!totalEquals(v.Totals, v.Rows.map(row => row.Resources))) return invalid()
  const choices = new Set<string>()
  for (const choice of v.ProductChoices) {
    if (!object(choice) || !ref(choice.Key) || choices.has(choice.Key as string) || typeof choice.Caption !== 'string' || !choice.Caption.trim()) return invalid()
    choices.add(choice.Key as string)
  }
  if (!validReceiptCaptions(v.ReceiptCaptions, v.ReceiptFilterAvailable, !!request.CurrentReceiptCaptionChoices, true,
    v.Rows.map(row => ({ Receipts: [row] })), request.Receipts)) return invalid()
  return structuredClone(v) as TransferredResult
}
