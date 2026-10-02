import { apiRequest } from '../../../shared/api/apiClient'
import { createSupplierDebtRequest, isSupplierDebtCapabilities, normalizeSupplierDebtReport,
  type SupplierDebtCapabilities, type SupplierDebtReport } from '../data/supplierDebt'
const route = '/report/constructors/supplier-debt'
export async function getSupplierDebtCapabilities(signal?: AbortSignal): Promise<SupplierDebtCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal, dedupe: false })
  if (!isSupplierDebtCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
export async function previewSupplierDebt(capability: SupplierDebtCapabilities, month: string, signal?: AbortSignal): Promise<SupplierDebtReport> {
  const request = createSupplierDebtRequest(capability, month)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeSupplierDebtReport(value, request)
}
