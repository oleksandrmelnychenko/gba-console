import { workbookConfigurationError } from './workbookPresentation'
import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'

export const CASH_WORKBOOK_ROWS = [40, 44, 43] as const
export const GROUPED_CASH_FILTERS = [29, 30, 32, 33] as const
export type GroupedCashPeriod = { Version: 1; CurrencyBasis: 'AccountAndManagementCurrency' }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const aliases = (value: object) => Object.keys(value).filter(key => key.toLowerCase() === 'groupedcashperiod')
const exact = (value: unknown, expected: readonly number[]) => Array.isArray(value)
  && value.length === expected.length && value.every((item, index) => item === expected[index])
export const defaultGroupedCashPeriod = (): GroupedCashPeriod => ({ Version: 1, CurrencyBasis: 'AccountAndManagementCurrency' })
export function requestGroupedCashPeriod(value: object): unknown {
  const key = aliases(value)[0]
  return key === undefined ? undefined : (value as Record<string, unknown>)[key]
}
export function cloneGroupedCashAliases(value: object): Record<string, unknown> {
  return Object.fromEntries(aliases(value).map(key => [key, structuredClone((value as Record<string, unknown>)[key])]))
}
export function groupedCashPeriod(value: unknown): GroupedCashPeriod | null {
  return record(value) && Object.keys(value).sort().join(',') === 'CurrencyBasis,Version'
    && value.Version === 1 && value.CurrencyBasis === 'AccountAndManagementCurrency' ? defaultGroupedCashPeriod() : null
}
export function isGroupedCashCapability(value: unknown): boolean {
  return record(value) && value.Version === 1 && value.MaximumDays === 31
    && value.CurrencyBasis === 'AccountAndManagementCurrency' && value.UsesCurrentNativeAccounts === true
    && value.PreservesUnavailableValues === true && value.RequiresCommonSourceObservation === false
    && exact(value.FixedRowGroupings, [43, 40, 42, 41]) && exact(value.FixedMeasurements, [84, 85, 86, 87, 92, 93, 94, 95])
    && exact(value.Filters, GROUPED_CASH_FILTERS) && exact(value.RegisterKinds, [1, 2])
    && (value.RowLayouts === undefined || Array.isArray(value.RowLayouts) && value.RowLayouts.length === 2
      && exact(value.RowLayouts[0], [43, 40, 42, 41]) && exact(value.RowLayouts[1], CASH_WORKBOOK_ROWS))
}
export const groupedCashSupported = (dataset?: ReportDataset) => dataset?.DataSource === 40
  && isGroupedCashCapability(dataset.groupedCashPeriod)
export function groupedCashWorkbookSupported(dataset?: ReportDataset): boolean {
  const capability = dataset?.groupedCashPeriod
  return groupedCashSupported(dataset) && record(capability) && Array.isArray(capability.RowLayouts)
    && exact(capability.RowLayouts[1], CASH_WORKBOOK_ROWS)
}
export function normalizeGroupedCashDataset(value: Record<string, unknown>): ReportDataset | null {
  const keys = aliases(value)
  if (keys.length > 1) return null
  const raw = keys.length ? value[keys[0]] : undefined
  if (raw != null && (value.DataSource !== 40 || !isGroupedCashCapability(raw))) return null
  const normalized = { ...value }
  for (const key of keys) delete normalized[key]
  if (raw != null) normalized.groupedCashPeriod = structuredClone(raw)
  return normalized as ReportDataset
}
/** Saved scalar requests retain their exact account picker and no-filter form. */
export function cashFormDataset(dataset: ReportDataset | undefined, grouped: unknown): ReportDataset | undefined {
  return dataset?.DataSource === 40 && grouped == null ? { ...dataset, Filters: [], FilterExpression: undefined } : dataset
}
export function groupedCashConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (aliases(data).length > 1) return 'Багаторахунковий режим задано двічі.'
  const raw = requestGroupedCashPeriod(data)
  if (raw == null) return null
  if (data.dataSource !== 40) return 'Багаторахунковий режим належить лише звіту коштів.'
  if (!groupedCashPeriod(raw)) return 'Оберіть рахунки у власній та управлінській валюті.'
  if (dataset && !groupedCashSupported(dataset)) return 'Сервер ще не підтримує звіт за кількома рахунками.'
  const workbookError = workbookConfigurationError(data, dataset)
  if (workbookError) return workbookError
  const allowed = new Set(['datasource', 'from', 'to', 'sorted', 'selections', 'groupedcashperiod', 'workbookpresentation'])
  if (Object.entries(data).some(([key, value]) => !allowed.has(key.toLowerCase()) && value != null))
    return 'Рахунки не поєднуються з точним записом або іншими перетвореннями.'
  if (!Array.isArray(data.selections) || data.selections.some(selection => selection?.IsChecked !== false
    && (!(GROUPED_CASH_FILTERS as readonly number[]).includes(selection?.SelectedField?.Type)
      || ![0, 1, 2, 4].includes(selection?.FilterCondition?.Type) || !Array.isArray(selection.Values)
      || !selection.Values.length || selection.Values.some(value => revenueExactId(value?.Data) === null
        || selection.SelectedField.Type === 33 && !['1', '2'].includes(revenueExactId(value.Data) ?? '')))))
    return 'Оберіть точні рахунки, організації, валюти або вид «Банк / Каса» з поточних списків.'
  return null
}
