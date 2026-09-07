import { useState } from 'react'
import type { ReportGroupingItem, ReportTemplate } from '../types'
import type { ReportGroupingLayout } from '../data/reportGroupingLayout'
import { reconcileReportOrdering } from '../data/reportOrdering'

/** Keep an explicit axis edit and its ordering rules in the same React update. */
export function useReportGroupingOrdering() {
  const [rowGroups, setRowGroups] = useState<ReportGroupingItem[]>([])
  const [colGroups, setColGroups] = useState<ReportGroupingItem[]>([])
  const [ordering, setOrdering] = useState<unknown>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  function loadOrdering(value: unknown) {
    setOrdering(structuredClone(value)); setNotice(null)
  }
  function changeOrdering(value: unknown) {
    setOrdering(value)
    setNotice(value === undefined ? 'Збережене сортування явно очищено. Використовується звичайний порядок.' : null)
  }
  function changeLayout(next: ReportGroupingLayout) {
    const adjusted = reconcileReportOrdering(ordering, { Row: rowGroups, Col: colGroups }, next)
    setRowGroups(next.Row); setColGroups(next.Col); setOrdering(adjusted.ordering)
    if (adjusted.removed.length) {
      const labels = new Map([...rowGroups, ...colGroups].map(group => [group.type, group.label]))
      setNotice(`Поле видалено з групування. Правила сортування для полів ${adjusted.removed.map(type => labels.get(type) ?? `[${type}]`).join(', ')} також видалено.`)
    } else if (adjusted.moved.length) setNotice('Правило сортування перенесено разом із полем на іншу вісь.')
  }
  function changeAxis(axis: 'Row' | 'Col', value: ReportGroupingItem[] | ((current: ReportGroupingItem[]) => ReportGroupingItem[])) {
    const current = axis === 'Row' ? rowGroups : colGroups
    changeLayout({ Row: rowGroups, Col: colGroups, [axis]: typeof value === 'function' ? value(current) : value })
  }
  function applyPreset(preset: ReportTemplate, apply: (template: ReportTemplate) => void) {
    const adjusted = reconcileReportOrdering(ordering, { Row: rowGroups, Col: colGroups }, preset.Data.sorted)
    apply({ ...preset, Data: { ...preset.Data, ...(adjusted.ordering !== undefined ? { ordering: adjusted.ordering } : {}) } })
    if (adjusted.removed.length) setNotice('Швидке налаштування змінило групування. Правила сортування видалених полів також видалено.')
  }
  return { rowGroups, setRowGroups, colGroups, setColGroups, ordering, notice, loadOrdering, changeOrdering, changeLayout, changeAxis, applyPreset }
}
