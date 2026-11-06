import type { ReportDataset, ReportRequestBody } from '../types'
import { requestProfitReadMode, withDefaultProfitReadMode } from './profitReadMode'
import { isSettlementReadModeCapability, requestSettlementReadMode } from './settlementReadMode'
import { isCashReadModeCapability, requestCashReadMode } from './cashReadMode'
import { requestGroupedCashPeriod } from './groupedCashPeriod'
import { defaultGroupedSettlementBuyer, defaultGroupedSettlementPeriod, groupedSettlementPeriod,
  requestGroupedSettlementPeriod } from './groupedSettlementPeriod'
import { isProductServiceFilterCapability, productServiceFromClassification, requestProductClassification,
  requestProductServiceFilter, requestSourceOrganizations, sourceOrganizations } from './nativeExactFilters'
import { DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from './dayOrganizationGrossProfit'

export const UNIFIED_SOURCE_SAVED_VARIANT_ERROR = 'Шаблон збережено з вибором бази Fenix/AMG або регістрів 1С. Відкрийте його у формі (буде застосовано дані GBA) і збережіть повторно.'

const keysOf = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())

function replaced(data: ReportRequestBody, name: string, value?: unknown): ReportRequestBody {
  const next: Record<string, unknown> = { ...data }
  for (const key of keysOf(data, name)) delete next[key]
  if (value !== undefined) next[name] = value
  return next as ReportRequestBody
}

function savedWorkbookOrganizations(value: unknown): boolean {
  const ids = sourceOrganizations(value)?.OrganizationIds.map(id => id.toUpperCase())
    .filter(id => !(DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS as readonly string[]).includes(id))
  return ids?.length === DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.length
    && DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.every(id => ids.includes(id))
}

export function carriesSourceWorld(data: ReportRequestBody): boolean {
  return keysOf(data, 'supplierSourceWorld').length > 0
    || requestProfitReadMode(data) === 1 || requestSettlementReadMode(data) === 1 || requestCashReadMode(data) === 1
    || groupedSettlementPeriod(requestGroupedSettlementPeriod(data))?.SourceWorld === 'Amg'
}

const CURRENT_ONLY_FIELDS = ['profitReadMode', 'cashReadMode', 'settlementReadMode', 'dayOrganizationBasis'] as const

export function withoutRetiredReportFields(data: ReportRequestBody): ReportRequestBody {
  let result = replaced(data, 'supplierSourceWorld')
  for (const name of CURRENT_ONLY_FIELDS)
    if (keysOf(result, name).some(key => (result as unknown as Record<string, unknown>)[key] !== 0)) result = replaced(result, name)
  if (keysOf(result, 'supplierBasis').some(key => (result as unknown as Record<string, unknown>)[key] === 1))
    result = replaced(result, 'supplierBasis')
  const grouped = groupedSettlementPeriod(requestGroupedSettlementPeriod(result))
  if (result.dataSource === 41 && grouped) {
    result = replaced(result, 'groupedSettlementPeriod', defaultGroupedSettlementPeriod())
    result = replaced(result, 'sourceBuyerSubtree', defaultGroupedSettlementBuyer())
  }
  return result
}

export function withUnifiedSource(data: ReportRequestBody, dataset?: ReportDataset): ReportRequestBody {
  let result = data
  if (dataset && dataset.DataSource === result.dataSource && result.dataSource === 35 && requestProductClassification(result) != null
    && isProductServiceFilterCapability(dataset.productServiceFilter) && requestProductServiceFilter(result) == null) {
    const service = productServiceFromClassification(requestProductClassification(result))
    if (service) result = replaced(replaced(result, 'productClassification'), 'productServiceFilter', service)
  }
  if (dataset && dataset.DataSource === result.dataSource) {
    if (result.dataSource === 40 && isCashReadModeCapability(dataset.cashReadMode) && requestGroupedCashPeriod(result) != null
      && requestCashReadMode(result) != null && requestCashReadMode(result) !== 0) result = replaced(result, 'cashReadMode', 0)
    const grouped = groupedSettlementPeriod(requestGroupedSettlementPeriod(result))
    if (result.dataSource === 41 && grouped && isSettlementReadModeCapability(dataset.settlementReadMode)
      && (grouped.SourceWorld !== 'Fenix' || requestSettlementReadMode(result) != null && requestSettlementReadMode(result) !== 0))
      result = replaced(result, 'settlementReadMode', 0)
  }
  result = withoutRetiredReportFields(result)
  if (!dataset || dataset.DataSource !== result.dataSource) return result
  if (result.dataSource === 35 && savedWorkbookOrganizations(requestSourceOrganizations(result)))
    result = replaced(result, 'sourceOrganizations')
  return withDefaultProfitReadMode(result, dataset)
}

export const withoutProductClassification = (data: ReportRequestBody): ReportRequestBody => replaced(data, 'productClassification')
