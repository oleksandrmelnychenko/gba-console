import type { ReportDataset, ReportDatasetField, ReportRequestBody } from '../types'
import { usesCurrentFinancialAxes } from './currentFinancialAxes'

const axes = [0, 1, 2, 3, 4, 5, 12, 15] as const
const descriptors = [0, 1, 2, 5, 12, 15] as const
export type CurrentFinancialProductTimeAxes = {
  version: 1; allowedRows: number[]; allowedColumns: number[]
  minimumRows: 1; maximumRows: 2; maximumColumns: 1; maximumTotalDimensions: 2
  maximumOutputColumns: 256; uniqueAcrossAxes: true; quantitySupported: false
  requiredProfitReadMode: 0; requiredDayOrganizationBasis: 0
  groupings: ReportDatasetField[]
}

/** Independent sibling: old servers and historical calculation modes keep their existing axes. */
export function currentFinancialProductTimeAxesCapability(dataset?: ReportDataset): CurrentFinancialProductTimeAxes | undefined {
  const value = dataset?.currentFinancialProductTimeAxes
  if (dataset?.DataSource !== 35 || !value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const cap = value as Record<string, unknown>
  const exactAxes = (value: unknown) => Array.isArray(value) && value.length === axes.length
    && value.every((type, index) => type === axes[index])
  if (cap.version !== 1 || !exactAxes(cap.allowedRows) || !exactAxes(cap.allowedColumns)
    || cap.minimumRows !== 1 || cap.maximumRows !== 2 || cap.maximumColumns !== 1 || cap.maximumTotalDimensions !== 2
    || cap.maximumOutputColumns !== 256 || cap.uniqueAcrossAxes !== true || cap.quantitySupported !== false
    || cap.requiredProfitReadMode !== 0 || cap.requiredDayOrganizationBasis !== 0
    || !Array.isArray(cap.groupings) || cap.groupings.length !== descriptors.length
    || cap.groupings.some((field, index) => !field || typeof field !== 'object' || Array.isArray(field)
      || field.Type !== descriptors[index] || typeof field.Name !== 'string' || !field.Name.trim() || field.Selectable !== true)) return undefined
  return value as CurrentFinancialProductTimeAxes
}

export function hasFinancialProductTimeAxes(data: ReportRequestBody): boolean {
  return data.dataSource === 35 && [...(Array.isArray(data.sorted?.Row) ? data.sorted.Row : []), ...(Array.isArray(data.sorted?.Col) ? data.sorted.Col : [])]
    .some(field => [0, 1, 2, 5].includes(field.type))
}

/** Response binding checks scope and shape after request capability validation. */
export function validCurrentFinancialProductTimeAxes(data: ReportRequestBody): boolean {
  const rows = data.sorted?.Row, cols = data.sorted?.Col
  if (!usesCurrentFinancialAxes(data) || !Array.isArray(rows) || !Array.isArray(cols)
    || rows.length < 1 || rows.length > 2 || cols.length > 1 || rows.length + cols.length > 2) return false
  const types = [...rows, ...cols].map(field => field.type)
  return types.every(type => (axes as readonly number[]).includes(type)) && new Set(types).size === types.length
}

export function currentFinancialProductTimeAxesError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (!hasFinancialProductTimeAxes(data)) return null
  if (!usesCurrentFinancialAxes(data))
    return 'Групування за товаром, роком, кварталом і місяцем доступне лише для «Поточних документів GBA» та «Продажі мінус повернення». Поверніть цей режим або змініть групування; вибрані дати й відбори збережено.'
  if (!currentFinancialProductTimeAxesCapability(dataset))
    return 'Поточний сервер не підтвердив групування прибутку за товаром і періодами. Налаштування збережено без змін.'
  if (!validCurrentFinancialProductTimeAxes(data))
    return 'Оберіть до двох різних групувань: у рядках або одне в рядках і одне у стовпцях.'
  return null
}
