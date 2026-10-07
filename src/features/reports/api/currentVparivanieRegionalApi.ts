import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportRequestBody } from '../types'
import { currentVparivanieConfigurationError } from '../data/currentVparivanie'
import { currentVparivanieRegionalAvailable, normalizeCurrentVparivanieRegional,
  type CurrentVparivanieRegionalResult } from '../data/currentVparivanieRegional'

export async function readCurrentVparivanieRegional(dataset: ReportDataset, request: ReportRequestBody,
  signal?: AbortSignal): Promise<CurrentVparivanieRegionalResult> {
  if (!currentVparivanieRegionalAvailable(dataset)) throw new Error('Сервер ще не підтримує регіональну форму «Впарювання».')
  const rejected = currentVparivanieConfigurationError(request, dataset)
  if (request.dataSource !== 39 || rejected) throw new Error(rejected ?? 'Оберіть поточне «Впарювання».')
  const captured = structuredClone(request)
  const result = await apiRequest<unknown>('/report/datasets/39/current-regional', {
    method: 'POST', body: captured, signal,
  })
  return normalizeCurrentVparivanieRegional(result, captured)
}
