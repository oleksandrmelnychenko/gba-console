import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeAmgDiscountVariant, normalizeAmgDiscountVariantList, validateAmgDiscountVariantSave, validateAmgDiscountVariantReference, type AmgDiscountVariant, type AmgDiscountVariantSave } from '../data/originalAmgDiscountAnalysisVariants'
const route = '/report/originals/amg/discount-analysis/variants'
export async function listAmgDiscountVariants(signal?: AbortSignal) { return normalizeAmgDiscountVariantList(await apiRequest<unknown>(route, { signal, dedupe: false })) }
export async function loadAmgDiscountVariant(variant: Pick<AmgDiscountVariant, 'Id' | 'Revision'>, signal?: AbortSignal) {
  const check = validateAmgDiscountVariantReference(variant)
  const loaded = normalizeAmgDiscountVariant(await apiRequest<unknown>(`${route}/${check.Id}/revisions/${check.Revision}`, { signal, dedupe: false }))
  if (loaded.Id !== variant.Id || loaded.Revision !== variant.Revision) throw new Error('Версія власного варіанта AMG змінилася. Оновіть список.')
  return loaded
}
export async function saveAmgDiscountVariant(request: AmgDiscountVariantSave, signal?: AbortSignal) {
  const scope = validateAmgDiscountVariantSave(request), saved = normalizeAmgDiscountVariant(await apiRequest<unknown>(`${route}/save`, { method: 'POST', body: scope, dedupe: false, signal }))
  if (saved.Revision !== scope.Revision + 1 || scope.Id !== null && saved.Id !== scope.Id || saved.Name !== scope.Name || JSON.stringify(saved.Scope) !== JSON.stringify(scope.Scope)) throw new Error('Сервер не підтвердив точний власний варіант AMG.')
  return saved
}
export async function deleteAmgDiscountVariant(variant: Pick<AmgDiscountVariant, 'Id' | 'Revision'>, signal?: AbortSignal) {
  const check = validateAmgDiscountVariantReference(variant)
  const result = await apiRequest<{ Deleted: boolean }>(`${route}/delete`, { method: 'POST', body: check, dedupe: false, signal })
  if (result?.Deleted !== true) throw new Error('Сервер не підтвердив видалення власного варіанта AMG.')
}
