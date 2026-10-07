import { amgDiscountAnalysisIdentity, validateAmgDiscountAnalysisRequest, type AmgDiscountAnalysisRequest } from './originalAmgDiscountAnalysis'
import { selectedAmgDiscountAnalysisRequest, type AmgDiscountAnalysisChoices } from './originalAmgDiscountAnalysisChoices'
export type AmgDiscountVariantScope = { Request: AmgDiscountAnalysisRequest; Rows: ['Контрагент']; Columns: ['Номенклатура']; Measures: ['ТипЦен', 'ПроцентСкидкиНаценки'] }
export type AmgDiscountVariant = { Id: string; Revision: number; Name: string; UpdatedAtUtc: string; VariantSha256: string; Scope: AmgDiscountVariantScope; RequiresFreshChoices: true }
export type AmgDiscountVariantList = { StorageAvailable: boolean; Dependency: string | null; Items: AmgDiscountVariant[] }
export type AmgDiscountVariantSave = { Id: string | null; Revision: number; Name: string; Scope: AmgDiscountVariantScope }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) && /[1-9a-f]/.test(v)
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v) && /[1-9a-f]/.test(v)
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 1 && Number(v) <= 2147483647
const name = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.trim() === v && v.length <= 120 && !/[\p{Cc}]/u.test(v)
const fail = () => new Error('Не вдалося підтвердити власний збережений варіант AMG. Оновіть список і повторіть дію.')
export function validateAmgDiscountVariantReference(value: Pick<AmgDiscountVariant, 'Id' | 'Revision'>) {
  if (!id(value.Id) || !revision(value.Revision)) throw fail()
  return { Id: value.Id, Revision: value.Revision }
}
export function amgDiscountVariantScope(request: AmgDiscountAnalysisRequest): AmgDiscountVariantScope {
  const scope = validateAmgDiscountAnalysisRequest(request); delete scope.ChoicesWitnessSha256
  return { Request: scope, Rows: ['Контрагент'], Columns: ['Номенклатура'], Measures: ['ТипЦен', 'ПроцентСкидкиНаценки'] }
}
function scope(value: unknown): AmgDiscountVariantScope {
  if (!record(value) || !record(value.Request) || value.Request.ChoicesWitnessSha256 != null || !same(value.Rows, ['Контрагент'])
    || !same(value.Columns, ['Номенклатура']) || !same(value.Measures, ['ТипЦен', 'ПроцентСкидкиНаценки'])) throw fail()
  return amgDiscountVariantScope(validateAmgDiscountAnalysisRequest(value.Request))
}
export function validateAmgDiscountVariantSave(value: AmgDiscountVariantSave): AmgDiscountVariantSave {
  if (!(value.Id === null || id(value.Id)) || !Number.isSafeInteger(value.Revision) || value.Revision < 0 || value.Revision >= 2147483647
    || value.Revision > 0 && value.Id === null || !name(value.Name.trim())) throw fail()
  return { Id: value.Id, Revision: value.Revision, Name: value.Name.trim(), Scope: scope(value.Scope) }
}
export function normalizeAmgDiscountVariant(value: unknown): AmgDiscountVariant {
  if (!record(value) || !id(value.Id) || !revision(value.Revision) || !name(value.Name) || !digest(value.VariantSha256) || value.RequiresFreshChoices !== true
    || typeof value.UpdatedAtUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value.UpdatedAtUtc) || !Number.isFinite(Date.parse(value.UpdatedAtUtc))) throw fail()
  return { Id: value.Id, Revision: value.Revision, Name: value.Name, UpdatedAtUtc: value.UpdatedAtUtc, VariantSha256: value.VariantSha256, Scope: scope(value.Scope), RequiresFreshChoices: true }
}
export function normalizeAmgDiscountVariantList(value: unknown): AmgDiscountVariantList {
  if (!record(value) || typeof value.StorageAvailable !== 'boolean' || !Array.isArray(value.Items) || value.Items.length > 200
    || (value.StorageAvailable ? value.Dependency !== null : value.Dependency !== 'original_amg_discount_variant_storage_unavailable' || value.Items.length !== 0)) throw fail()
  const items = value.Items.map(normalizeAmgDiscountVariant)
  if (new Set(items.map(v => v.Id)).size !== items.length) throw fail()
  return { StorageAvailable: value.StorageAvailable, Dependency: value.Dependency as string | null, Items: items }
}
export function restoreAmgDiscountVariantSelection(saved: AmgDiscountVariantScope, names: AmgDiscountAnalysisChoices | null) {
  try {
    const request = scope(saved).Request, selection = { Контрагент: [...request.Counterparties], Номенклатура: [...request.Products] }
    if (!names || names.Through !== request.Through || !same(names.RequestedCounterparties, request.Counterparties) || !same(names.RequestedProducts, request.Products)) return null
    const restored = selectedAmgDiscountAnalysisRequest(request.Through, selection, names)
    if (!Object.entries(amgDiscountAnalysisIdentity).every(([key, value]) => restored[key as keyof typeof amgDiscountAnalysisIdentity] === value)) return null
    return selection
  } catch { return null }
}
