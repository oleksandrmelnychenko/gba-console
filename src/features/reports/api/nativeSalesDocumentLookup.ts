import { revenueExactId } from '../data/revenueComparison'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportEntity, ReportSearchParams, ReportSelectedValue } from '../types'
import { customerGroupSalesDocumentLookup } from '../data/salesDocumentLookupCapability'

export const usesSalesDocumentLookup = (source: number, field: number, dataset?: ReportDataset | null) =>
  [12, 14].includes(field) && (source === 2 || source === 44 && !!customerGroupSalesDocumentLookup(dataset))
/** A missing source44 capability must never fall through to the legacy document picker. */
export function salesDocumentLookupPolicy(source: number, field: number, dataset: ReportDataset | null | undefined,
  unavailable: boolean | undefined, from: string, to: string) {
  const native = usesSalesDocumentLookup(source, field, dataset)
  const customerDocument = source === 44 && (field === 12 || field === 14)
  const period = native || source === 35 && field === 12 ? [from, to] : []
  return { native, unavailable: unavailable || customerDocument && !native, legacyAllowed: !customerDocument, period }
}
export function salesDocumentId(value: unknown): string | null {
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value
  return typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n ? id : null
}
export function salesDocumentSelectedEntity(value: ReportSelectedValue, field: number): ReportEntity {
  const raw: unknown = value.Data
  // Legacy saved DTOs can retain Data as JSON text; derive a display key only, never rewrite the payload.
  const id = typeof raw === 'string' && raw.length > 65536 ? null : revenueExactId(raw)
  return id ? { Id: id, Name: value.Name, salesDocumentKind: field === 14 ? 'return' : 'sale' } : value.Data
}
export function salesDocumentKey(entity: ReportEntity): string | null {
  const id = salesDocumentId(entity.Id)
  return id && (entity.salesDocumentKind === 'sale' || entity.salesDocumentKind === 'return') ? `${entity.salesDocumentKind}:${id}` : null
}
function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '1900-01-01' || day > '9998-12-31') return false
  const stamp=Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10) === day
}
/** Field12 means the parent sale (also on returned lines); field14 means the own return. */
export async function searchNativeSalesDocuments(field: number, from: string, to: string,
  params: ReportSearchParams, signal?: AbortSignal): Promise<ReportEntity[]> {
  if (!usesSalesDocumentLookup(2,field) || !validDay(from) || !validDay(to) || from > to
    || params.value.length > 120
    || !Number.isInteger(params.offset) || params.offset < 0 || params.offset > 10000
    || !Number.isInteger(params.limit) || params.limit < 1 || params.limit > 50)
    throw new Error('Оберіть тип документа й коректний період.')
  const query=params.value.trim(), exact=query.startsWith('id:') ? salesDocumentId(query.slice(3)) : null
  if (query.startsWith('id:') && !exact) throw new Error('Некоректний точний ідентифікатор документа.')
  const result=await apiRequest<unknown>('/report/datasets/sales/documents/lookup', {
    query:{field,from,to,value:query,offset:params.offset,limit:params.limit},signal,
  })
  const kind=field===14?'return':'sale', seen=new Set<string>()
  if (!Array.isArray(result) || result.length>params.limit) throw new Error('Некоректний список документів.')
  return result.map(item=> {
    const id=salesDocumentId(item?.Id)
    if (!id || typeof item.Id!=='string' || item.Kind!==kind || typeof item.Name!=='string' || !item.Name.trim()
      || seen.has(id) || exact && id!==exact
      || item.OriginalSaleId!=null && (kind!=='return' || typeof item.OriginalSaleId!=='string' || !salesDocumentId(item.OriginalSaleId)
        || typeof item.OriginalSaleName!=='string' || !item.OriginalSaleName.trim())
      || item.OriginalSaleId==null && item.OriginalSaleName!=null)
      throw new Error('Сервер повернув некоректні або неоднозначні документи.')
    seen.add(id)
    return {Id:id,Name:item.Name,salesDocumentKind:kind,OriginalSaleId:item.OriginalSaleId,OriginalSaleName:item.OriginalSaleName}
  })
}
