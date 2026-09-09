import { cloneRateComparisonAliases, isRateComparisonCapability, rateComparisonConfigurationError, RATE_COMPARISON_CAPTIONS, RATE_COMPARISON_GROUP } from '../data/rateComparison'
import { cloneReturnComparisonAliases, isReturnComparisonCapability, returnComparisonConfigurationError } from '../data/returnComparison'
import { cloneBuyerSalesShareAliases, isBuyerSalesShareCapability, buyerSalesShareConfigurationError } from '../data/buyerSalesShare'
import { cloneRevenueComparisonAliases, isRevenueComparisonCapability, revenueComparisonConfigurationError } from '../data/revenueComparison'
import { cloneXyzAliases, isXyzCapability, salesXyzConfigurationError } from '../data/salesXyz'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportCatalogue, ReportDataset, ReportDatasetField, ReportRequestBody, ReportTemplate } from '../types'
import { isCurrentReportSource } from '../data/nativeReportProfiles'
import { isClientComparisonCapability } from '../data/clientPeriodComparison'
import { isReportCatalogue } from '../data/reportMigration'

function isDatasetField(value: unknown): value is ReportDatasetField {
  if (!value || typeof value !== 'object') return false
  const field = value as Partial<ReportDatasetField>
  return Number.isSafeInteger(field.Type) && field.Type! >= 0 && typeof field.Name === 'string' && field.Name.trim().length > 0
    && (field.Selectable === undefined || typeof field.Selectable === 'boolean')
}

function isDataset(value: unknown): value is ReportDataset {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ReportDataset>
  const fieldsValid = [item.Groupings, item.Measurements, item.Filters].every(fields =>
    Array.isArray(fields) && fields.every(isDatasetField) && new Set(fields.map(field => field.Type)).size === fields.length)
  return Number.isSafeInteger(item.DataSource) && item.DataSource! >= 0 && item.DataSource !== 1 && typeof item.Name === 'string' && !!item.Name.trim()
    && typeof item.Description === 'string' && fieldsValid && !!item.Groupings?.length && !!item.Measurements?.length
    && (item.PeriodRequired === undefined || typeof item.PeriodRequired === 'boolean')
    && (item.PeriodSupported === undefined || typeof item.PeriodSupported === 'boolean')
    && (item.DataSource !== 12 || (item.PeriodRequired === true && item.PeriodSupported === true))
    && (item.DataSource === 19 ? item.PeriodRequired === false && item.PeriodSupported === false && item.Filters?.length === 0 && item.Groupings?.length === 1 && item.Groupings[0].Type === 52 && item.Groupings[0].Name === RATE_COMPARISON_GROUP
      && item.Measurements?.length === RATE_COMPARISON_CAPTIONS.length && item.Measurements.every((field, index) => field.Type === 51 + index && field.Name === RATE_COMPARISON_CAPTIONS[index] && field.Selectable !== false) && isRateComparisonCapability(item.rateComparison) : item.rateComparison == null)
    && (item.DataSource === 18 ? item.PeriodRequired === true && item.PeriodSupported === true && isReturnComparisonCapability(item.ReturnComparison) : item.ReturnComparison == null)
    && (item.DataSource === 17 ? item.PeriodRequired === true && item.PeriodSupported === true && isBuyerSalesShareCapability(item.BuyerSalesShare) : item.BuyerSalesShare == null)
    && (item.DataSource === 16 ? item.PeriodRequired === true && item.PeriodSupported === true && isRevenueComparisonCapability(item.RevenueComparison) : item.RevenueComparison == null)
    && (item.DataSource === 15 ? item.PeriodRequired === true && item.PeriodSupported === true && isXyzCapability(item.Xyz) : item.Xyz == null)
    && (item.DataSource !== 14 || (item.PeriodRequired === true && item.PeriodSupported === true))
    && (item.DataSource !== 13 || (item.PeriodRequired === true && item.PeriodSupported === true && isClientComparisonCapability(item.Comparison)))
    && !(item.PeriodSupported === false && item.PeriodRequired === true)
    && (!isCurrentReportSource(item.DataSource) || item.PeriodSupported === false)
    && Array.isArray(item.Limitations) && item.Limitations.every(text => typeof text === 'string')
}

export async function getReportDatasets(signal?: AbortSignal): Promise<ReportDataset[]> {
  const result = await apiRequest<unknown>('/report/datasets', { signal })
  if (!Array.isArray(result) || !result.length || !result.every(isDataset)
    || new Set(result.map(item => item.DataSource)).size !== result.length) {
    throw new Error('Сервер повернув некоректний список наборів даних звітів.')
  }
  return result
}

export async function getReportCatalogue(signal?: AbortSignal): Promise<ReportCatalogue> {
  const result = await apiRequest<unknown>('/report/catalogue', { signal })
  if (!isReportCatalogue(result)) throw new Error('Сервер повернув некоректний каталог джерельних звітів.')
  return result
}

type WireTemplate = Required<Omit<ReportTemplate, 'Data'>> & {
  Data: {
    From: string | null
    To: string | null
    Sorted: ReportRequestBody['sorted']
    Selections: ReportRequestBody['selections']
    DataSource: ReportRequestBody['dataSource']
    ValuationClientAgreementId?: ReportRequestBody['valuationClientAgreementId']
    RateComparison?: unknown
    rateComparison?: unknown
    ReturnComparison?: unknown
    returnComparison?: unknown
    BuyerSalesShare?: unknown
    buyerSalesShare?: unknown
    RevenueComparison?: unknown
    revenueComparison?: unknown
    Xyz?: unknown
    xyz?: unknown
    Comparison?: unknown
    comparison?: unknown
    Ordering?: unknown
    FilterExpression?: unknown
    HideZero?: unknown
    hideZero?: unknown
    Threshold?: unknown
    threshold?: unknown
    AbcClassification?: unknown
    abcClassification?: unknown
    TopGroups?: unknown
    topGroups?: unknown
    OneC?: ReportRequestBody['oneC']
  }
}

