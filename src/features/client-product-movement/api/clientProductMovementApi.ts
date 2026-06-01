import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ClientProductMovementClientOption,
  ClientProductMovementDocument,
  ClientProductMovementDocumentResult,
  ClientProductMovementFilters,
  ClientProductMovementOrganizationOption,
} from '../types'

function buildMovementQuery(filters: ClientProductMovementFilters) {
  return {
    article: filters.article.trim() || undefined,
    clientNetId: filters.clientNetId,
    from: filters.from,
    limit: filters.limit,
    offset: filters.offset,
    organizationId: filters.organizationId.length ? filters.organizationId : undefined,
    to: filters.to,
  }
}

export async function getClientProductMovements(
  filters: ClientProductMovementFilters,
): Promise<ClientProductMovementDocument[]> {
  const result = await apiRequest<unknown>('/consignments/info/client/movement/filtered', {
    query: buildMovementQuery(filters),
  })

  return normalizeArray(result) as ClientProductMovementDocument[]
}

export async function exportClientProductMovementDocument(
  filters: ClientProductMovementFilters,
): Promise<ClientProductMovementDocumentResult> {
  const result = await apiRequest<unknown>('/consignments/info/client/movement/document/export', {
    query: buildMovementQuery(filters),
  })

  return extractDocumentResult(result)
}

export async function getClientProductMovementOrganizations(): Promise<ClientProductMovementOrganizationOption[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeArray(result) as ClientProductMovementOrganizationOption[]
}

export async function searchClientProductMovementClients(
  value: string,
): Promise<ClientProductMovementClientOption[]> {
  const result = await apiRequest<unknown>('/clients/payers/search/all', {
    query: {
      limit: 50,
      offset: 0,
      value: value.trim(),
    },
  })

  return normalizeArray(result) as ClientProductMovementClientOption[]
}

function extractDocumentResult(result: unknown): ClientProductMovementDocumentResult {
  if (typeof result === 'string') {
    return { excelUrl: toSecureUrl(result.trim() || null), pdfUrl: null }
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const excel = record.DocumentURL ?? record.DocumentUrl ?? record.Url ?? record.url
    const pdf = record.PdfDocumentURL ?? record.PdfDocumentUrl

    return {
      excelUrl: typeof excel === 'string' ? toSecureUrl(excel.trim() || null) : null,
      pdfUrl: typeof pdf === 'string' ? toSecureUrl(pdf.trim() || null) : null,
    }
  }

  return { excelUrl: null, pdfUrl: null }
}

function toSecureUrl(url: string | null): string | null {
  if (!url) {
    return null
  }

  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['Items', 'Clients', 'Organizations', 'Organisations', 'Data', 'Collection']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
