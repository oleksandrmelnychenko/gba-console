import { workbookConfigurationError } from '../data/workbookPresentation'
import { bindWorkbookPreview } from '../data/workbookPreview'
import { settlementAttributeKey } from '../data/settlementSourceAttributes'
import { settlementPeriodConfigurationError } from '../data/settlementPeriod'
import { agreementPricesConfigurationError } from '../data/agreementPrices'
import { agreementPriceComparisonConfigurationError } from '../data/agreementPriceComparison'
import { recordedSaleGrossProfitConfigurationError } from '../data/recordedSaleGrossProfit'
import { dayOrganizationGrossProfitConfigurationError } from '../data/dayOrganizationGrossProfit'
import { vparivanieConfigurationError } from '../data/vparivanie'
import { currentVparivanieConfigurationError, currentVparivanieManagerReference, currentVparivanieFullScope } from '../data/currentVparivanie'
import { cashPeriodConfigurationError } from '../data/cashPeriod'
import { supplierBatchGrossProfitConfigurationError } from '../data/supplierBatchGrossProfit'
import { importedSaleDiscountConfigurationError } from '../data/importedSaleDiscount'
import { paymentComparisonConfigurationError } from '../data/paymentComparison'
import { marginComparisonConfigurationError } from '../data/marginComparison'
import { rateComparisonConfigurationError } from '../data/rateComparison'
import { returnComparisonConfigurationError } from '../data/returnComparison'
import { buyerSalesShareConfigurationError } from '../data/buyerSalesShare'
import { revenueComparisonConfigurationError, revenueExactId } from '../data/revenueComparison'
import { salesXyzConfigurationError } from '../data/salesXyz'
import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ReportEntity,
  OneCTurnoverScopeSummary,
  ReportRequestBody,
  ReportResult,
  ReportSearchParams,
  SaleReturnsReportSearchParams,
  SalesReportSearchParams,
} from '../types'
import { importedPaymentsConfigurationError } from '../data/importedPayments'
import { clientComparisonConfigurationError } from '../data/clientPeriodComparison'
import { normalizeReportResult } from '../utils'
import { nativeExactFiltersConfigurationError } from '../data/nativeExactFilters'
import { EXACT_ONE_C_BUYER_ROOT_ID } from '../data/oneCTurnoverReport'
import { priceTypeSalesComparisonConfigurationError, priceTypeSalesSourceId } from '../data/priceTypeSalesComparison'
import { oneCSpecialSettingsError } from '../data/oneCSpecialReports'
import { normalizeNativeReportPreview, type NativeReportPreview } from '../data/nativeReportPreview'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const CLIENT_FILTER_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'

export async function createStockReport(body: ReportRequestBody): Promise<ReportResult> {
  const request = prepareStockReportRequest(body)
  const result = await apiRequest<unknown>('/report/stocks/generate', {
    method: 'POST',
    dedupe: false,
    body: request,
  })

  return normalizeReportResult(result)
}

/** Calculates one bounded on-screen page and file links from the same report run. */
export async function previewStockReport(body: ReportRequestBody): Promise<{ result: ReportResult; preview: NativeReportPreview }> {
  const request = prepareStockReportRequest(body)
  const response = await apiRequest<unknown>('/report/stocks/preview', {
    method: 'POST',
    dedupe: false,
    query: { rowOffset: 0, rowLimit: 50 },
    body: request,
  })
  const preview = normalizeNativeReportPreview(response, currentVparivanieFullScope(request))
  bindWorkbookPreview(request, preview)
  if (request.dataSource === 39 && (preview.Request?.DataSource !== 'NativeCurrentVparivanie' || !preview.CurrentVparivanieProducts))
    throw new Error('Сервер повернув результат іншого набору даних замість поточної матриці «Впарювання».')
  if (request.dataSource === 41 && preview.Request?.DataSource !== 'NativeSettlementPeriod')
    throw new Error('Сервер повернув інший набір даних замість взаєморозрахунків за період.')
  if (request.dataSource === 40 && preview.Request?.DataSource !== 'NativeCashPeriod')
    throw new Error('Сервер повернув результат іншого набору даних замість руху коштів.')
  return { result: normalizeReportResult(response), preview }
}

/** Reuses native refusal rules without submitting or replacing a saved definition. */
export function validateStockReportRequest(body: ReportRequestBody): void {
  prepareStockReportRequest(body)
}

