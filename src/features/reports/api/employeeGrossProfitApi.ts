import { apiRequest } from '../../../shared/api/apiClient'
import { createEmployeeGrossProfitRequest, isEmployeeGrossProfitCapabilities, normalizeEmployeeGrossProfitReport,
  type EmployeeGrossProfitCapabilities, type EmployeeGrossProfitReport } from '../data/employeeGrossProfit'
const route = '/report/constructors/employee-gross-profit'
export async function getEmployeeGrossProfitCapabilities(signal?: AbortSignal): Promise<EmployeeGrossProfitCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal, dedupe: false })
  if (!isEmployeeGrossProfitCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
export async function previewEmployeeGrossProfit(capability: EmployeeGrossProfitCapabilities, month: string, signal?: AbortSignal): Promise<EmployeeGrossProfitReport> {
  const request = createEmployeeGrossProfitRequest(capability, month)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeEmployeeGrossProfitReport(value, request)
}
