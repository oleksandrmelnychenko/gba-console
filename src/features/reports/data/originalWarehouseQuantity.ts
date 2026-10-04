import { receiptCaptionRequest, validReceiptCaptions, type ReceiptCaptionContext } from './warehouseReceiptCaptions'
import type { ReportCatalogueEntry } from '../types'

export const WAREHOUSE_QUANTITY_SOURCE = 'dd98a3b9-e627-4a83-9f66-2dfe7686085c'
export const WAREHOUSE_QUANTITY_DEFINITION = '153684a1f269ab7a4dc4231a7a8490558af609cade30d06fa4c2f36457075a4b'
const moduleHash = '29bcf58a1951a39cbb6cda7195c7a2da100edb98a2b1b44e2406af5ed5876719'
const queryHash = 'ea18073fc8b3fe0f39652a077391038003f6f0617357d749ec9b4f89da479785'
export type WarehouseQuantityCapability = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string;
  ModuleSha256: string; QuerySha256: string; Executable: boolean; Title: string; PeriodRequired: true;
  MaximumInclusiveDays: 366; RequiresCompleteNormalInputs: true; CurrentWarehouseCaptionChoicesSupported?: true; CurrentReceiptCaptionChoicesSupported?: true; NativeVirtualTableVerified: false;
  SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type WarehouseReceipt = { Type: string; Table: string; Reference: string }
export type WarehouseQuantity = { Opening: string; Incoming: string; Outgoing: string; Closing: string }
export type WarehouseQuantityRequest = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string;
  From: string; Through: string; Warehouses: string[]; Products: string[]; Receipts: WarehouseReceipt[]; CurrentWarehouseCaptionChoices?: true; CurrentReceiptCaptionChoices?: true }
export type WarehouseQuantityResult = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string;
  From: string; Through: string; Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean;
  InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: Array<{ Product: string; Caption: string; CaptionAvailable: boolean; Quantity: WarehouseQuantity;
    Receipts: Array<{ Receipt: WarehouseReceipt; Caption: string; CaptionAvailable: boolean; Quantity: WarehouseQuantity }> }>;
  Totals: WarehouseQuantity | null; ProductChoices: Array<{ Key: string; Caption: string }>; MissingCaptionMappings: string[]; FilterSummary: string[];
  WarehouseChoices?: Array<{ Key: string; Caption: string }>; WarehouseCaptionPolicy?: 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation';
  WarehouseCaptionWitnessSha256?: string; WarehouseFilterAvailable: boolean; ReceiptFilterAvailable: boolean; ReceiptCaptions?: ReceiptCaptionContext; UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion';
  NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const ref = (v: unknown) => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg')
  && v.SourceId === WAREHOUSE_QUANTITY_SOURCE && v.DefinitionSha256 === WAREHOUSE_QUANTITY_DEFINITION
  && v.NativeVirtualTableVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isWarehouseQuantityCapability(v: unknown): v is WarehouseQuantityCapability {
  return object(v) && identity(v) && v.ModuleSha256 === moduleHash && v.QuerySha256 === queryHash
    && v.Executable === (v.World === 'fenix') && typeof v.Title === 'string' && v.Title.trim().length > 0
    && v.PeriodRequired === true && v.MaximumInclusiveDays === 366 && v.RequiresCompleteNormalInputs === true
    && (v.CurrentWarehouseCaptionChoicesSupported === undefined || v.CurrentWarehouseCaptionChoicesSupported === true && v.World === 'fenix')
    && (v.CurrentReceiptCaptionChoicesSupported === undefined || v.CurrentReceiptCaptionChoicesSupported === true && v.World === 'fenix')
}
export function isWarehouseQuantityCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[] = ['fenix']) {
  return report.Id === 'builtin:ВедомостьПартииТоваровНаСкладахКоличественныйУчет'
    && worlds.includes('fenix') && report.Sources.some(s => s.World === 'fenix' && s.SourceId === WAREHOUSE_QUANTITY_SOURCE)
}
const date = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '0001-01-02' || v >= '3999-01-01') return null
  const ms = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? ms : null
}
export function warehouseQuantityPeriodError(from: string, through: string): string | null {
  const first = date(from), last = date(through)
  return first === null || last === null || first > last || (last - first) / 86_400_000 >= 366
    ? 'Оберіть явний період до 366 календарних днів.' : null
}
export function warehouseQuantityRequest(capability: WarehouseQuantityCapability, from: string, through: string,
  products: readonly string[] = [], warehouses: readonly string[] = [], currentReceiptCaptions = false, receipts: readonly WarehouseReceipt[] = []): WarehouseQuantityRequest {
  if (!isWarehouseQuantityCapability(capability) || !capability.Executable || warehouseQuantityPeriodError(from, through)
    || products.length > 256 || products.some(p => !ref(p)) || new Set(products).size !== products.length
    || warehouses.length > 256 || warehouses.some(w => !ref(w) || w === '0'.repeat(32)) || new Set(warehouses).size !== warehouses.length
    || warehouses.length > 0 && !capability.CurrentWarehouseCaptionChoicesSupported) throw new Error('Некоректний запит відомості партій.')
  return { Version: 1, World: capability.World, SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256,
    From: from, Through: through, Products: [...products], Warehouses: [...warehouses],
    ...receiptCaptionRequest(capability.CurrentReceiptCaptionChoicesSupported === true && capability.World === 'fenix', currentReceiptCaptions, receipts),
    ...(capability.CurrentWarehouseCaptionChoicesSupported ? { CurrentWarehouseCaptionChoices: true as const } : {}) }
}
export function quantityScaled(v: unknown): bigint {
  if (typeof v !== 'string' || v.length > 100 || !/^-?(0|[1-9]\d*)\.\d{3}$/.test(v) || v === '-0.000') throw new Error('Некоректна кількість відомості.')
  return BigInt(v.replace('.', ''))
}
const quantity = (v: unknown): v is WarehouseQuantity => object(v)
  && quantityScaled(v.Closing) === quantityScaled(v.Opening) + quantityScaled(v.Incoming) - quantityScaled(v.Outgoing)
