import { apiRequest } from '../../../shared/api/apiClient'

export type AttributedDocument = {
  sale_id: number; sale_net_uid: string; client_id: number; number: string; document_date: string
  date_basis: 'native_invoice_kyiv' | 'imported_lineage_kyiv' | 'stored_sale_date_unverified'
  shipment_date: string | null; order_id: number; offer_net_uid: string | null
  document_currency: string | null; canceled: boolean; merged: boolean; is_invoice: boolean; retained_lines: number
  payments: { allocation_id: number; payment_id: number; document_date: string; source_currency: string | null; currency: 'EUR'; amount: number; canceled: boolean }[]
  returns: { return_id: number; return_item_id: number; document_date: string; quantity: number; credit_processed: boolean; recorded_return_credit_eur: number | null; canceled: boolean }[]
}
export type AttributionLink = {
  sale_net_uid: string; task_key: string; client_id: number; manager_id: number; manager_name: string
  linked_at: string; contact_event_id: string | null; contact_manager_id: number | null; policy: string
  evidence: { state: 'confirmed' | 'canceled' | 'draft' | 'merged_requires_review' | 'source_unavailable'; document: AttributedDocument | null
    allocated_payment_eur: number | null; recorded_return_credit_eur: number | null; return_credit_coverage_complete: boolean }
}
export type AttributionPage<T> = { offset: number; limit: number; count: number; total: number; rows: T[]; is_head?: boolean }
function page<T>(data: AttributionPage<T>, offset: number) {
  if (!data || data.offset !== offset || data.limit !== 20 || !Number.isInteger(data.total) || data.total < 0
    || !Array.isArray(data.rows) || data.count !== data.rows.length || data.count !== Math.min(20, Math.max(0, data.total - offset))) {
    throw new Error('Не вдалося перевірити відповідь сервісу документальних результатів')
  }
  return data
}
export async function getAttributionCandidates(taskKey: string, offset: number, signal?: AbortSignal) {
  return page(await apiRequest<AttributionPage<AttributedDocument>>('/sales/cockpit/attribution/candidates', { query: { taskKey, offset, limit: 20 }, signal }), offset)
}
export async function getAttributionLinks(taskKey: string, head: boolean, offset: number, signal?: AbortSignal) {
  return page(await apiRequest<AttributionPage<AttributionLink>>(`/sales/cockpit/${head ? 'head/' : ''}attribution/links`, { query: { taskKey, offset, limit: 20 }, signal }), offset)
}
export async function linkAttribution(taskKey: string, saleNetUid: string, contactEventId: string | null) {
  await apiRequest('/sales/cockpit/attribution/links', { method: 'POST', body: { TaskKey: taskKey, SaleNetUid: saleNetUid, ContactEventId: contactEventId } })
}
