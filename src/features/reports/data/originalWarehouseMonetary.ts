import { receiptCaptionRequest, validReceiptCaptions, type ReceiptCaptionContext } from './warehouseReceiptCaptions'
import type { ReportCatalogueEntry } from '../types'

export const WAREHOUSE_MONETARY_SOURCE = 'fde97241-e736-4c21-9e61-2d6ecafa0b91'
export const WAREHOUSE_MONETARY_DEFINITION = 'e663d555a5b3e625c83ee8c0d308764df0d1c4c448e82f1d5cfdbb11277a18f6'
const moduleHash = 'e5b629dd087052bf882091c962cf994a8fea720146e501d5b3aa3640fabcdc4b'
const queryHash = 'e64d3dee516b4eae8c2065f1a89779a6bb35193e48e02661c955c6398355065c'
export type WarehouseMonetaryCapability = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string;
  ModuleSha256: string; QuerySha256: string; Executable: boolean; Title: string; PeriodRequired: true;
  MaximumInclusiveDays: 366; RequiresCompleteNormalInputs: true; CurrentWarehouseCaptionChoicesSupported?: true; CurrentReceiptCaptionChoicesSupported?: true; NativeVirtualTableVerified: false;
  SourceParityVerified: false; OriginalFullTaskAccepted: false; MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption';
  ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false; DefaultMeasures: string[] }
export type WarehouseReceipt = { Type: string; Table: string; Reference: string }
export type WarehouseMonetaryMeasure = { Opening: string; Incoming: string; Outgoing: string; Closing: string }
export type WarehouseMonetaryResources = { Quantity: WarehouseMonetaryMeasure; Cost: WarehouseMonetaryMeasure; Vat: WarehouseMonetaryMeasure }
export type WarehouseMonetaryRequest = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string;
  From: string; Through: string; Warehouses: string[]; Products: string[]; Receipts: WarehouseReceipt[]; CurrentWarehouseCaptionChoices?: true; CurrentReceiptCaptionChoices?: true }
export type WarehouseMonetaryResult = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string;
  From: string; Through: string; Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean;
  InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: Array<{ Product: string; Caption: string; CaptionAvailable: boolean; Resources: WarehouseMonetaryResources;
    Receipts: Array<{ Receipt: WarehouseReceipt; Caption: string; CaptionAvailable: boolean; Resources: WarehouseMonetaryResources }> }>;
  Totals: WarehouseMonetaryResources | null; ProductChoices: Array<{ Key: string; Caption: string }>; MissingCaptionMappings: string[]; FilterSummary: string[];
  WarehouseChoices?: Array<{ Key: string; Caption: string }>; WarehouseCaptionPolicy?: 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation';
  WarehouseCaptionWitnessSha256?: string; WarehouseFilterAvailable: boolean; ReceiptFilterAvailable: boolean; ReceiptCaptions?: ReceiptCaptionContext; UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion';
  NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false;
  MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption'; ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const ref = (v: unknown) => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
