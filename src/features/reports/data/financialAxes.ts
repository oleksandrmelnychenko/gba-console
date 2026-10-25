import type { ReportDataset, ReportRequestBody } from '../types'
import { currentFinancialAxesCapability, currentFinancialAxesError, usesCurrentFinancialAxes, validCurrentFinancialAxes } from './currentFinancialAxes'
import { currentFinancialProductTimeAxesCapability, currentFinancialProductTimeAxesError, hasFinancialProductTimeAxes, validCurrentFinancialProductTimeAxes } from './currentFinancialProductTimeAxes'

export type FinancialAxes = {
  version: 1; allowedRows: [3, 4]; allowedColumns: [3, 4]
  minimumRows: 1; maximumRows: 2; maximumColumns: 1
  maximumOutputColumns: 256; uniqueAcrossAxes: true
}

/** The explicit server capability is required; configuration alone cannot unlock financial columns. */
export function financialAxesCapability(dataset?: ReportDataset): FinancialAxes | undefined {
  const value = dataset?.financialAxes
  if (dataset?.DataSource !== 35 || !value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const cap = value as Record<string, unknown>
  if (cap.version !== 1 || !Array.isArray(cap.allowedRows) || cap.allowedRows.length !== 2 || cap.allowedRows[0] !== 3 || cap.allowedRows[1] !== 4
    || !Array.isArray(cap.allowedColumns) || cap.allowedColumns.length !== 2 || cap.allowedColumns[0] !== 3 || cap.allowedColumns[1] !== 4
    || cap.minimumRows !== 1 || cap.maximumRows !== 2 || cap.maximumColumns !== 1
    || cap.maximumOutputColumns !== 256 || cap.uniqueAcrossAxes !== true) return undefined
  return value as FinancialAxes
}

export function requestFinancialAxesCapability(dataset: ReportDataset | undefined, data: object) {
  return usesCurrentFinancialAxes(data) && (currentFinancialProductTimeAxesCapability(dataset) ?? currentFinancialAxesCapability(dataset)) || financialAxesCapability(dataset)
}

export function financialAxesConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (hasFinancialProductTimeAxes(data)) return currentFinancialProductTimeAxesError(data, dataset)
  if (usesCurrentFinancialAxes(data) && currentFinancialProductTimeAxesCapability(dataset))
    return validCurrentFinancialProductTimeAxes(data) ? null : 'Оберіть до двох різних групувань: у рядках або одне в рядках і одне у стовпцях.'
  return currentFinancialAxesError(data, dataset)
}

/** Valid for every existing calculation basis; those bases retain their own period and filter checks. */
export function validFinancialAxes(data: ReportRequestBody, dataset?: ReportDataset): boolean {
  if (currentFinancialProductTimeAxesCapability(dataset) && usesCurrentFinancialAxes(data)) return validCurrentFinancialProductTimeAxes(data)
  if (currentFinancialAxesCapability(dataset) && usesCurrentFinancialAxes(data)) return validCurrentFinancialAxes(data)
  const rows = data.sorted?.Row, columns = data.sorted?.Col
  if (!Array.isArray(rows) || !Array.isArray(columns) || rows.length < 1 || rows.length > 2 || columns.length > 1) return false
  const types = [...rows, ...columns].map(field => field.type)
  return types.every(type => type === 3 || type === 4) && new Set(types).size === types.length
}
