import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportCatalogue, ReportDataset, ReportDatasetField, ReportRequestBody, ReportTemplate } from '../types'
import { isCurrentReportSource } from '../data/nativeReportProfiles'
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
    Ordering?: unknown
    FilterExpression?: unknown
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
    sorted: value.Data.Sorted,
    selections: value.Data.Selections ?? [],
    dataSource: value.Data.DataSource,
    ...(Object.hasOwn(value.Data, 'Ordering') ? { ordering: value.Data.Ordering } : {}),
    ...(Object.hasOwn(value.Data, 'FilterExpression') ? { filterExpression: value.Data.FilterExpression } : {}),
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
  const result = await apiRequest<WireTemplate>('/report/templates/save', {
    method: 'POST', body: { Id: template.Id, Revision: template.Revision ?? 0, Name: template.Name, Data: template.Data },
  })
  return normalizeSavedTemplate(result)
}

export function deleteServerReportTemplate(template: ReportTemplate): Promise<unknown> {
  return apiRequest('/report/templates/delete', {
    method: 'POST', body: { Id: template.Id, Revision: template.Revision },
  })
}
