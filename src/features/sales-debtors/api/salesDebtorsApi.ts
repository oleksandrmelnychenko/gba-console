import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ClientDebtors,
  ClientInDebt,
  DebtorsDocumentResult,
  DebtorsFilters,
  DebtorsManagerOption,
  DebtorsOrganizationOption,
} from '../types'

export async function getFilteredDebtors(filters: DebtorsFilters): Promise<ClientDebtors> {
  const result = await apiRequest<unknown>('/debtors/all/filtered/by/client', {
    query: {
      days: filters.days,
      limit: filters.limit,
      offset: filters.offset,
      organizationNetId: filters.organizationNetId || undefined,
      typeAgreement: filters.typeAgreement,
      typeCurrency: filters.typeCurrency,
      userNetId: filters.userNetId || undefined,
    },
  })

  return toClientDebtors(result)
}

export async function exportDebtorsDocument(
  filters: Pick<DebtorsFilters, 'typeAgreement' | 'userNetId' | 'organizationNetId' | 'typeCurrency'>,
): Promise<DebtorsDocumentResult> {
  const result = await apiRequest<unknown>('/debtors/document/export', {
    query: {
      organizationNetId: filters.organizationNetId || undefined,
      typeAgreement: filters.typeAgreement,
      typeCurrency: filters.typeCurrency,
      userNetId: filters.userNetId || undefined,
    },
  })

  return extractDocumentResult(result)
}

export async function getDebtorsManagers(): Promise<DebtorsManagerOption[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/managers/sales')

  return normalizeArray(result) as DebtorsManagerOption[]
}

export async function getDebtorsOrganizations(): Promise<DebtorsOrganizationOption[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeArray(result) as DebtorsOrganizationOption[]
}

function toClientDebtors(result: unknown): ClientDebtors {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    return {
      ClientInDebtors: Array.isArray(record.ClientInDebtors) ? (record.ClientInDebtors as ClientInDebt[]) : [],
      TotalMissedDays: toNumber(record.TotalMissedDays),
      TotalOverdueDebtorsValue: toNumber(record.TotalOverdueDebtorsValue),
      TotalQtyClients: toNumber(record.TotalQtyClients),
      TotalRemainderDebtorsValue: toNumber(record.TotalRemainderDebtorsValue),
    }
  }

  return {
    ClientInDebtors: [],
    TotalMissedDays: 0,
    TotalOverdueDebtorsValue: 0,
    TotalQtyClients: 0,
    TotalRemainderDebtorsValue: 0,
  }
}

function extractDocumentResult(result: unknown): DebtorsDocumentResult {
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

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['Items', 'Organizations', 'Organisations', 'Managers', 'Profiles', 'Users', 'Data', 'Collection']) {
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