export const warehouseMonetaryDefaultMeasures = ['КоличествоНачальныйОстаток', 'СтоимостьНачальныйОстаток', 'НДСНачальныйОстаток',
  'КоличествоПриход', 'СтоимостьПриход', 'НДСПриход', 'КоличествоРасход', 'СтоимостьРасход', 'НДСРасход',
  'КоличествоКонечныйОстаток', 'СтоимостьКонечныйОстаток', 'НДСКонечныйОстаток']
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg')
  && v.SourceId === WAREHOUSE_MONETARY_SOURCE && v.DefinitionSha256 === WAREHOUSE_MONETARY_DEFINITION
  && v.MoneyUnitPolicy === 'NativeManagementResourceNoCurrencyIdentityAssumption' && v.ManagementCurrencyPresentationVerified === false && v.AppliesFxConversion === false
  && v.NativeVirtualTableVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isWarehouseMonetaryCapability(v: unknown): v is WarehouseMonetaryCapability {
  return object(v) && identity(v) && Array.isArray(v.DefaultMeasures) && v.DefaultMeasures.length === 12
    && v.DefaultMeasures.every((name, i) => name === warehouseMonetaryDefaultMeasures[i]) && v.ModuleSha256 === moduleHash && v.QuerySha256 === queryHash
    && v.Executable === (v.World === 'fenix') && typeof v.Title === 'string' && v.Title.trim().length > 0
    && v.PeriodRequired === true && v.MaximumInclusiveDays === 366 && v.RequiresCompleteNormalInputs === true
    && (v.CurrentWarehouseCaptionChoicesSupported === undefined || v.CurrentWarehouseCaptionChoicesSupported === true && v.World === 'fenix')
    && (v.CurrentReceiptCaptionChoicesSupported === undefined || v.CurrentReceiptCaptionChoicesSupported === true && v.World === 'fenix')
}
export function isWarehouseMonetaryCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[] = ['fenix']) {
  return report.Id === 'builtin:ВедомостьПартииТоваровНаСкладах'
    && worlds.includes('fenix') && report.Sources.some(s => s.World === 'fenix' && s.SourceId === WAREHOUSE_MONETARY_SOURCE)
}
const date = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '0001-01-02' || v >= '3999-01-01') return null
  const ms = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? ms : null
}
export function warehouseMonetaryPeriodError(from: string, through: string): string | null {
  const first = date(from), last = date(through)
  return first === null || last === null || first > last || (last - first) / 86_400_000 >= 366
    ? 'Оберіть явний період до 366 календарних днів.' : null
}
export function warehouseMonetaryRequest(capability: WarehouseMonetaryCapability, from: string, through: string,
  products: readonly string[] = [], warehouses: readonly string[] = [], currentReceiptCaptions = false, receipts: readonly WarehouseReceipt[] = []): WarehouseMonetaryRequest {
  if (!isWarehouseMonetaryCapability(capability) || !capability.Executable || warehouseMonetaryPeriodError(from, through)
    || products.length > 256 || products.some(p => !ref(p)) || new Set(products).size !== products.length
    || warehouses.length > 256 || warehouses.some(w => !ref(w) || w === '0'.repeat(32)) || new Set(warehouses).size !== warehouses.length
    || warehouses.length > 0 && !capability.CurrentWarehouseCaptionChoicesSupported) throw new Error('Некоректний запит відомості партій.')
  return { Version: 1, World: capability.World, SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256,
    From: from, Through: through, Products: [...products], Warehouses: [...warehouses],
    ...receiptCaptionRequest(capability.CurrentReceiptCaptionChoicesSupported === true && capability.World === 'fenix', currentReceiptCaptions, receipts),
    ...(capability.CurrentWarehouseCaptionChoicesSupported ? { CurrentWarehouseCaptionChoices: true as const } : {}) }
}
export function warehouseMonetaryScaled(v: unknown, scale: 2 | 3): bigint {
  const pattern = scale === 3 ? /^-?(0|[1-9]\d*)\.\d{3}$/ : /^-?(0|[1-9]\d*)\.\d{2}$/
  if (typeof v !== 'string' || v.length > 100 || !pattern.test(v) || v === (scale === 3 ? '-0.000' : '-0.00'))
    throw new Error('Некоректний ресурс відомості партій.')
  return BigInt(v.replace('.', ''))
}
const measure = (v: unknown, scale: 2 | 3): v is WarehouseMonetaryMeasure => object(v)
  && warehouseMonetaryScaled(v.Closing, scale) === warehouseMonetaryScaled(v.Opening, scale)
    + warehouseMonetaryScaled(v.Incoming, scale) - warehouseMonetaryScaled(v.Outgoing, scale)
const resources = (v: unknown): v is WarehouseMonetaryResources => object(v)
  && measure(v.Quantity, 3) && measure(v.Cost, 2) && measure(v.Vat, 2)
const receipt = (v: unknown): v is WarehouseReceipt => object(v) && typeof v.Type === 'string' && /^[0-9A-F]{2}$/.test(v.Type)
  && typeof v.Table === 'string' && /^[0-9A-F]{8}$/.test(v.Table) && ref(v.Reference)
const resourceKeys = ['Quantity', 'Cost', 'Vat'] as const
const stageKeys = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
const sameTotal = (total: WarehouseMonetaryResources, parts: WarehouseMonetaryResources[]) => resourceKeys.every(resource =>
  stageKeys.every(key => warehouseMonetaryScaled(total[resource][key], resource === 'Quantity' ? 3 : 2)
    === parts.reduce((sum, part) => sum + warehouseMonetaryScaled(part[resource][key], resource === 'Quantity' ? 3 : 2), 0n)))
