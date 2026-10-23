import { movementSelection } from '../data/currentVparivanieMovements'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportRequestBody } from '../types'
import { currentVparivanieConfigurationError } from '../data/currentVparivanie'
import { currentVparivanieRegionalAvailable, normalizeCurrentVparivanieRegional,
  type CurrentVparivanieRegionalResult } from '../data/currentVparivanieRegional'

export async function readCurrentVparivanieRegional(dataset: ReportDataset, request: ReportRequestBody,
  signal?: AbortSignal): Promise<CurrentVparivanieRegionalResult> {
  if (!currentVparivanieRegionalAvailable(dataset)) throw new Error('Сервер ще не підтримує регіональну форму «Аналіз залишків і продажів».')
  const rejected = currentVparivanieConfigurationError(request, dataset)
  if (request.dataSource !== 39 || rejected) throw new Error(rejected ?? 'Оберіть поточне «Аналіз залишків і продажів».')
  if (movementSelection(request)) throw new Error('Прихід і розхід доступні у звичайній формі звіту. Для регіональної форми вимкніть ці показники.')
  const captured = structuredClone(request)
  const result = await apiRequest<unknown>('/report/datasets/39/current-regional', {
    method: 'POST', body: captured, signal,
  })
  return normalizeCurrentVparivanieRegional(result, captured)
}