// The .NET DTO uses PascalCase at the top level; grouping/selection contracts already match.
export function normalizeSavedTemplate(value: WireTemplate): ReportTemplate {
  if (!value?.Id || !Number.isInteger(value.Revision) || value.Revision < 1 || !value.Data?.Sorted) {
    throw new Error('Сервер повернув некоректний шаблон звіту.')
  }
  return { ...value, Data: {
    from: value.Data.From ?? '', to: value.Data.To ?? '',
    sorted: (value.Data.DataSource === 16 || value.Data.DataSource === 17 || value.Data.DataSource === 18 || value.Data.DataSource === 19) ? structuredClone(value.Data.Sorted) : value.Data.Sorted,
    selections: (value.Data.DataSource === 16 || value.Data.DataSource === 17 || value.Data.DataSource === 18 || value.Data.DataSource === 19) ? structuredClone(value.Data.Selections ?? []) : value.Data.Selections ?? [],
    dataSource: value.Data.DataSource,
    ...cloneRateComparisonAliases(value.Data),
    ...cloneReturnComparisonAliases(value.Data),
    ...cloneBuyerSalesShareAliases(value.Data),
    ...cloneRevenueComparisonAliases(value.Data),
    ...cloneXyzAliases(value.Data),
    ...(Object.hasOwn(value.Data, 'comparison') ? { comparison: value.Data.comparison,
      ...(Object.hasOwn(value.Data, 'Comparison') ? { Comparison: value.Data.Comparison } : {}),
    } : Object.hasOwn(value.Data, 'Comparison') ? { comparison: value.Data.Comparison } : {}),
    ...(Object.hasOwn(value.Data, 'Ordering') ? { ordering: value.Data.Ordering } : {}),
    ...(Object.hasOwn(value.Data, 'FilterExpression') ? { filterExpression: value.Data.FilterExpression } : {}),
    ...(Object.hasOwn(value.Data, 'hideZero') ? { hideZero: value.Data.hideZero,
      ...(Object.hasOwn(value.Data, 'HideZero') ? { HideZero: value.Data.HideZero } : {}),
    } : Object.hasOwn(value.Data, 'HideZero') ? { hideZero: value.Data.HideZero } : {}),
    ...(Object.hasOwn(value.Data, 'threshold') ? { threshold: value.Data.threshold,
      ...(Object.hasOwn(value.Data, 'Threshold') ? { Threshold: value.Data.Threshold } : {}),
    } : Object.hasOwn(value.Data, 'Threshold') ? { threshold: value.Data.Threshold } : {}),
    ...(Object.hasOwn(value.Data, 'abcClassification') ? { abcClassification: value.Data.abcClassification,
      ...(Object.hasOwn(value.Data, 'AbcClassification') ? { AbcClassification: value.Data.AbcClassification } : {}),
    } : Object.hasOwn(value.Data, 'AbcClassification') ? { abcClassification: value.Data.AbcClassification } : {}),
    ...(Object.hasOwn(value.Data, 'topGroups') ? { topGroups: value.Data.topGroups,
      ...(Object.hasOwn(value.Data, 'TopGroups') ? { TopGroups: value.Data.TopGroups } : {}),
    } : Object.hasOwn(value.Data, 'TopGroups') ? { topGroups: value.Data.TopGroups } : {}),
    ...(value.Data.ValuationClientAgreementId != null ? { valuationClientAgreementId: value.Data.ValuationClientAgreementId } : {}),
    ...(value.Data.OneC ? { oneC: value.Data.OneC } : {}),
  } }
}

export async function getServerReportTemplates(signal?: AbortSignal): Promise<ReportTemplate[]> {
  const result = await apiRequest<WireTemplate[]>('/report/templates', { signal })
  if (!Array.isArray(result)) throw new Error('Сервер повернув некоректний список шаблонів.')
  return result.map(normalizeSavedTemplate)
}

export async function saveServerReportTemplate(template: ReportTemplate): Promise<ReportTemplate> {
  const request = (template.Data.dataSource === 17 || template.Data.dataSource === 18 || template.Data.dataSource === 19) ? structuredClone(template) : template
  const rateError = rateComparisonConfigurationError(request.Data)
  if (rateError) throw new Error(rateError)
  const returnError = returnComparisonConfigurationError(request.Data)
  if (returnError) throw new Error(returnError)
  const buyerShareError = buyerSalesShareConfigurationError(request.Data)
  if (buyerShareError) throw new Error(buyerShareError)
  const revenueError = revenueComparisonConfigurationError(request.Data)
  if (revenueError) throw new Error(revenueError)
  const xyzError = salesXyzConfigurationError(request.Data)
  if (xyzError) throw new Error(xyzError)
  const result = await apiRequest<WireTemplate>('/report/templates/save', {
    method: 'POST', body: { Id: request.Id, Revision: request.Revision ?? 0, Name: request.Name, Data: request.Data },
  })
  return normalizeSavedTemplate(result)
}

export function deleteServerReportTemplate(template: ReportTemplate): Promise<unknown> {
  return apiRequest('/report/templates/delete', {
    method: 'POST', body: { Id: template.Id, Revision: template.Revision },
  })
}
