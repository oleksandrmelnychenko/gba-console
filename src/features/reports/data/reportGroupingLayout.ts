import type { ReportGroupingItem } from '../types'

export type ReportGroupingAxis = 'Row' | 'Col'
export type ReportGroupingLayout = Record<ReportGroupingAxis, ReportGroupingItem[]>

/** Move only one exact supported identity; imported duplicate/unsupported fields remain intact. */
export function reorderReportGrouping(groups: ReportGroupingItem[], type: number, direction: -1 | 1, allowed: ReadonlySet<number>) {
  const index = groups.findIndex(group => group.type === type)
  const target = index + direction
  if (!allowed.has(type) || index < 0 || target < 0 || target >= groups.length || groups.filter(group => group.type === type).length !== 1) return groups
  const result = [...groups]
  ;[result[index], result[target]] = [result[target], result[index]]
  return result
}

export function canTransferReportGrouping(layout: ReportGroupingLayout, source: ReportGroupingAxis, type: number, allowed: ReadonlySet<number>) {
  const destination = source === 'Row' ? 'Col' : 'Row'
  return allowed.has(type) && layout[source].filter(group => group.type === type).length === 1
    && !layout[destination].some(group => group.type === type) && (source !== 'Row' || layout.Row.length > 1)
}

export function transferReportGrouping(layout: ReportGroupingLayout, source: ReportGroupingAxis, type: number, allowed: ReadonlySet<number>): ReportGroupingLayout {
  if (!canTransferReportGrouping(layout, source, type, allowed)) return layout
  const destination = source === 'Row' ? 'Col' : 'Row'
  const group = layout[source].find(item => item.type === type)!
  return { ...layout, [source]: layout[source].filter(item => item.type !== type), [destination]: [...layout[destination], group] }
}
