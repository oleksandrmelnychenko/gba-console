import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  CreateProtocolPayload,
  DeliveryProductProtocol,
  DeliveryProductProtocolListResult,
  ProtocolExportColumn,
  ProtocolExportDocument,
  ProtocolOrganization,
  ProtocolsSearchParams,
} from '../types'

export async function getProtocols(params: ProtocolsSearchParams): Promise<DeliveryProductProtocolListResult> {
  const result = await apiRequest<unknown>('/delivery/product/protocol/all', {
    query: {
      limit: params.limit,
      offset: params.offset,
      organization: params.organization || undefined,
      supplier: params.supplier || undefined,
      from: toDateTimeQuery(params.from, 'start'),
      to: toDateTimeQuery(params.to, 'end'),
    },
  })

  return normalizeListResult(result)
}

export async function getProtocolByNetId(netId: string): Promise<DeliveryProductProtocol | null> {
  const result = await apiRequest<unknown>('/delivery/product/protocol/get/', {
    query: { netId },
  })

  return normalizeProtocol(result)
}

export async function getProtocolOrganizations(): Promise<ProtocolOrganization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return Array.isArray(result) ? (result as ProtocolOrganization[]) : []
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<DeliveryProductProtocol | null> {
  const formData = new FormData()
  formData.append('deliveryProductProtocolString', JSON.stringify(payload))

  const result = await apiRequest<unknown>('/delivery/product/protocol/new', {
    method: 'POST',
    body: formData,
  })

  return normalizeProtocol(result)
}

export async function exportProtocolsDocument(
  from: string,
  to: string,
  columns: ProtocolExportColumn[],
): Promise<ProtocolExportDocument> {
  const result = await apiRequest<unknown>('/delivery/product/protocol/print/documents', {
    method: 'POST',
    body: columns,
    query: {
      from: toDateTimeQuery(from, 'start'),
      to: toDateTimeQuery(to, 'end'),
    },
  })

  return normalizeExportDocument(result)
}

function normalizeListResult(result: unknown): DeliveryProductProtocolListResult {
  if (Array.isArray(result)) {
    return { items: result as DeliveryProductProtocol[], totalQty: result.length }
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const items = Array.isArray(record.DeliveryProductProtocols)
      ? (record.DeliveryProductProtocols as DeliveryProductProtocol[])
      : []
    const totalQty = typeof record.TotalQty === 'number' ? record.TotalQty : items.length

    return { items, totalQty }
  }

  return { items: [], totalQty: 0 }
}

function normalizeProtocol(result: unknown): DeliveryProductProtocol | null {
  if (result && typeof result === 'object') {
    return result as DeliveryProductProtocol
  }

  return null
}

function normalizeExportDocument(result: unknown): ProtocolExportDocument {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>

    return {
      DocumentURL: typeof record.DocumentURL === 'string' ? record.DocumentURL : undefined,
      PdfDocumentURL: typeof record.PdfDocumentURL === 'string' ? record.PdfDocumentURL : undefined,
    }
  }

  return {}
}
