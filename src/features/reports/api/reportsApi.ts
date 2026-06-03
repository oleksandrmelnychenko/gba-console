import { apiRequest } from '../../../shared/api/apiClient'
import { buildServerSearchFilter } from '../../../shared/api/searchQuery'
import type {
  ReportEntity,
  ReportRequestBody,
  ReportResult,
  ReportSearchParams,
  SaleReturnsReportSearchParams,
  SalesReportSearchParams,
} from '../types'
import { normalizeReportResult } from '../utils'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const CLIENT_FILTER_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'
const USER_FILTER_SQL = 'FirstName/LastName/FullName/Email/Name'

export async function createStockReport(body: ReportRequestBody): Promise<ReportResult> {
  const result = await apiRequest<unknown>('/report/get/all/filtered', {
    method: 'POST',
    body,
  })

  return normalizeReportResult(result)
}

export async function getReportOrganizations(): Promise<ReportEntity[]> {
  return getResourceList('/organizations/all')
}

export async function getReportClientTypes(): Promise<ReportEntity[]> {
  const clientTypes = await getResourceList('/clients/types/all')

  return clientTypes.flatMap((clientType) => {
    const roles = Array.isArray(clientType.ClientTypeRoles) ? clientType.ClientTypeRoles : []

    return roles.map((role) => ({
      ...(role && typeof role === 'object' ? role : {}),
      Name: `${getName(clientType)} / ${getName(role as ReportEntity)}`,
    })) as ReportEntity[]
  })
}

export async function getReportRegions(): Promise<ReportEntity[]> {
  return getResourceList('/regions/all/codes')
}

export async function getReportPricings(): Promise<ReportEntity[]> {
  return getResourceList('/pricings/all')
}

export async function getReportProductGroups(value = ''): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/products/groups/filtered/get', {
    query: {
      value: value.trim(),
    },
  })

  return normalizeCollection(result, ['ProductGroups', 'Items'])
}

export async function getReportProductTop(): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/products/groups/get/top')

  return normalizeCollection(result, ['Items', 'ProductGroups', 'Data'])
}

export async function searchReportProducts(params: ReportSearchParams): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/products/search/advanced', {
    query: {
      limit: params.limit,
      mode: 5,
      netId: EMPTY_GUID,
      offset: params.offset,
      sortMode: 2,
      value: params.value.trim(),
    },
  })

  return normalizeCollection(result, ['Items', 'Products', 'Data']).map((product) => ({
    ...product,
    Name: [product.VendorCode, product.Name || product.NameUA].filter(Boolean).join(' - '),
  }))
}

export async function searchReportClients(params: ReportSearchParams): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: buildServerSearchFilter({
        table: 'Client',
        limit: params.limit,
        offset: params.offset,
        value: params.value.trim(),
        filterEntityType: 0,
        filterSql: CLIENT_FILTER_SQL,
      }),
    },
  })

  return normalizeCollection(result, ['Items', 'Clients', 'Data'])
}

export async function getReportClientAgreements(netId: string): Promise<ReportEntity[]> {
  if (!netId) {
    return []
  }

  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      netId,
    },
  })

  return normalizeCollection(result, ['Items', 'ClientAgreements', 'Agreements', 'Data', 'Collection']).map((clientAgreement) => ({
    ...clientAgreement,
    Name: getClientAgreementName(clientAgreement),
  }))
}

export async function searchReportUsers(params: ReportSearchParams): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: buildServerSearchFilter({
        table: 'User',
        limit: params.limit,
        offset: params.offset,
        value: params.value.trim(),
        filterEntityType: 1,
        filterSql: USER_FILTER_SQL,
      }),
    },
  })

  return normalizeCollection(result, ['Items', 'Users', 'Data']).map((user) => ({
    ...user,
    Name: getUserName(user),
  }))
}

export async function searchSalesReportDocuments(params: SalesReportSearchParams): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/sales/all/filtered/reports', {
    query: {
      clientId: params.clientId,
      fastEcommerce: params.fastEcommerce ?? false,
      forEcommerce: params.forEcommerce ?? false,
      from: params.from,
      fromShipments: params.fromShipments ?? false,
      limit: params.limit,
      offset: params.offset,
      organisationIds: params.organisationIds || [],
      status: params.status,
      to: params.to,
      type: params.type,
      value: params.value.trim(),
    },
  })

  return normalizeCollection(result, ['Items', 'Sales', 'Data']).map((sale) => ({
    ...sale,
    Name: getSaleNumber(sale),
  }))
}

export async function searchSaleReturnReportDocuments(params: SaleReturnsReportSearchParams): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>('/sales/returns/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
      value: params.value.trim(),
    },
  })

  return normalizeCollection(result, ['Items', 'SaleReturns', 'Data']).map((saleReturn) => ({
    ...saleReturn,
    Name: typeof saleReturn.Number === 'string' ? saleReturn.Number : getName(saleReturn),
  }))
}

async function getResourceList(path: string): Promise<ReportEntity[]> {
  const result = await apiRequest<unknown>(path)

  return normalizeCollection(result, ['Items', 'Data'])
}

function normalizeCollection(result: unknown, keys: string[]): ReportEntity[] {
  if (Array.isArray(result)) {
    return result.filter(isReportEntity)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return (payload[key] as unknown[]).filter(isReportEntity)
    }
  }

  return []
}

function isReportEntity(value: unknown): value is ReportEntity {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getName(entity: ReportEntity | null | undefined): string {
  if (!entity) {
    return ''
  }

  return String(entity.Name || entity.FullName || entity.Value || entity.Id || '')
}

function getUserName(user: ReportEntity): string {
  return String(
    user.FullName
      || user.Name
      || [user.FirstName, user.LastName].filter((value) => typeof value === 'string' && value).join(' ')
      || user.Email
      || user.Id
      || '',
  )
}

function getClientAgreementName(clientAgreement: ReportEntity): string {
  const agreement = clientAgreement.Agreement

  if (agreement && typeof agreement === 'object') {
    const agreementName = getName(agreement as ReportEntity)

    if (agreementName) {
      return agreementName
    }
  }

  return getName(clientAgreement)
}

function getSaleNumber(sale: ReportEntity): string {
  const saleNumber = sale.SaleNumber

  if (saleNumber && typeof saleNumber === 'object' && 'Value' in saleNumber) {
    return String((saleNumber as { Value?: unknown }).Value || sale.Id || '')
  }

  return getName(sale)
}
