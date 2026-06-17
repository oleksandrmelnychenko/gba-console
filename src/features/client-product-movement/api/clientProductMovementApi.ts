import { apiRequest } from '../../../shared/api/apiClient'
import { buildServerSearchFilter } from '../../../shared/api/searchQuery'
import type {
  ClientProductMovementClientOption,
  ClientProductMovementDocument,
  ClientProductMovementDocumentResult,
  ClientProductMovementFilters,
  ClientProductMovementOrganizationOption,
} from '../types'

export const CLIENT_SEARCH_PAGE_SIZE = 20
const CLIENT_FILTER_ENTITY_TYPE_CLIENT = 0
const CLIENT_SEARCH_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'

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
  offset = 0,
  signal?: AbortSignal,
): Promise<ClientProductMovementClientOption[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: buildClientSearchFilter(searchValue, offset),
    },
    signal,
  })

  return normalizeArray(result) as ClientProductMovementClientOption[]
}

function buildClientSearchFilter(value: string, offset: number): string {
  return buildServerSearchFilter({
    filterEntityType: CLIENT_FILTER_ENTITY_TYPE_CLIENT,
    filterSql: CLIENT_SEARCH_SQL,
    limit: CLIENT_SEARCH_PAGE_SIZE,
    offset,
    table: 'Client',
    value: value.trim(),
  })
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
