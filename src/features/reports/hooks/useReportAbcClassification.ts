import { useState } from 'react'
import type { ReportDataset } from '../types'
import type { ReportGroupingLayout } from '../data/reportGroupingLayout'
import { ABC_CLASS_GROUPING } from '../data/reportAbcClassification'

/** Explicit toggle owns only the generated class; native axes and their ordering stay intact. */
export function useReportAbcClassification(layout: ReportGroupingLayout, changeLayout: (next: ReportGroupingLayout) => void, dataset?: ReportDataset) {
  const [value, setValue] = useState<unknown>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  function load(raw: unknown) { setValue(structuredClone(raw)); setNotice(null) }
  function change(next: unknown) {
    if (next === undefined) {
      changeLayout({ Row: layout.Row.filter(field => field.type !== ABC_CLASS_GROUPING), Col: layout.Col.filter(field => field.type !== ABC_CLASS_GROUPING) })
      setNotice('ABC вимкнено. Видалено поле «ABC-клас» і лише його відомі правила сортування; інші налаштування збережено.')
    } else if (value == null) {
      const field = dataset?.Groupings.find(item => item.Type === ABC_CLASS_GROUPING)
      if (!field || [...layout.Row, ...layout.Col].some(item => item.type === ABC_CLASS_GROUPING)) return
      changeLayout({ ...layout, Row: [{ type: field.Type, key: 'AbcClass', label: field.Name }, ...layout.Row] })
      setNotice('Поле «ABC-клас» додано першим у рядках. Його порядок можна змінити в групуванні.')
    }
    setValue(next)
  }
  return { value, notice, load, change }
}
