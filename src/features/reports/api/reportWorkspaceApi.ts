import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportCatalogue, ReportRequestBody, ReportTemplate } from '../types'

export function getReportCatalogue(signal?: AbortSignal): Promise<ReportCatalogue> {
  return apiRequest('/report/catalogue', { signal })
}

type WireTemplate = Required<Omit<ReportTemplate, 'Data'>> & {
  Data: {
    From: string
    To: string
    Sorted: ReportRequestBody['sorted']
    Selections: ReportRequestBody['selections']
    DataSource: ReportRequestBody['dataSource']
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