/** A partial response, foreign identity or inconsistent hierarchy can never be shown or exported. */
export function normalizeWarehouseMonetary(v: unknown, request: WarehouseMonetaryRequest): WarehouseMonetaryResult {
  const invalid = () => { throw new Error('Сервер не підтвердив повний результат відомості партій.') }
  if (request.Version !== 1 || request.SourceId !== WAREHOUSE_MONETARY_SOURCE || request.DefinitionSha256 !== WAREHOUSE_MONETARY_DEFINITION
    || !object(v) || !identity(v) || v.World !== request.World || v.From !== request.From || v.Through !== request.Through
    || typeof v.Available !== 'boolean' || typeof v.NormalInputsComplete !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || typeof v.Code !== 'string' || !v.Code.startsWith('original_warehouse_') || !Array.isArray(v.Rows) || !Array.isArray(v.ProductChoices)
    || !Array.isArray(v.FilterSummary) || v.FilterSummary.some(s => typeof s !== 'string')
    || !Array.isArray(v.MissingCaptionMappings) || v.MissingCaptionMappings.some(s => typeof s !== 'string')
    || typeof v.WarehouseFilterAvailable !== 'boolean' || typeof v.ReceiptFilterAvailable !== 'boolean' || v.UnitPolicy !== 'NativeStoredQuantityNoCoefficientConversion') return invalid()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.ProductChoices.length || v.InputWitnessSha256 !== null || v.ResultSha256 !== null
      || v.WarehouseFilterAvailable || v.WarehouseChoices !== undefined && (!Array.isArray(v.WarehouseChoices) || v.WarehouseChoices.length)
      || v.WarehouseCaptionPolicy !== undefined || v.WarehouseCaptionWitnessSha256 !== undefined) return invalid()
    if (!validReceiptCaptions(v.ReceiptCaptions, v.ReceiptFilterAvailable, !!request.CurrentReceiptCaptionChoices, false, [], request.Receipts)) return invalid()
    return structuredClone(v) as WarehouseMonetaryResult
  }
  if (request.World !== 'fenix' || !v.NormalInputsComplete || !v.OurSnapshotVerified || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256)
    || v.Code !== 'original_warehouse_monetary_OUR_complete' || !resources(v.Totals) || v.Rows.length > 200_000) return invalid()
  if (request.CurrentWarehouseCaptionChoices) {
    if (v.WarehouseCaptionPolicy !== 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation' || !Array.isArray(v.WarehouseChoices)
      || v.WarehouseFilterAvailable !== (v.WarehouseChoices.length > 0)
      || v.WarehouseCaptionWitnessSha256 !== undefined && !hash(v.WarehouseCaptionWitnessSha256)
      || v.WarehouseChoices.length > 0 && !hash(v.WarehouseCaptionWitnessSha256)) return invalid()
    const warehouses = new Set<string>()
    for (const option of v.WarehouseChoices) {
      if (!object(option) || !ref(option.Key) || option.Key === '0'.repeat(32) || warehouses.has(option.Key as string)
        || typeof option.Caption !== 'string' || !option.Caption.trim()) return invalid()
      warehouses.add(option.Key as string)
    }
    if (request.Warehouses.some(w => !warehouses.has(w))) return invalid()
  } else if (v.WarehouseFilterAvailable || v.WarehouseChoices !== undefined && (!Array.isArray(v.WarehouseChoices) || v.WarehouseChoices.length)
    || v.WarehouseCaptionPolicy !== undefined || v.WarehouseCaptionWitnessSha256 !== undefined) return invalid()
  const selectedProducts = new Set(request.Products)
  const products = new Set<string>(); let grains = 0
  for (const row of v.Rows) {
    if (!object(row) || !ref(row.Product) || products.has(row.Product as string) || typeof row.Caption !== 'string' || !row.Caption.trim()
      || typeof row.CaptionAvailable !== 'boolean' || !resources(row.Resources) || !Array.isArray(row.Receipts) || !row.Receipts.length
      || selectedProducts.size > 0 && !selectedProducts.has(row.Product as string)) return invalid()
    products.add(row.Product as string); const receipts = new Set<string>(); const parts: WarehouseMonetaryResources[] = []
    for (const child of row.Receipts) {
      if (!object(child) || !receipt(child.Receipt)) return invalid()
      const receiptKey = JSON.stringify([child.Receipt.Type, child.Receipt.Table, child.Receipt.Reference])
      if (receipts.has(receiptKey) || typeof child.Caption !== 'string'
        || !child.Caption.trim() || (request.CurrentReceiptCaptionChoices ? typeof child.CaptionAvailable !== 'boolean' : child.CaptionAvailable !== false) || !resources(child.Resources)) return invalid()
      receipts.add(receiptKey); parts.push(child.Resources); if (++grains > 200_000) return invalid()
    }
    if (!sameTotal(row.Resources, parts)) return invalid()
  }
  if (!sameTotal(v.Totals, v.Rows.map(row => row.Resources))) return invalid()
  const choices = new Set<string>()
  for (const option of v.ProductChoices) {
    if (!object(option) || !ref(option.Key) || choices.has(option.Key as string) || typeof option.Caption !== 'string' || !option.Caption.trim()) return invalid()
    choices.add(option.Key as string)
  }
  if (!validReceiptCaptions(v.ReceiptCaptions, v.ReceiptFilterAvailable, !!request.CurrentReceiptCaptionChoices, true,
    (v as unknown as WarehouseMonetaryResult).Rows, request.Receipts)) return invalid()
  return structuredClone(v) as WarehouseMonetaryResult
}
