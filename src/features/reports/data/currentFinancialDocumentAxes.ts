import type { ReportDataset, ReportDatasetField, ReportRequestBody } from '../types'
import { usesCurrentFinancialAxes } from './currentFinancialAxes'
import { currentFinancialProductTimeAxesCapability } from './currentFinancialProductTimeAxes'

const axes = [0, 1, 2, 3, 4, 5, 12, 15, 81] as const
const axisTypes: ReadonlySet<number> = new Set(axes)
export type CurrentFinancialDocumentAxes = {
  version: 1; allowedRows: number[]; allowedColumns: number[]
  minimumRows: 1; maximumRows: 2; maximumColumns: 1; maximumTotalDimensions: 2
  maximumOutputColumns: 256; uniqueAcrossAxes: true; quantitySupported: false
  requiredProfitReadMode: 0; requiredDayOrganizationBasis: 0
  groupings: ReportDatasetField[]
}

/** The document sibling extends the confirmed product/time descriptor set, never historical modes. */
export function currentFinancialDocumentAxesCapability(dataset?: ReportDataset): CurrentFinancialDocumentAxes | undefined {
  const value = dataset?.currentFinancialDocumentAxes
  if (!currentFinancialProductTimeAxesCapability(dataset) || !value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const cap = value as Record<string, unknown>
  const exactAxes = (value: unknown) => Array.isArray(value) && value.length === axes.length
    && value.every((type, index) => type === axes[index])
  if (cap.version !== 1 || !exactAxes(cap.allowedRows) || !exactAxes(cap.allowedColumns)
    || cap.minimumRows !== 1 || cap.maximumRows !== 2 || cap.maximumColumns !== 1 || cap.maximumTotalDimensions !== 2
    || cap.maximumOutputColumns !== 256 || cap.uniqueAcrossAxes !== true || cap.quantitySupported !== false
    || cap.requiredProfitReadMode !== 0 || cap.requiredDayOrganizationBasis !== 0
    || !Array.isArray(cap.groupings) || cap.groupings.length !== 1
    || !cap.groupings[0] || typeof cap.groupings[0] !== 'object' || Array.isArray(cap.groupings[0])
    || cap.groupings[0].Type !== 81 || typeof cap.groupings[0].Name !== 'string' || !cap.groupings[0].Name.trim()
    || cap.groupings[0].Selectable !== true) return undefined
  return value as CurrentFinancialDocumentAxes
}

export function hasFinancialDocumentAxes(data: ReportRequestBody): boolean {
  return data.dataSource === 35 && [...(Array.isArray(data.sorted?.Row) ? data.sorted.Row : []), ...(Array.isArray(data.sorted?.Col) ? data.sorted.Col : [])]
    .some(field => field.type === 81)
}

export function validCurrentFinancialDocumentAxes(data: ReportRequestBody): boolean {
  const rows = data.sorted?.Row, cols = data.sorted?.Col
  if (!usesCurrentFinancialAxes(data) || !Array.isArray(rows) || !Array.isArray(cols)
    || rows.length < 1 || rows.length > 2 || cols.length > 1 || rows.length + cols.length > 2) return false
  const types = [...rows, ...cols].map(field => field.type)
  return types.every(type => axisTypes.has(type)) && new Set(types).size === types.length
}

export function currentFinancialDocumentAxesError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (!hasFinancialDocumentAxes(data)) return null
  if (!usesCurrentFinancialAxes(data))
    return 'Групування за документом доступне лише для «Поточних документів GBA» та «Продажі мінус повернення». Поверніть цей режим або змініть групування; дати й відбори збережено.'
  if (!currentFinancialDocumentAxesCapability(dataset))
    return 'Поточний сервер не підтвердив групування прибутку за документом. Налаштування збережено без змін.'
  if (!validCurrentFinancialDocumentAxes(data))
    return 'Оберіть до двох різних групувань: у рядках або одне в рядках і одне у стовпцях.'
  return null
}