function prepareStockReportRequest(body: ReportRequestBody): ReportRequestBody {
  const request = (body.dataSource === 2 || body.dataSource === 17 || body.dataSource === 18 || body.dataSource === 19 || body.dataSource === 20 || body.dataSource === 21 || body.dataSource === 22 || body.dataSource === 23 || body.dataSource === 24 || body.dataSource === 25 || body.dataSource === 27 || body.dataSource === 28 || body.dataSource === 35 || body.dataSource === 38 || body.dataSource === 39 || body.dataSource === 40 || body.dataSource === 41) ? structuredClone(body) : body
  const workbookError = workbookConfigurationError(request)
  if (workbookError) throw new Error(workbookError)
  const exactFilterError = nativeExactFiltersConfigurationError(request)
  if (exactFilterError) throw new Error(exactFilterError)
  const pricesError = agreementPricesConfigurationError(request)
  if (pricesError) throw new Error(pricesError)
  const priceComparisonError = agreementPriceComparisonConfigurationError(request)
  if (priceComparisonError) throw new Error(priceComparisonError)
  const grossProfitError = recordedSaleGrossProfitConfigurationError(request)
  if (grossProfitError) throw new Error(grossProfitError)
  const dayOrganizationProfitError = dayOrganizationGrossProfitConfigurationError(request)
  if (dayOrganizationProfitError) throw new Error(dayOrganizationProfitError)
  const currentVparivanieError = currentVparivanieConfigurationError(request)
  if (currentVparivanieError) throw new Error(currentVparivanieError)
  const settlementPeriodError = settlementPeriodConfigurationError(request)
  if (settlementPeriodError) throw new Error(settlementPeriodError)
  const cashPeriodError = cashPeriodConfigurationError(request)
  if (cashPeriodError) throw new Error(cashPeriodError)
  if (request.dataSource === 39) for (const selection of request.selections) {
    if (selection.SelectedField.Type === 60) for (const value of selection.Values)
      value.Data.Id = currentVparivanieManagerReference(value.Data)!
  }
  const vparivanieError = vparivanieConfigurationError(request)
  if (vparivanieError) throw new Error(vparivanieError)
  const supplierBatchProfitError = supplierBatchGrossProfitConfigurationError(request)
  if (supplierBatchProfitError) throw new Error(supplierBatchProfitError)
  const importedDiscountError = importedSaleDiscountConfigurationError(request)
  if (importedDiscountError) throw new Error(importedDiscountError)
  const paymentError = paymentComparisonConfigurationError(request)
  if (paymentError) throw new Error(paymentError)
  const marginError = marginComparisonConfigurationError(request)
  if (marginError) throw new Error(marginError)
  const rateError = rateComparisonConfigurationError(request)
  if (rateError) throw new Error(rateError)
  const returnError = returnComparisonConfigurationError(request)
  if (returnError) throw new Error(returnError)
  const buyerShareError = buyerSalesShareConfigurationError(request)
  if (buyerShareError) throw new Error(buyerShareError)
  const revenueError = revenueComparisonConfigurationError(request)
  if (revenueError) throw new Error(revenueError)
  const xyzError = salesXyzConfigurationError(request)
  if (xyzError) throw new Error(xyzError)
  const paymentsError = importedPaymentsConfigurationError(request)
  if (paymentsError) throw new Error(paymentsError)
  const comparisonError = clientComparisonConfigurationError(request)
  if (comparisonError) throw new Error(comparisonError)
  const priceTypeComparisonError = priceTypeSalesComparisonConfigurationError(request)
  if (priceTypeComparisonError) throw new Error(priceTypeComparisonError)
  const specialOneCError = oneCSpecialSettingsError(request)
  if (specialOneCError) throw new Error(specialOneCError)
  return request
}

