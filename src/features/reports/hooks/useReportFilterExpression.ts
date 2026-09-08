import { useState } from 'react'
import type { ReportSelection } from '../types'
import { readReportFilterExpression, removeFilterSelection } from '../data/reportFilterExpression'

export type ReportSelectionEdit =
  | { kind: 'append'; selection: ReportSelection }
  | { kind: 'replace'; index: number; selection: ReportSelection }
  | { kind: 'delete'; index: number }

type FilterState = { selections: ReportSelection[]; expression: unknown; notice: string | null }
/** Keep index-sensitive state together: duplicate-valued filters are still distinct array positions. */
export function useReportFilterExpression() {
  const [state, setState] = useState<FilterState>({ selections: [], expression: undefined, notice: null })
  function load(selections: ReportSelection[], expression: unknown = undefined) {
    setState({ selections: structuredClone(selections), expression: structuredClone(expression), notice: null })
  }
  function change(expression: unknown) {
    setState(current => ({ ...current, expression, notice: expression == null
      ? 'Груповану логіку явно очищено. Усі увімкнені умови знову поєднано через І.' : null }))
  }
  function editSelection(edit: ReportSelectionEdit) {
    setState(current => {
      if (edit.kind !== 'append' && !current.selections[edit.index]) return current
      if (edit.kind !== 'replace' && current.expression != null && !readReportFilterExpression(current.expression))
        return { ...current, notice: 'Індекси невідомого дерева не змінено. Спочатку перевірте логіку або явно очистіть її.' }
      if (edit.kind === 'append') return { ...current, selections: [...current.selections, edit.selection], notice: current.expression != null
        ? 'Нову умову ще не включено до логіки. Додайте її до потрібної групи; зміст І/АБО не змінюється автоматично.' : null }
      if (edit.kind === 'replace') return { ...current, selections: current.selections.map((selection, index) => index === edit.index ? edit.selection : selection), notice: null }
      return { selections: current.selections.filter((_, index) => index !== edit.index),
        expression: removeFilterSelection(current.expression, edit.index), notice: current.expression != null
          ? `Умову №${edit.index + 1} видалено з відборів і дерева. Номери наступних умов узгоджено; групи І/АБО збережено.` : null }
    })
  }
  return { ...state, load, change, editSelection }
}
