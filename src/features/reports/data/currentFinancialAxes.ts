import type { ReportDataset, ReportDatasetField, ReportRequestBody } from '../types'
import { requestProfitReadMode } from './profitReadMode'
import { requestDayOrganizationBasis } from './dayOrganizationBasis'
import { validMaximumResultColumns } from './reportWideColumns'

export type CurrentFinancialAxes = {
  version: 1; allowedRows: [3, 4, 12, 15]; allowedColumns: [3, 4, 12, 15]
  minimumRows: 1; maximumRows: 2; maximumColumns: 1; maximumTotalDimensions: 2
  maximumOutputColumns: 256; maximumResultColumns?: number; uniqueAcrossAxes: true
  requiredProfitReadMode: 0; requiredDayOrganizationBasis: 0
  groupings: ReportDatasetField[]
}

/** Additive metadata keeps the original Day/Organization capability usable by older clients. */
export function currentFinancialAxesCapability(dataset?: ReportDataset): CurrentFinancialAxes | undefined {
  const value = dataset?.currentFinancialAxes
  if (dataset?.DataSource !== 35 || !value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const cap = value as Record<string, unknown>
  const axis = (value: unknown) => Array.isArray(value) && value.length === 4 && value.every((type, index) => type === [3, 4, 12, 15][index])
  if (cap.version !== 1 || !axis(cap.allowedRows) || !axis(cap.allowedColumns)
    || cap.minimumRows !== 1 || cap.maximumRows !== 2 || cap.maximumColumns !== 1 || cap.maximumTotalDimensions !== 2
    || cap.maximumOutputColumns !== 256 || !validMaximumResultColumns(cap.maximumResultColumns) || cap.uniqueAcrossAxes !== true
    || cap.requiredProfitReadMode !== 0 || cap.requiredDayOrganizationBasis !== 0
    || !Array.isArray(cap.groupings) || cap.groupings.length !== 2
    || cap.groupings.some((field, index) => !field || typeof field !== 'object' || Array.isArray(field)
      || field.Type !== [12, 15][index] || typeof field.Name !== 'string' || !field.Name.trim() || field.Selectable !== true)) return undefined
  return value as CurrentFinancialAxes
}

export function usesCurrentFinancialAxes(data: object): boolean {
  return (data as Partial<ReportRequestBody>).dataSource === 35
    && Object.keys(data).filter(key => key.toLowerCase() === 'profitreadmode').length === 1
    && Object.keys(data).filter(key => key.toLowerCase() === 'dayorganizationbasis').length === 1
    && requestProfitReadMode(data) === 0 && requestDayOrganizationBasis(data) === 0
}

/** Response binding can check scope and shape independently of metadata already validated before the request. */
export function validCurrentFinancialAxes(data: ReportRequestBody): boolean {
  const rows = data.sorted?.Row, cols = data.sorted?.Col
  if (!usesCurrentFinancialAxes(data) || !Array.isArray(rows) || !Array.isArray(cols)
    || rows.length < 1 || rows.length > 2 || cols.length > 1 || rows.length + cols.length > 2) return false
  const types = [...rows, ...cols].map(field => field.type)
  return types.every(type => [3, 4, 12, 15].includes(type)) && new Set(types).size === types.length
}

export function currentFinancialAxesError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== 35 || ![...(Array.isArray(data.sorted?.Row) ? data.sorted.Row : []), ...(Array.isArray(data.sorted?.Col) ? data.sorted.Col : [])].some(field => field.type === 12 || field.type === 15)) return null
  if (!usesCurrentFinancialAxes(data))
    return 'Групування за клієнтом і договором доступне лише для «Поточних документів GBA» та «Продажі мінус повернення». Поверніть цей режим або змініть групування; вибрані дати й відбори збережено.'
  if (!currentFinancialAxesCapability(dataset))
    return 'Поточний сервер не підтвердив групування прибутку за клієнтом і договором. Налаштування збережено без змін.'
  if (!validCurrentFinancialAxes(data))
    return 'Оберіть до двох різних групувань: у рядках або одне в рядках і одне у стовпцях.'
  return null
}