const receipt = (v: unknown): v is WarehouseReceipt => object(v) && typeof v.Type === 'string' && /^[0-9A-F]{2}$/.test(v.Type)
  && typeof v.Table === 'string' && /^[0-9A-F]{8}$/.test(v.Table) && ref(v.Reference)
const sameTotal = (total: WarehouseQuantity, parts: WarehouseQuantity[]) => (['Opening', 'Incoming', 'Outgoing', 'Closing'] as const)
  .every(key => quantityScaled(total[key]) === parts.reduce((sum, part) => sum + quantityScaled(part[key]), 0n))
/** A partial response, foreign identity or inconsistent hierarchy can never be shown or exported. */
export function normalizeWarehouseQuantity(v: unknown, request: WarehouseQuantityRequest): WarehouseQuantityResult {
  const invalid = () => { throw new Error('Сервер не підтвердив повний результат відомості партій.') }
  if (!object(v) || !identity(v) || v.World !== request.World || v.From !== request.From || v.Through !== request.Through
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
    return structuredClone(v) as WarehouseQuantityResult
  }
  if (request.World !== 'fenix' || !v.NormalInputsComplete || !v.OurSnapshotVerified || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256)
    || v.Code !== 'original_warehouse_quantity_OUR_complete' || !quantity(v.Totals) || v.Rows.length > 200_000) return invalid()
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
      || typeof row.CaptionAvailable !== 'boolean' || !quantity(row.Quantity) || !Array.isArray(row.Receipts) || !row.Receipts.length
      || selectedProducts.size > 0 && !selectedProducts.has(row.Product as string)) return invalid()
    products.add(row.Product as string); const receipts = new Set<string>(); const parts: WarehouseQuantity[] = []
    for (const child of row.Receipts) {
      if (!object(child) || !receipt(child.Receipt)) return invalid()
      const receiptKey = JSON.stringify([child.Receipt.Type, child.Receipt.Table, child.Receipt.Reference])
      if (receipts.has(receiptKey) || typeof child.Caption !== 'string'
        || !child.Caption.trim() || (request.CurrentReceiptCaptionChoices ? typeof child.CaptionAvailable !== 'boolean' : child.CaptionAvailable !== false) || !quantity(child.Quantity)) return invalid()
      receipts.add(receiptKey); parts.push(child.Quantity); if (++grains > 200_000) return invalid()
    }
    if (!sameTotal(row.Quantity, parts)) return invalid()
  }
  if (!sameTotal(v.Totals, v.Rows.map(row => row.Quantity))) return invalid()
  const choices = new Set<string>()
  for (const option of v.ProductChoices) {
    if (!object(option) || !ref(option.Key) || choices.has(option.Key as string) || typeof option.Caption !== 'string' || !option.Caption.trim()) return invalid()
    choices.add(option.Key as string)
  }
  if (!validReceiptCaptions(v.ReceiptCaptions, v.ReceiptFilterAvailable, !!request.CurrentReceiptCaptionChoices, true,
    (v as unknown as WarehouseQuantityResult).Rows, request.Receipts)) return invalid()
  return structuredClone(v) as WarehouseQuantityResult
}
