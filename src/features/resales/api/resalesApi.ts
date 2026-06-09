import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeExportDocument as normalizeSharedExportDocument } from '../../../shared/documents/exportDocument'
import { getClients } from '../../clients/api/clientsApi'
import type {
  CreatedResaleAvailabilityWithTotals,
  GenerateAutomaticallyResalePayload,
  GroupingResaleAvailability,
  ReSale,
  ResaleActionResult,
  ResaleAvailabilityFilterOptions,
  ResaleAvailabilityFilterPayload,
  ResaleAvailabilityItemModel,
  ResaleAvailabilityWithTotals,
  ResaleBackendWarning,
  ResaleClient,
  ResaleConsignmentNoteSetting,
  ResaleCreatePayload,
  ResaleDownloadDocumentType,
  ResaleExportDocument,
  ResalesSearchParams,
  UpdatedResaleModel,
} from '../types'

export async function getResales(params: ResalesSearchParams): Promise<ReSale[]> {
  const result = await apiRequest<unknown>('/resales/all', {
    query: params,
  })

  return normalizeResales(result)
}

export async function removeResale(netId: string): Promise<ReSale | null> {
  const result = await apiRequest<unknown>('/resales/remove', {
    body: {},
    method: 'POST',
    query: {
      netId,
    },
  })

  return normalizeResale(result)
}

export async function getResaleByNetId(
  netId: string,
  updatedReSaleModel?: UpdatedResaleModel,
): Promise<ResaleActionResult<UpdatedResaleModel>> {
  const result = await apiRequest<unknown>('/resales/updated/get', {
    ...(updatedReSaleModel ? { body: updatedReSaleModel } : {}),
    method: 'POST',
    query: {
      netId,
    },
  })

  return normalizeActionResult(result, normalizeUpdatedResaleModel)
}

export async function updateResale(payload: UpdatedResaleModel): Promise<ResaleActionResult<UpdatedResaleModel>> {
  const result = await apiRequest<unknown>('/resales/update', {
    body: payload,
    method: 'POST',
  })

  return normalizeActionResult(result, normalizeUpdatedResaleModel)
}

export async function completeResale(netId: string): Promise<UpdatedResaleModel | null> {
  const result = await apiRequest<unknown>('/resales/complete', {
    body: {},
    method: 'POST',
    query: {
      netId,
    },
  })

  const actionResult = normalizeActionResult(result, normalizeUpdatedResaleModel)

  if (actionResult.warning) {
    throw new Error(actionResult.warning.Message || 'Resale completion failed')
  }

  return actionResult.data ?? null
}

export async function changeResaleToInvoice(netId: string): Promise<UpdatedResaleModel | null> {
  const result = await apiRequest<unknown>('/resales/change/to/invoice', {
    body: {},
    method: 'POST',
    query: {
      netId,
    },
  })

  const actionResult = normalizeActionResult(result, normalizeUpdatedResaleModel)

  if (actionResult.warning) {
    throw new Error(actionResult.warning.Message || 'Resale invoice conversion failed')
  }

  return actionResult.data ?? null
}

export async function exportResaleDocument(params: {
  netId: string
  type: ResaleDownloadDocumentType
}): Promise<ResaleExportDocument> {
  const result = await apiRequest<unknown>('/resales/document/export', {
    query: params,
  })

  return normalizeExportDocument(result)
}

