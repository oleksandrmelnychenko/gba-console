import { apiRequest } from '../../../shared/api/apiClient'
import type { SyncHistoryItem, SyncRunResponse, TypeOfXmlDocument } from '../types'

export type SyncRemnantsRequest = {
  forAmg: boolean
  types: string[]
}

export type SyncDailyRequest = {
  forAmg: boolean
  from: Date
  to: Date
  types: string[]
}

export type SyncDocumentsRequest = {
  from: Date
  to: Date
  typeDocument: TypeOfXmlDocument
}

export type SyncHistoryRequest = {
  forAmg: boolean
  from: Date
  to: Date
}

export function getSyncHistory(request: SyncHistoryRequest): Promise<SyncHistoryItem[]> {
  return apiRequest<SyncHistoryItem[]>('/data/sync/info/get', {
    query: request,
    errorMessages: {
      default: 'Не вдалося завантажити історію синхронізації',
      network: 'Сервер синхронізації недоступний',
    },
  })
}

export function startRemnantsSync(request: SyncRemnantsRequest): Promise<SyncRunResponse> {
  return apiRequest<SyncRunResponse>('/data/sync/start', {
    method: 'POST',
    query: request,
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
  return apiRequest<SyncRunResponse>('/data/sync/start/daily', {
    query: request,
    errorMessages: {
      default: 'Не вдалося запустити щоденну синхронізацію',
      network: 'Сервер синхронізації недоступний',
    },
  })
}
