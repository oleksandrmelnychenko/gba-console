import { useState } from 'react'
import type { ReportGroupingItem, ReportTemplate } from '../types'
import type { ReportGroupingLayout } from '../data/reportGroupingLayout'
import { reconcileReportOrdering } from '../data/reportOrdering'

/** Keep an explicit axis edit and its ordering rules in the same React update. */
export function useReportGroupingOrdering() {
  const [rowGroups, setRowGroups] = useState<ReportGroupingItem[]>([])
  const [colGroups, setColGroups] = useState<ReportGroupingItem[]>([])
  const [ordering, setOrdering] = useState<unknown>(undefined)
  function loadOrdering(value: unknown) {
    setOrdering(structuredClone(value))
  }
  function changeOrdering(value: unknown) {
    setOrdering(value)
  }
  function changeLayout(next: ReportGroupingLayout) {
    const adjusted = reconcileReportOrdering(ordering, { Row: rowGroups, Col: colGroups }, next)
    setRowGroups(next.Row); setColGroups(next.Col); setOrdering(adjusted.ordering)
  }
  function changeAxis(axis: 'Row' | 'Col', value: ReportGroupingItem[] | ((current: ReportGroupingItem[]) => ReportGroupingItem[])) {
    const current = axis === 'Row' ? rowGroups : colGroups
    changeLayout({ Row: rowGroups, Col: colGroups, [axis]: typeof value === 'function' ? value(current) : value })
  }
  function applyPreset(preset: ReportTemplate, apply: (template: ReportTemplate) => void) {
    const adjusted = reconcileReportOrdering(ordering, { Row: rowGroups, Col: colGroups }, preset.Data.sorted)
    apply({ ...preset, Data: { ...preset.Data, ...(adjusted.ordering !== undefined ? { ordering: adjusted.ordering } : {}) } })
  }
  return { rowGroups, setRowGroups, colGroups, setColGroups, ordering, loadOrdering, changeOrdering, changeLayout, changeAxis, applyPreset }
}
