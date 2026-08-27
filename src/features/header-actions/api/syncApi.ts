import { apiRequest } from '../../../shared/api/apiClient'
import {
  DataSyncSessionMode,
  SyncProductConsignmentType,
  type DailyDataSyncStockMode,
  type DataSyncStatus,
  type SyncRunResponse,
  type TypeOfXmlDocument,
} from '../types'

const SYNC_OPERATION_ID_HEADER = 'X-GBA-Sync-Operation-Id'
const FULL_SESSION_DOCUMENT_TYPES = Object.values(SyncProductConsignmentType).map(String)

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

export type SyncSessionRequest = {
  forAmg: boolean
  from: string
  mode: DataSyncSessionMode
  operationId: string
  to: string
  types: string[]
}

export function createSyncOperationId(): string {
  return crypto.randomUUID().replaceAll('-', '').toLowerCase()
}

export function getSyncStatus(): Promise<DataSyncStatus> {
  return apiRequest<DataSyncStatus>('/data/sync/online-shop-seo/status', {
    errorMessages: {
      default: 'Не вдалося отримати статус синхронізації',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startFullSync(request: SyncFullRequest): Promise<SyncRunResponse> {
  const { operationId, ...query } = request

  return apiRequest<SyncRunResponse>('/data/sync/online-shop-seo/start', {
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
  return apiRequest<SyncRunResponse>('/xml/documents/online-shop-seo/new', {
    query: request,
    errorMessages: {
      default: 'Не вдалося запустити вигрузку в 1С',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startDailySync(request: SyncDailyRequest): Promise<SyncRunResponse> {
  const { operationId, ...query } = request

  return apiRequest<SyncRunResponse>('/data/sync/online-shop-seo/start/daily', {
    headers: {
      [SYNC_OPERATION_ID_HEADER]: operationId,
    },
    method: 'POST',
    query,
    errorMessages: {
      default: 'Не вдалося запустити щоденну синхронізацію',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startSyncSession(request: SyncSessionRequest): Promise<SyncRunResponse> {
  const { operationId, ...requestQuery } = request
  const query =
    request.mode === DataSyncSessionMode.Full
      ? {
          ...requestQuery,
          types: [...FULL_SESSION_DOCUMENT_TYPES],
        }
      : requestQuery

  return apiRequest<SyncRunResponse>('/data/sync/online-shop-seo/start/session', {
    headers: {
      [SYNC_OPERATION_ID_HEADER]: operationId,
    },
    method: 'POST',
    query,
    errorMessages: {
      default: 'Не вдалося запустити сесію синхронізації',
      network: 'Сервер синхронізації недоступний',
    },
  })
}
