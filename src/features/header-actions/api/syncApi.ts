import { apiRequest } from '../../../shared/api/apiClient'
import type { DailyDataSyncStockMode, DataSyncStatus, SyncRunResponse, TypeOfXmlDocument } from '../types'

const SYNC_OPERATION_ID_HEADER = 'X-GBA-Sync-Operation-Id'

export type SyncFullRequest = {
  forAmg: boolean
  operationId: string
  types: string[]
}

export type SyncDailyRequest = {
  forAmg: boolean
  from: Date
  operationId: string
  stockMode: DailyDataSyncStockMode
  to: Date
  types: string[]
}

export type SyncDocumentsRequest = {
  from: Date
  to: Date
  typeDocument: TypeOfXmlDocument
}

export function createSyncOperationId(): string {
  return crypto.randomUUID().replaceAll('-', '').toLowerCase()
}

export function getSyncStatus(): Promise<DataSyncStatus> {
  return apiRequest<DataSyncStatus>('/data/sync/status', {
    errorMessages: {
      default: 'Не вдалося отримати статус синхронізації',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startFullSync(request: SyncFullRequest): Promise<SyncRunResponse> {
  const { operationId, ...query } = request

  return apiRequest<SyncRunResponse>('/data/sync/start', {
    headers: {
      [SYNC_OPERATION_ID_HEADER]: operationId,
    },
    method: 'POST',
    query,
    errorMessages: {
      default: 'Не вдалося запустити синхронізацію з 1С',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startGbaToOneCSync(request: SyncDocumentsRequest): Promise<SyncRunResponse> {
  return apiRequest<SyncRunResponse>('/xml/documents/new', {
    query: request,
    errorMessages: {
      default: 'Не вдалося запустити вигрузку в 1С',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startDailySync(request: SyncDailyRequest): Promise<SyncRunResponse> {
  const { operationId, ...query } = request

  return apiRequest<SyncRunResponse>('/data/sync/start/daily', {
    headers: {
      [SYNC_OPERATION_ID_HEADER]: operationId,
    },
    query,
    errorMessages: {
      default: 'Не вдалося запустити щоденну синхронізацію',
      network: 'Сервер синхронізації недоступний',
    },
  })
}