export async function searchDatasetReportValues(dataSource: number, field: number, params: ReportSearchParams, signal?: AbortSignal, sourceWorld?: number, salesBasis?: 0 | 1, providedDiscountBasis?: 0 | 1): Promise<ReportEntity[]> {
  if (providedDiscountBasis !== undefined && (dataSource !== 24 || ![0, 1].includes(providedDiscountBasis)
    || (providedDiscountBasis === 0 && sourceWorld !== 1))) throw new Error('Некоректна основа довідника наданих знижок.')
  if (salesBasis !== undefined && (dataSource !== 27 || ![0, 1].includes(salesBasis)))
    throw new Error('Некоректна основа довідника продажів.')
  if (dataSource === 27 && salesBasis === 0 && ![46, 51, 52, 45].includes(field))
    throw new Error('Цей відбір поточних продажів недоступний.')
  if (dataSource === 41 && ![0, 6, 9, 17, 18, 30, 60, 61].includes(field))
    throw new Error('Цей відбір групових взаєморозрахунків недоступний.')
  if (dataSource === 40 && ![29, 30, 32, 33].includes(field)) throw new Error('Цей відбір рахунків недоступний.')
  if (dataSource === 39 && ![1, 4, 5, 21, 60].includes(field))
    throw new Error('Цей відбір поточної матриці «Впарювання» недоступний.')
  if ([23, 24, 25, 28].includes(dataSource) && !(sourceWorld === 1 || (dataSource !== 28 && sourceWorld === 2)))
    throw new Error('Оберіть базу Fenix або AMG для довідника звіту 1С.')
  if (dataSource === 41 && [60, 61].includes(field) && sourceWorld !== 1)
    throw new Error('Джерельні реквізити покупців доступні лише для Fenix.')
  const result = await apiRequest<unknown>('/report/datasets/lookup', {
    query: { dataSource, field, value: params.value.trim(), offset: params.offset, limit: params.limit,
      ...([23, 24, 25, 28].includes(dataSource) || dataSource === 41 && [60, 61].includes(field) ? { sourceWorld } : {}),
      ...(dataSource === 27 && salesBasis !== undefined ? { salesBasis } : {}),
      ...(dataSource === 24 && providedDiscountBasis !== undefined ? { providedDiscountBasis } : {}) }, signal,
  })
  if (!Array.isArray(result) || !result.every(item => item && typeof item === 'object' && (dataSource === 41 && [60, 61].includes(field) ? settlementAttributeKey(field, item) === item.Id
    : dataSource === 39 && field === 60
    ? typeof item.Id === 'string' && currentVparivanieManagerReference(item) === item.Id
    : dataSource === 27
    ? priceTypeSalesSourceId(item.Id) !== null
    : [23, 24, 25, 28].includes(dataSource) ? typeof item.Id === 'string' && item.Id.length > 0 && item.Id.length <= 512 && !/\p{Cc}/u.test(item.Id)
    : dataSource === 29 ? typeof item.Id === 'string' && /^[1-9]\d*$/.test(item.Id)
      && Number.isSafeInteger(Number(item.Id))
    : dataSource === 32 ? typeof item.Id === 'string' && revenueExactId(item) !== null
    : dataSource === 31 ? (typeof item.Id === 'number' && Number.isSafeInteger(item.Id) && item.Id > 0)
      || (typeof item.Id === 'string' && /^[1-9]\d*$/.test(item.Id) && Number.isSafeInteger(Number(item.Id)))
    : (dataSource === 18 || dataSource === 19 || dataSource === 20 || dataSource === 21 || dataSource === 22 || dataSource === 30 || dataSource === 32 || dataSource === 35 || dataSource === 38 || dataSource === 39 || dataSource === 40 || dataSource === 41)
      ? typeof item.Id === 'string' && revenueExactId(item) !== null
      : (dataSource === 16 || dataSource === 17) ? revenueExactId(item) !== null : Number.isSafeInteger(item.Id) && item.Id > 0)
    && typeof item.Name === 'string' && item.Name.trim().length > 0)) throw new Error('Сервер повернув некоректні значення відбору звіту.')
  if (dataSource === 41 && [60, 61].includes(field) && new Set(result.map(item => item.Id)).size !== result.length)
    throw new Error('Сервер повернув неоднозначні реквізити покупця.')
  if (dataSource === 39 && field === 60 && new Set(result.map(item => item.Id)).size !== result.length)
    throw new Error('Сервер повернув неоднозначні джерельні реквізити менеджерів покупців.')
  if (dataSource === 19 && (new Set(result.map(item => item.Id)).size !== result.length || result.some(item => !item.Name.trim()))) throw new Error('Сервер повернув неоднозначні серії курсів.')
  return dataSource === 29 || dataSource === 31 ? result.map(item => ({ ...item, Id: Number(item.Id) })) : result
}

export type CurrentPriceTypeSalesScopeChoices = {
  Organizations: ReportEntity[]
  ProductKinds: ReportEntity[]
  BuyerRootId: string
}

/** Reads current native choices from OUR SQL; no sync or 1C calls. */
export async function getCurrentPriceTypeSalesScopeChoices(signal?: AbortSignal): Promise<CurrentPriceTypeSalesScopeChoices> {
  const result = await apiRequest<unknown>('/report/datasets/27/current-scope', { signal })
  if (!result || typeof result !== 'object') throw new Error('Некоректні поточні відбори продажів.')
  const scope = result as Record<string, unknown>
  const choices = (items: unknown): items is ReportEntity[] => Array.isArray(items)
    && items.every(item => item && typeof item === 'object' && priceTypeSalesSourceId(item.Id) !== null
      && typeof item.Name === 'string' && item.Name.trim().length > 0)
    && new Set(items.map(item => String(item.Id).toUpperCase())).size === items.length
  if (!choices(scope.Organizations) || !choices(scope.ProductKinds)
    || typeof scope.BuyerRootId !== 'string' || scope.BuyerRootId.toUpperCase() !== EXACT_ONE_C_BUYER_ROOT_ID)
    throw new Error('Некоректні поточні відбори продажів.')
  return { Organizations: scope.Organizations, ProductKinds: scope.ProductKinds, BuyerRootId: scope.BuyerRootId.toUpperCase() }
}

