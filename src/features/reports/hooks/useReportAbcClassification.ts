import { useState } from 'react'
import type { ReportDataset } from '../types'
import type { ReportGroupingLayout } from '../data/reportGroupingLayout'
import { ABC_CLASS_GROUPING } from '../data/reportAbcClassification'

/** Explicit toggle owns only the generated class; native axes and their ordering stay intact. */
export function useReportAbcClassification(layout: ReportGroupingLayout, changeLayout: (next: ReportGroupingLayout) => void, dataset?: ReportDataset) {
  const [value, setValue] = useState<unknown>(undefined)
  function load(raw: unknown) { setValue(structuredClone(raw)) }
  function change(next: unknown) {
    if (next === undefined) {
      changeLayout({ Row: layout.Row.filter(field => field.type !== ABC_CLASS_GROUPING), Col: layout.Col.filter(field => field.type !== ABC_CLASS_GROUPING) })
    } else if (value == null) {
      const field = dataset?.Groupings.find(item => item.Type === ABC_CLASS_GROUPING)
      if (!field || [...layout.Row, ...layout.Col].some(item => item.type === ABC_CLASS_GROUPING)) return
      changeLayout({ ...layout, Row: [{ type: field.Type, key: 'AbcClass', label: field.Name }, ...layout.Row] })
    }
    setValue(next)
  }
  return { value, load, change }
}
