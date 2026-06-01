import { apiRequest } from '../../../shared/api/apiClient'
import type {
  SalesByManagersAndTopReport,
  SalesByProductTopReport,
  SalesChartsClientOption,
  SalesChartsManagerOption,
  SalesChartsOrganizationOption,
  SalesChartsPeriodType,
  SalesChartsTopType,
} from '../types'

export type SalesByProductTopParams = {
  typeTop: SalesChartsTopType
  from: string
  to: string
}

export type SalesByManagersAndTopParams = {
  from: string
  to: string
  netIdManager?: string
  netIdOrganization?: string
}

export type SalesByClientParams = {
  from: string
  to: string
  netId: string
  typePeriod: SalesChartsPeriodType
}

export async function getSalesByProductTop(params: SalesByProductTopParams): Promise<SalesByProductTopReport> {
  const result = await apiRequest<unknown>('/sales/get/managers/product/top', {
    query: {
      from: params.from,
      to: params.to,
      typeTop: params.typeTop,
    },
  })

  return normalizeReport(result)
}

export async function getSalesByManagersAndTop(
  params: SalesByManagersAndTopParams,
): Promise<SalesByManagersAndTopReport> {
  const result = await apiRequest<unknown>('/sales/get/info/by/managers', {
    query: {
      forMySales: false,
      from: params.from,
      netIdManager: params.netIdManager || undefined,
      netIdOrganization: params.netIdOrganization || undefined,
      to: params.to,
    },
  })

  return normalizeManagersReport(result)
}

export async function getSalesByClient(params: SalesByClientParams): Promise<Record<string, number>> {
  const result = await apiRequest<unknown>('/sales/chart/by/client', {
    query: {
      from: params.from,
      netId: params.netId,
      to: params.to,
      typePeriod: params.typePeriod,
    },
  })

  return normalizeNumberMap(result)
}

export async function getSalesManagers(): Promise<SalesChartsManagerOption[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/managers/sales')

  return normalizeArray(result) as SalesChartsManagerOption[]
}

export async function getSalesOrganizations(): Promise<SalesChartsOrganizationOption[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeArray(result) as SalesChartsOrganizationOption[]
}

export async function searchSalesClients(value: string): Promise<SalesChartsClientOption[]> {
  const result = await apiRequest<unknown>('/clients/payers/search/all', {
    query: {
      limit: 50,
      offset: 0,
      value: value.trim(),
    },
  })

  return normalizeArray(result) as SalesChartsClientOption[]
}

function normalizeReport(result: unknown): SalesByProductTopReport {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    return {
      Managers: Array.isArray(record.Managers) ? (record.Managers as SalesByProductTopReport['Managers']) : [],
      Products: Array.isArray(record.Products) ? (record.Products as SalesByProductTopReport['Products']) : [],
    }
  }

  return { Managers: [], Products: [] }
}

function normalizeManagersReport(result: unknown): SalesByManagersAndTopReport {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const total = record.TotalByColumn

    return {
      SalesByManagerAndProductTop: Array.isArray(record.SalesByManagerAndProductTop)
        ? (record.SalesByManagerAndProductTop as SalesByManagersAndTopReport['SalesByManagerAndProductTop'])
        : [],
      TotalByColumn: total && typeof total === 'object' ? (total as Record<string, number>) : {},
    }
  }

  return { SalesByManagerAndProductTop: [], TotalByColumn: {} }
}

function normalizeNumberMap(result: unknown): Record<string, number> {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, number>
  }

  return {}
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['Items', 'Managers', 'Users', 'Clients', 'Organizations', 'Organisations', 'Data', 'Collection']) {
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