export async function getResaleConsignmentNoteSettings(): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/all/get', {
    query: {
      forReSale: true,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function addResaleConsignmentNoteSetting(
  setting: ResaleConsignmentNoteSetting,
): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/add', {
    body: setting,
    method: 'POST',
    query: {
      forReSale: true,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function updateResaleConsignmentNoteSetting(
  setting: ResaleConsignmentNoteSetting,
): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/update', {
    body: setting,
    method: 'POST',
    query: {
      forReSale: true,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function removeResaleConsignmentNoteSetting(netId: string): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/remove', {
    body: {},
    method: 'POST',
    query: {
      forReSale: true,
      netId,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function printResaleConsignmentNoteDocument(
  saleNetId: string,
  setting: ResaleConsignmentNoteSetting,
): Promise<ResaleExportDocument> {
  const result = await apiRequest<unknown>('/consignment/note/settings/print/document', {
    body: setting,
    method: 'POST',
    query: {
      forReSale: true,
      netId: saleNetId,
    },
  })

  return normalizeExportDocument(result)
}

export async function getResaleAvailabilityFilterOptions(): Promise<ResaleAvailabilityFilterOptions> {
  const result = await apiRequest<unknown>('/resales/availabilities/filter/options')
  const options = normalizeFilterOptions(result)

  if (options.SpecificationCodes.length > 0) {
    return options
  }

  return {
    ...options,
    SpecificationCodes: await getResaleAvailabilitySpecificationCodes(),
  }
}

export async function getResaleAvailabilitySpecificationCodes(): Promise<string[]> {
  const result = await apiRequest<unknown>('/resales/availabilities/specification/codes')

  return readArrayPayload(result, ['Items', 'SpecificationCodes', 'Data'])
    .filter((code): code is string => typeof code === 'string')
}

export async function getResaleAvailabilities(
  payload: ResaleAvailabilityFilterPayload,
): Promise<ResaleAvailabilityWithTotals> {
  const result = await apiRequest<unknown>('/resales/availabilities/all/filtered', {
    body: payload,
    method: 'POST',
  })

  return normalizeAvailabilityWithTotals(result)
}

export async function exportResaleAvailabilities(
  payload: ResaleAvailabilityFilterPayload,
): Promise<ResaleExportDocument> {
  const result = await apiRequest<unknown>('/resales/document/resale', {
    body: payload,
    method: 'POST',
  })

  return normalizeExportDocument(result)
}

export async function updateResaleAvailabilityList(
  payload: ResaleAvailabilityItemModel[],
): Promise<ResaleActionResult<CreatedResaleAvailabilityWithTotals>> {
  const result = await apiRequest<unknown>('/resales/availability/list/update', {
    body: payload,
    method: 'POST',
  })

  return normalizeActionResult(result, normalizeCreatedResaleAvailability)
}

export async function generateAutomaticallyResale(
  payload: GenerateAutomaticallyResalePayload,
): Promise<ResaleActionResult<CreatedResaleAvailabilityWithTotals>> {
  const result = await apiRequest<unknown>('/resales/generate/automatically', {
    body: payload,
    method: 'POST',
  })

  return normalizeActionResult(result, normalizeCreatedResaleAvailability)
}

export async function addResale(payload: ResaleCreatePayload): Promise<ResaleActionResult<ReSale>> {
  const result = await apiRequest<unknown>('/resales/add', {
    body: payload,
    method: 'POST',
  })

  return normalizeActionResult(result, normalizeResale)
}

export async function searchResaleClients(value: string, signal?: AbortSignal): Promise<ResaleClient[]> {
  const clients = await getClients({
    active: true,
    forReSale: true,
    limit: 20,
    offset: 0,
    value,
  }, signal)

  return clients as unknown as ResaleClient[]
}

function normalizeResales(result: unknown): ReSale[] {
  return readArrayPayload(result, ['Items', 'Resales', 'Data']) as ReSale[]
}

function normalizeResale(result: unknown): ReSale | null {
  if (result && typeof result === 'object') {
    return result as ReSale
  }

  return null
}

function normalizeConsignmentNoteSettings(result: unknown): ResaleConsignmentNoteSetting[] {
  return readArrayPayload(result, ['Items', 'Settings', 'Data']) as ResaleConsignmentNoteSetting[]
}

function normalizeUpdatedResaleModel(result: unknown): UpdatedResaleModel | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Partial<UpdatedResaleModel>

  if (!payload.ReSale || typeof payload.ReSale !== 'object') {
    return null
  }

  return {
    ...(payload as UpdatedResaleModel),
    ReSaleItemModels: Array.isArray(payload.ReSaleItemModels) ? payload.ReSaleItemModels : [],
  }
}

function normalizeFilterOptions(result: unknown): ResaleAvailabilityFilterOptions {
  const payload = result && typeof result === 'object' ? (result as Partial<ResaleAvailabilityFilterOptions>) : {}

  return {
    ProductGroups: Array.isArray(payload.ProductGroups) ? payload.ProductGroups : [],
    SpecificationCodes: Array.isArray(payload.SpecificationCodes) ? payload.SpecificationCodes : [],
    Storages: Array.isArray(payload.Storages) ? payload.Storages : [],
  }
}

function normalizeAvailabilityWithTotals(result: unknown): ResaleAvailabilityWithTotals {
  if (!result || typeof result !== 'object') {
    return {
      GroupReSaleAvailabilities: [],
      TotalQty: 0,
      TotalValueWithVat: 0,
      TotalWithExtraValue: 0,
    }
  }

  const payload = result as Partial<ResaleAvailabilityWithTotals>

  return {
    GroupReSaleAvailabilities: normalizeGroupingAvailabilities(payload.GroupReSaleAvailabilities),
    TotalQty: readNumber(payload.TotalQty),
    TotalValueWithVat: readNumber(payload.TotalValueWithVat),
    TotalWithExtraValue: readNumber(payload.TotalWithExtraValue),
  }
}

function normalizeGroupingAvailabilities(items: unknown): GroupingResaleAvailability[] {
  return Array.isArray(items) ? (items as GroupingResaleAvailability[]) : []
}

function normalizeCreatedResaleAvailability(result: unknown): CreatedResaleAvailabilityWithTotals | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Partial<CreatedResaleAvailabilityWithTotals>

  return {
    Organization: payload.Organization,
    Qty: readNumber(payload.Qty),
    ReSaleAvailabilityItemModels: Array.isArray(payload.ReSaleAvailabilityItemModels)
      ? payload.ReSaleAvailabilityItemModels
      : [],
    Value: readNumber(payload.Value),
    Vat: readNumber(payload.Vat),
    Weight: readNumber(payload.Weight),
  }
}

function normalizeActionResult<T>(result: unknown, normalize: (value: unknown) => T | null): ResaleActionResult<T> {
  const warning = readBackendWarning(result)

  if (warning) {
    return { warning }
  }

  const data = normalize(result)

  return data ? { data } : {}
}

function readBackendWarning(result: unknown): ResaleBackendWarning | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Partial<ResaleBackendWarning>

  if (typeof payload.Message !== 'string' || !payload.Message) {
    return null
  }

  return {
    Message: payload.Message,
    Products: Array.isArray(payload.Products) ? payload.Products : [],
  }
}

function normalizeExportDocument(result: unknown): ResaleExportDocument {
  return normalizeSharedExportDocument(result)
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}
