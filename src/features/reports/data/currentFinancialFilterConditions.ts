import type { ReportDataset, ReportRequestBody } from '../types'
import { usesCurrentFinancialAxes } from './currentFinancialAxes'

const legacyConditions = [0, 2] as const
const currentConditions = [0, 1, 2, 4] as const
const fields = [0, 1, 2, 6, 9] as const
export type CurrentFinancialFilterConditions = {
  version: 1; requiredProfitReadMode: 0; requiredDayOrganizationBasis: 0
  allowedFields: number[]; conditions: number[]; maximumSelections: 32; maximumValues: 100
}

export function currentFinancialFilterConditionsCapability(dataset?: ReportDataset): CurrentFinancialFilterConditions | undefined {
  const value = dataset?.currentFinancialFilterConditions
  if (dataset?.DataSource !== 35 || !value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const cap = value as Record<string, unknown>
  const exact = (value: unknown, expected: readonly number[]) => Array.isArray(value)
    && value.length === expected.length && value.every((item, index) => item === expected[index])
  if (cap.version !== 1 || cap.requiredProfitReadMode !== 0 || cap.requiredDayOrganizationBasis !== 0
    || !exact(cap.allowedFields, fields) || !exact(cap.conditions, currentConditions)
    || cap.maximumSelections !== 32 || cap.maximumValues !== 100) return undefined
  return value as CurrentFinancialFilterConditions
}

/** Metadata absence and historical modes keep positive-only membership. */
export function financialFilterConditionTypes(dataset?: ReportDataset, request?: ReportRequestBody): readonly number[] {
  return request && usesCurrentFinancialAxes(request) && currentFinancialFilterConditionsCapability(dataset)
    ? currentConditions : legacyConditions
}

export function currentFinancialFilterConditionsError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== 35 || !Array.isArray(data.selections)
    || !data.selections.some(selection => [1, 4].includes(selection?.FilterCondition?.Type))) return null
  if (!usesCurrentFinancialAxes(data))
    return 'Умови «Не дорівнює» та «Не у списку» доступні лише для поточних документів GBA та основи «Продажі мінус повернення». Поверніть цей режим або змініть умову; відбори й дати збережено.'
  if (!currentFinancialFilterConditionsCapability(dataset))
    return 'Поточний сервер не підтвердив умови «Не дорівнює» та «Не у списку» для валового прибутку. Налаштування збережено без змін.'
  return null
}
