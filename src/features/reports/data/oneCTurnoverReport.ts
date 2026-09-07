import type { OneCTurnoverScopeSummary, ReportRequestBody } from '../types'
import { createDefaultMeasurementGroups, flattenCheckedMeasurements, flattenGroupingOptions } from './reportOptions'

export const ONE_C_REPORT_LAYOUTS = [
  { id: 'responsibles', name: 'За відповідальними 1С', row: ['Organization', 'SourceSaleResponsible'], col: ['SourceOrderResponsible'], measures: [2, 4] },
  { id: 'daily', name: 'Оборот за днями', row: ['Day', 'Organization'], col: [], measures: [0, 2, 3, 4] },
  { id: 'articles', name: 'Оборот за артикулами', row: ['ProductArticle'], col: [], measures: [0, 2, 3, 4] },
] as const

export type OneCReportLayoutId = typeof ONE_C_REPORT_LAYOUTS[number]['id']

/** Refuse unsupported dates without letting JavaScript roll an invalid calendar day forward. */
export function oneCReportPeriodError(from: string, to: string): string | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN
  }
  const start = parse(from), end = parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || from < '2000-01-01' || to > '7998-12-31')
    return 'Задайте обидві коректні дати звіту 1С.'
  if (end < start) return 'Початок періоду пізніший за кінець.'
  if ((end - start) / 86_400_000 >= 366) return 'Звіт 1С підтримує період від 1 до 366 днів.'
  return null
}

/** This payload is independent of operational filters and contains only supported measures. */
export function createOneCTurnoverReport(
  scope: OneCTurnoverScopeSummary, layoutId: OneCReportLayoutId, from: string, to: string,
): ReportRequestBody {
  const error = oneCReportPeriodError(from, to)
  if (error) throw new Error(error)
  const layout = ONE_C_REPORT_LAYOUTS.find(item => item.id === layoutId)
  if (!layout) throw new Error('Невідома структура звіту 1С.')
  const groupings = new Map(flattenGroupingOptions().map(group => [group.key, group]))
  const measures = new Set<number>(layout.measures)
  const grouping = (key: string) => {
    const item = groupings.get(key)
    if (!item) throw new Error('Непідтримуване групування звіту 1С.')
    return { ...item }
  }
  const allMeasures = createDefaultMeasurementGroups().map(group => ({
    ...group, IsChecked: true, SubList: group.SubList.map(measure => ({ ...measure, IsChecked: true })),
  }))
  return {
    dataSource: 1, oneC: structuredClone(scope.Filters), from, to, selections: [],
    sorted: {
      Row: layout.row.map(grouping),
      Col: layout.col.map(grouping),
      Measurements: flattenCheckedMeasurements(allMeasures).filter(measure => measures.has(measure.Type)),
    },
  }
}