export type ValuationAgreement = { Id: number; Name: string }

export async function searchValuationAgreements(params: ReportSearchParams, signal?: AbortSignal): Promise<ValuationAgreement[]> {
  const result = await apiRequest<unknown>('/report/datasets/8/valuation-agreements', {
    query: { value: params.value.trim(), offset: params.offset, limit: params.limit }, signal,
  })
  if (!Array.isArray(result) || !result.every((item): item is ValuationAgreement => item && typeof item === 'object'
    && Number.isSafeInteger(item.Id) && item.Id > 0 && typeof item.Name === 'string' && item.Name.trim().length > 0)) {
    throw new Error('Сервер повернув некоректний список договорів для оцінки.')
  }
  return result
}

/** Local catalogue only: this request never starts sync or connects to 1C. */
export async function getOneCTurnoverScopes(signal?: AbortSignal): Promise<OneCTurnoverScopeSummary[]> {
  const result = await apiRequest<unknown>('/report/stocks/one-c/scopes', { signal })
  if (!Array.isArray(result) || !result.every(isOneCTurnoverScope)) throw new Error('Invalid 1C report scope catalogue')
  return result
}

function isOneCTurnoverScope(value: unknown): value is OneCTurnoverScopeSummary {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  const filters = item.Filters as Record<string, unknown> | undefined
  const isReference = (id: unknown) => typeof id === 'string' && /^[a-f\d]{32}$/i.test(id) && !/^0+$/.test(id)
  return typeof item.Key === 'string' && /^[a-f\d]{64}$/i.test(item.Key)
    && !!filters && Array.isArray(filters.OrganizationIds) && filters.OrganizationIds.length > 0 && filters.OrganizationIds.every(isReference)
    && isReference(filters.ProductKindId) && typeof filters.ExcludeServices === 'boolean'
    && (filters.BuyerRootId === undefined || filters.BuyerRootId === null
      || typeof filters.BuyerRootId === 'string' && filters.BuyerRootId.toUpperCase() === EXACT_ONE_C_BUYER_ROOT_ID)
    && Array.isArray(item.OrganizationNames) && item.OrganizationNames.every(name => typeof name === 'string')
    && typeof item.FirstDay === 'string' && typeof item.LastDay === 'string'
    && typeof item.LoadedDayCount === 'number' && Number.isInteger(item.LoadedDayCount) && item.LoadedDayCount > 0
    && typeof item.OldestReadCompletedUtc === 'string' && typeof item.NewestReadCompletedUtc === 'string'
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

// The CustomerRegionCode filter keys on Client.RegionCodeId server-side (SalesReportProjectionRepository:
// Deserialize<Client>(selection).Select(x => x.RegionCodeId)). /regions/all/codes returns REGIONS with a
// nested RegionCodes[] — flatten to the individual codes and stamp RegionCodeId so the selection carries the
// value the report backend actually filters on.
export async function getReportRegionCodes(): Promise<ReportEntity[]> {
  const regions = await getReportRegions()

  return regions.flatMap((region) => {
    const codes = Array.isArray(region.RegionCodes) ? (region.RegionCodes as ReportEntity[]) : []

    return codes.map((code) => ({
      ...code,
      RegionCodeId: code.Id,
      Value: code.Value,
      Name: (code.Value ?? code.Name ?? '') as string,
    }))
  })
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

export async function searchReportClients(
  params: ReportSearchParams,
  signal?: AbortSignal,
): Promise<ReportEntity[]> {
  const searchValue = params.value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/reports/stocks/search', {
    query: {
      filterSql: CLIENT_FILTER_SQL,
      limit: params.limit,
      offset: params.offset,
      value: searchValue,
    },
    signal,
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

export async function searchReportUsers(
  params: ReportSearchParams,
  signal?: AbortSignal,
): Promise<ReportEntity[]> {
  const searchValue = params.value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/usermanagement/profiles/search/lookup', {
    query: {
      limit: params.limit,
      offset: params.offset,
      value: searchValue,
    },
    signal,
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
