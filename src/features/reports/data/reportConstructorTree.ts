import type { ReportMeasurementGroup, ReportMeasurementItem, ReportMeasurementSelection } from '../types'

/** Presentation categories only: the dataset still decides which fields are executable. */
export function reportGroupingPath(type: number): string[] {
  if (type === 82) return ['Джерело даних']
  if ([0, 1, 2, 3].includes(type)) return ['Період']
  if ([5, 6, 7, 8, 9, 10, 28, 83].includes(type)) return ['Товар']
  if ([11, 12, 13, 14, 15, 16, 79, 80].includes(type)) return ['Покупець']
  if ([17, 18, 19, 20, 22, 23, 66, 67, 81].includes(type)) return ['Документ продажу']
  if ([21, 24, 25].includes(type)) return ['Постачальник']
  if ([29, 30, 31, 32, 33, 34].includes(type)) return ['Склад']
  return []
}

/** Keep the selected resource order across dataset refresh, date changes and template restore. */
export function retainMeasurementOrder(groups: ReportMeasurementGroup[], selected: ReportMeasurementSelection[]): ReportMeasurementGroup[] {
  const order = new Map<number, number>()
  for (const item of selected) if (item.IsChecked !== false && !order.has(item.Type)) order.set(item.Type, order.size)
  if (!order.size) return groups
  const rank = (type: number) => order.get(type) ?? Number.MAX_SAFE_INTEGER
  return groups.map(group => ({ ...group, SubList: group.SubList.toSorted((a, b) => rank(a.Type) - rank(b.Type)) }))
    .toSorted((a, b) => Math.min(...a.SubList.map(item => rank(item.Type))) - Math.min(...b.SubList.map(item => rank(item.Type))))
}

export function reorderMeasurementGroup(groups: ReportMeasurementGroup[], name: string, direction: -1 | 1): ReportMeasurementGroup[] {
  const index = groups.findIndex(group => group.Name === name), target = index + direction
  if (index < 0 || target < 0 || target >= groups.length) return groups
  const next = [...groups]; [next[index], next[target]] = [next[target], next[index]]
  return next
}

export function reorderMeasurementItem(groups: ReportMeasurementGroup[], type: number, direction: -1 | 1): ReportMeasurementGroup[] {
  return groups.map(group => {
    const index = group.SubList.findIndex(item => item.Type === type), target = index + direction
    if (index < 0 || target < 0 || target >= group.SubList.length) return group
    const SubList = [...group.SubList]; [SubList[index], SubList[target]] = [SubList[target], SubList[index]]
    return { ...group, SubList }
  })
}

const ukrainianMeasureOrder = new Intl.Collator('uk-UA', { numeric: true, sensitivity: 'base' })

/** One-shot tree ordering: keep membership, selection and equal-label manual order. */
export function alphabetizeMeasurements(groups: ReportMeasurementGroup[], direction: -1 | 1,
  groupLabel: (group: ReportMeasurementGroup) => string, itemLabel: (item: ReportMeasurementItem) => string): ReportMeasurementGroup[] {
  return groups.map(group => ({ ...group,
    SubList: group.SubList.toSorted((a, b) => direction * ukrainianMeasureOrder.compare(itemLabel(a), itemLabel(b))),
  })).toSorted((a, b) => direction * ukrainianMeasureOrder.compare(groupLabel(a), groupLabel(b)))
}
