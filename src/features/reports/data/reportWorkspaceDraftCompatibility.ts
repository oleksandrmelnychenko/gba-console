import type { ReportDataset } from '../types'
import { getNativeReportProfile, hasFixedReportAxes } from './nativeReportProfiles'
import type { ReportWorkspaceSnapshot } from './reportWorkspaceDraft'

const options = ['comparison', 'xyz', 'paymentComparison', 'marginComparison', 'rateComparison',
  'returnComparison', 'buyerSalesShare', 'revenueComparison', 'ordering', 'filterExpression',
  'abcClassification', 'hideZero', 'threshold', 'topGroups']

/** Recovery checks what the current editor can represent, not whether an unfinished report can run. */
export function reportWorkspaceDraftCompatibility(snapshot: ReportWorkspaceSnapshot, dataset?: ReportDataset): string | null {
  const { data, measurements } = snapshot
  if (!dataset || dataset.DataSource !== (data.dataSource ?? 0) || data.dataSource === 1 || data.oneC != null) {
    return 'Набір даних чернетки зараз недоступний. Чернетка збережена без змін.'
  }
  if (dataset.PeriodSupported === false && (data.from || data.to)) {
    return 'Чернетка містить період, який цей набір даних не підтримує. Чернетка збережена без змін.'
  }
  const groupings = new Set(dataset.Groupings.map(field => field.Type))
  const measures = new Set(dataset.Measurements.map(field => field.Type))
  if ([...data.sorted.Row, ...data.sorted.Col].some(field => !groupings.has(field.type))
    || measurements.some(group => group.SubList.some(field => field.IsChecked && !measures.has(field.Type)))
    || data.sorted.Measurements.some(field => !measures.has(field.Type))) {
    return 'Склад полів набору даних змінився. Чернетка збережена; невідомі поля не видалено.'
  }
  if ((data.dataSource === 13 && data.sorted.Col.length > 0)
    || (hasFixedReportAxes(dataset.DataSource) && (data.sorted.Col.length > 0
      || JSON.stringify(data.sorted.Row.map(field => field.type)) !== JSON.stringify(getNativeReportProfile(dataset.DataSource)?.rowGroupings)))
    || (data.dataSource === 19 && data.selections.length > 0)) {
    return 'Структура чернетки несумісна з цим набором даних. Чернетка збережена без змін.'
  }
  const keys = Object.keys(data)
  if (options.some(option => {
    const aliases = keys.filter(key => key.toLowerCase() === option.toLowerCase())
    return aliases.length > 1 || aliases.some(key => key !== option && key !== option[0].toUpperCase() + option.slice(1))
  })) {
    return 'Чернетка містить неоднозначні назви налаштувань. Оригінал збережено; автоматичні виправлення не застосовано.'
  }
  return null
}
