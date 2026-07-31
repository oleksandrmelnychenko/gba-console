import { apiRequest } from '../../../shared/api/apiClient'
import type {
  VehicleRegistryFilters,
  VehicleRegistryImport,
  VehicleRegistryImportOutcome,
  VehicleRegistryIssue,
  VehicleRegistryPagedResponse,
  VehicleRegistrySummary,
  VehicleRegistryVehicle,
  VehicleRegistryVehicleDetail,
  VehicleRegistryVehicleQuery,
  VehicleRegistryWorkflowPayload,
} from '../types'

const BASE_PATH = '/administration/vehicle-registry'

export function getVehicleRegistrySummary(signal?: AbortSignal) {
  return apiRequest<VehicleRegistrySummary>(`${BASE_PATH}/summary`, { signal })
}

export function getVehicleRegistryFilters(brand?: string | null, signal?: AbortSignal) {
  return apiRequest<VehicleRegistryFilters>(`${BASE_PATH}/filters`, {
    query: { brand: brand || '' },
    signal,
  })
}

export function getVehicleRegistryVehicles(query: VehicleRegistryVehicleQuery, signal?: AbortSignal) {
  return apiRequest<VehicleRegistryPagedResponse<VehicleRegistryVehicle>>(`${BASE_PATH}/vehicles`, {
    query: {
      limit: query.limit,
      offset: query.offset,
      clientMatchState: query.clientMatchState || '',
      search: query.search || '',
      brand: query.brand || '',
      model: query.model || '',
      region: query.region || '',
      workflowStatus: query.workflowStatus || '',
      dataQualityStatus: query.dataQualityStatus || '',
      processingState: query.processingState || '',
      prioritizeClientMatches: query.prioritizeClientMatches !== false,
      includeRemoved: query.includeRemoved || false,
    },
    signal,
  })
}

export function getVehicleRegistryVehicle(netUid: string, signal?: AbortSignal) {
  return apiRequest<VehicleRegistryVehicleDetail>(`${BASE_PATH}/vehicles/${netUid}`, { signal })
}

export function updateVehicleRegistryWorkflow(
  netUid: string,
  payload: VehicleRegistryWorkflowPayload,
) {
  return apiRequest<unknown>(`${BASE_PATH}/vehicles/${netUid}/workflow`, {
    body: payload,
    method: 'POST',
  })
}

export function getVehicleRegistryImports(
  limit: number,
  offset: number,
  signal?: AbortSignal,
) {
  return apiRequest<VehicleRegistryPagedResponse<VehicleRegistryImport>>(`${BASE_PATH}/imports`, {
    query: { limit, offset },
    signal,
  })
}

export function importVehicleRegistryFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('replaceBrandSnapshot', 'true')

  return apiRequest<VehicleRegistryImportOutcome>(`${BASE_PATH}/imports`, {
    body: formData,
    dedupe: false,
    method: 'POST',
  })
}

export function getVehicleRegistryImportIssues(
  netUid: string,
  limit: number,
  offset: number,
  signal?: AbortSignal,
) {
  return apiRequest<VehicleRegistryPagedResponse<VehicleRegistryIssue>>(
    `${BASE_PATH}/imports/${netUid}/issues`,
    {
      query: { limit, offset },
      signal,
    },
  )
}
