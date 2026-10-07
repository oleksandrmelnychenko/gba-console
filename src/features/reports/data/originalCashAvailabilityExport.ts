import { availabilityFields, availabilityLabels, availabilityManagementMeasures, availabilityOwnMeasures, availabilityFilterKey, type AvailabilityResult } from './originalCashAvailability'
import type { OriginalDefaultSheet } from './originalDefaultReportExport'
const titles = ['Поточний залишок', 'До списання', 'До отримання', 'У резерві', 'Вільний залишок']
export function availabilityColumnLabel(column: string): string {
  if (availabilityFields.includes(column as typeof availabilityFields[number])) return availabilityLabels[column as typeof availabilityFields[number]]
  const own = availabilityOwnMeasures.findIndex(v => v === column), managed = availabilityManagementMeasures.findIndex(v => v === column)
  return own >= 0 ? `У валюті рахунку / каси · ${titles[own]}` : `Управлінська сума · ${titles[managed]}`
}
export function availabilitySheet(result: AvailabilityResult): OriginalDefaultSheet {
  const choices = new Map(result.Choices.map(v => [availabilityFilterKey(v.Value), v.Caption]))
  const selected = result.Filters.map(v => `${availabilityLabels[v.Field]}: ${choices.get(availabilityFilterKey(v)) ?? 'Назва недоступна'}`)
  const unit = result.ManagementCurrency?.Code ?? 'одиниця недоступна'
  return { title: 'Доступні кошти Fenix', from: result.DateKon.replaceAll(':', '-'), through: result.DateKon.replaceAll(':', '-'), scopeLabel: `Стан перед ${result.DateKon.replace('T', ' ')}`,
    headers: result.Table.Columns.map(availabilityColumnLabel), labelColumns: result.RowDimensions.length,
    lines: result.Table.Rows.map((cells, index) => ({ key: String(index), cells: cells.map((v, column) => v ?? (column < result.RowDimensions.length ? 'Назва недоступна' : 'Недоступно')) })), total: null,
    note: [`Поточний залишок − до списання + до отримання − резерв.`, 'Власні суми збережено в одиницях рахунків / кас.',
      ...(result.IncludeManagement ? [`Управлінська валюта: ${unit}. Використано записані нормалізовані історичні курси.`] : []), ...selected].join(' ') }
}
