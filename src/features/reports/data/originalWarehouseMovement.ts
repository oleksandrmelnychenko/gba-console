import { quantityScaled, type WarehouseQuantity } from './originalWarehouseQuantity'
import { isWarehouseMonetaryCatalogueEntry } from './originalWarehouseMonetary'
export { isWarehouseMonetaryCatalogueEntry as isWarehouseMovementCatalogueEntry }
export type MovementCapture = { ScopeSha256: string; ManifestSha256: string; From: string; Through: string; SourceStartedUtc: string; SourceCompletedUtc: string; ThroughDayComplete: boolean }
export type MovementPublication = { Capture: MovementCapture; Products: { Reference: string; Article: string; Name: string; Unit: string | null }[]; Warehouses: { Reference: string; Name: string }[] }
export type MovementCapability = { Version: 1; World: 'fenix'; Executable: true; MinimumFrom: '2025-01-01'; MaximumInclusiveDays: 366; MaximumWarehouses: 32; Rows: string[]; Measures: string[]; ExactSingleArticleRequired: true; CompleteOpeningAndJournalRequired: true; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type MovementRequest = { Version: 1; World: 'fenix'; From: string; Through: string; Article: string; Warehouses: string[] }
export type MovementRegistrar = { World: 'fenix'; RecorderType: string; RecorderReference: string; SourcePeriod: string; SourceLineNumbers: number[]; Quantity: WarehouseQuantity; Number: string | null; SourceDate: string | null; Caption: string | null; CaptionAvailable: boolean }
export type MovementWarehouse = { World: 'fenix'; SourceWarehouseReference: string; Article: string; SourceProductReference: string; Quantity: WarehouseQuantity; Registrars: MovementRegistrar[]; Caption: string | null; CaptionAvailable: boolean }
export type MovementResult = { Version: 1; Scope: Omit<MovementRequest, 'Version'>; Available: boolean; Code: string; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; ResultSha256: string | null; Rows: MovementWarehouse[]; Totals: WarehouseQuantity | null; Capture: MovementCapture | null; SourceParityVerified: false; OriginalFullTaskAccepted: false; UnitPolicy: string; ArticlePolicy: string; BalancePolicy: string; OrderingPolicy: string; MissingCaptionMappings: string[] }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/i.test(v) && v !== '0'.repeat(32)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v)
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '2025-01-01' && v < '3999-01-01' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
const utc = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(v) && Number.isFinite(Date.parse(v))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const stages = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
export function isMovementCapability(v: unknown): v is MovementCapability {
  return object(v) && v.Version === 1 && v.World === 'fenix' && v.Executable === true && v.MinimumFrom === '2025-01-01'
    && v.MaximumInclusiveDays === 366 && v.MaximumWarehouses === 32 && v.ExactSingleArticleRequired === true && v.CompleteOpeningAndJournalRequired === true
    && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false && same(v.Rows, ['SourceWarehouse', 'CurrentArticle', 'MovementRegistrar']) && same(v.Measures, stages)
}
export function isMovementCapture(v: unknown): v is MovementCapture {
  return object(v) && hash(v.ScopeSha256) && hash(v.ManifestSha256) && date(v.From) && date(v.Through) && v.From <= v.Through
    && utc(v.SourceStartedUtc) && utc(v.SourceCompletedUtc) && Date.parse(v.SourceStartedUtc) <= Date.parse(v.SourceCompletedUtc) && typeof v.ThroughDayComplete === 'boolean'
}
export function normalizeMovementPublications(value: unknown): MovementPublication[] {
  const v = normalizeMovementWire(value)
  const invalid = () => { throw new Error('Сервер не підтвердив опубліковані періоди руху товару.') }
  if (!Array.isArray(v)) return invalid()
  const keys = new Set<string>()
  for (const p of v) {
    if (!object(p) || !isMovementCapture(p.Capture) || keys.has(p.Capture.ManifestSha256) || !Array.isArray(p.Products) || !p.Products.length || !Array.isArray(p.Warehouses) || !p.Warehouses.length) return invalid()
    keys.add(p.Capture.ManifestSha256)
    const products = new Set<string>(), articles = new Set<string>(), warehouses = new Set<string>()
    for (const x of p.Products) {
      if (!object(x) || !ref(x.Reference) || !text(x.Article) || x.Article.length > 128 || x.Article.trim() !== x.Article || !text(x.Name) || !(x.Unit === null || typeof x.Unit === 'string') || products.has(x.Reference) || articles.has(x.Article)) return invalid()
      products.add(x.Reference); articles.add(x.Article)
    }
    for (const x of p.Warehouses) {
      if (!object(x) || !ref(x.Reference) || !text(x.Name) || warehouses.has(x.Reference)) return invalid()
      warehouses.add(x.Reference)
    }
  }
  return structuredClone(v) as MovementPublication[]
}
export function movementRequestError(request: MovementRequest, publication: MovementPublication): string | null {
  if (request.Version !== 1 || request.World !== 'fenix') return 'Непідтримуване джерело руху товару.'
  if (!date(request.From) || !date(request.Through) || request.From > request.Through || (Date.parse(request.Through) - Date.parse(request.From)) / 86400000 >= 366) return 'Оберіть період до 366 календарних днів, починаючи з 2025 року.'
  if (request.From < publication.Capture.From || request.Through > publication.Capture.Through) return 'Період виходить за межі опублікованих даних.'
  if (!publication.Products.some(p => p.Article === request.Article)) return 'Оберіть один товар з опублікованого періоду.'
  if (!request.Warehouses.length || request.Warehouses.length > 32 || new Set(request.Warehouses).size !== request.Warehouses.length || request.Warehouses.some(w => !publication.Warehouses.some(p => p.Reference === w))) return 'Оберіть від 1 до 32 складів з опублікованого періоду.'
  return null
}
function quantity(v: unknown): v is WarehouseQuantity {
  return object(v) && quantityScaled(v.Closing) === quantityScaled(v.Opening) + quantityScaled(v.Incoming) - quantityScaled(v.Outgoing)
}
function caption(v: Record<string, unknown>) { return (v.Caption === null || text(v.Caption)) && v.CaptionAvailable === (v.Caption !== null) }
function validRegistrar(v: unknown): v is MovementRegistrar {
  return object(v) && v.World === 'fenix' && typeof v.RecorderType === 'string' && /^[0-9A-F]{8}$/i.test(v.RecorderType) && ref(v.RecorderReference)
    && typeof v.SourcePeriod === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(v.SourcePeriod)
    && Array.isArray(v.SourceLineNumbers) && !!v.SourceLineNumbers.length && v.SourceLineNumbers.every(n => Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647)
    && new Set(v.SourceLineNumbers).size === v.SourceLineNumbers.length && quantity(v.Quantity) && caption(v)
    && (v.Number === null || typeof v.Number === 'string') && (v.SourceDate === null || text(v.SourceDate))
}
/** Scope, capture, exact decimal quantities and running states are checked before either display or export. */
export function normalizeMovementResult(value: unknown, request: MovementRequest, publication: MovementPublication): MovementResult {
  const v = normalizeMovementWire(value)
  const invalid = () => { throw new Error('Сервер не підтвердив повний узгоджений рух товару. Оновіть опублікований період і повторіть формування.') }
  if (!object(v) || v.Version !== 1 || !object(v.Scope) || v.Scope.World !== 'fenix' || v.Scope.From !== request.From || v.Scope.Through !== request.Through || v.Scope.Article !== request.Article
    || !same(v.Scope.Warehouses, [...request.Warehouses].sort()) || typeof v.Available !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || !text(v.Code) || !Array.isArray(v.Rows)
    || v.SourceParityVerified !== false || v.OriginalFullTaskAccepted !== false || v.UnitPolicy !== 'SingleSourceProductNativeStoredQuantityNoCoefficientConversion'
    || v.ArticlePolicy !== 'CurrentOURVendorCodeExactSingleSourceProduct' || v.BalancePolicy !== 'OpeningClosingAreStatesNotRegistrarSums' || v.OrderingPolicy !== 'SourcePeriod;DistinctRegistrarsAtSameTimeRefused'
    || !Array.isArray(v.MissingCaptionMappings) || v.MissingCaptionMappings.some(x => !['SourceWarehouse', 'MovementRegistrar'].includes(x))) return invalid()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null) return invalid()
    return structuredClone(v) as MovementResult
  }
  if (movementRequestError(request, publication) || !v.OurSnapshotVerified || v.Code !== 'original_warehouse_movement_OUR_complete' || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256)
    || !isMovementCapture(v.Capture) || !Object.keys(publication.Capture).every(key => v.Capture && (v.Capture as MovementCapture)[key as keyof MovementCapture] === publication.Capture[key as keyof MovementCapture]) || !quantity(v.Totals) || v.Rows.length !== request.Warehouses.length) return invalid()
  const product = publication.Products.find(p => p.Article === request.Article)
  if (!product) return invalid()
  const sourceProduct = product.Reference, selectedWarehouses = new Set(request.Warehouses)
  const seen = new Set<string>()
  let grains = 0
  for (const row of v.Rows) {
    if (!object(row) || row.World !== 'fenix' || !ref(row.SourceWarehouseReference) || !selectedWarehouses.has(row.SourceWarehouseReference) || seen.has(row.SourceWarehouseReference)
      || row.Article !== request.Article || row.SourceProductReference !== sourceProduct || !caption(row) || !quantity(row.Quantity) || !Array.isArray(row.Registrars)) return invalid()
    seen.add(row.SourceWarehouseReference)
    let balance = quantityScaled(row.Quantity.Opening), incoming = 0n, outgoing = 0n, previous = ''
    for (const child of row.Registrars) {
      if (!validRegistrar(child) || child.SourcePeriod <= previous || child.SourcePeriod.slice(0, 10) < request.From || child.SourcePeriod.slice(0, 10) > request.Through || quantityScaled(child.Quantity.Opening) !== balance || ++grains > 200_000) return invalid()
      previous = child.SourcePeriod; balance = quantityScaled(child.Quantity.Closing); incoming += quantityScaled(child.Quantity.Incoming); outgoing += quantityScaled(child.Quantity.Outgoing)
    }
    if (balance !== quantityScaled(row.Quantity.Closing) || incoming !== quantityScaled(row.Quantity.Incoming) || outgoing !== quantityScaled(row.Quantity.Outgoing)) return invalid()
  }
  const rows = v.Rows as MovementWarehouse[]
  if (!stages.every(key => quantityScaled((v.Totals as WarehouseQuantity)[key]) === rows.reduce((sum, row) => sum + quantityScaled(row.Quantity[key]), 0n))) return invalid()
  return structuredClone(v) as MovementResult
}
const asOfFormatter = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' })
export const movementAsOf = (capture: MovementCapture) => asOfFormatter.format(new Date(capture.SourceCompletedUtc))

/** Accept either API naming policy, while refusing conflicting duplicate aliases. Values remain opaque. */
export function normalizeMovementWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeMovementWire)
  if (!object(value)) return value
  const entries: [string, unknown][] = [], keys = new Set<string>()
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.charAt(0).toUpperCase() + key.slice(1)
    if (keys.has(normalized)) throw new Error('Сервер передав суперечливі поля руху товару.')
    keys.add(normalized); entries.push([normalized, normalizeMovementWire(item)])
  }
  return Object.fromEntries(entries)
}
