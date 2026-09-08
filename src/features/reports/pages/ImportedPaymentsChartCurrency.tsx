import { Alert, Select, Stack, Text } from '@mantine/core'
import { useMemo, useState, type ReactNode } from 'react'
import { getPaymentChartCurrencyScope } from '../data/importedPaymentsChartCurrency'
import type { SpreadsheetRow, SpreadsheetSheet } from '../types'

type Props = {
  sheet: SpreadsheetSheet
  rows: SpreadsheetRow[]
  measurementIndex: number
  children: (rows: SpreadsheetRow[], currencyLabel: string) => ReactNode
}

export default function ImportedPaymentsChartCurrency({ sheet, rows, measurementIndex, children }: Props) {
  const scope = useMemo(() => getPaymentChartCurrencyScope(sheet, rows, measurementIndex), [sheet, rows, measurementIndex])
  const [selection, setSelection] = useState<{ sheet: SpreadsheetSheet; value: string } | null>(null)
  const selected = scope.fixedCurrency ?? (scope.options.length === 1 ? scope.options[0]
    : scope.options.find(option => selection?.sheet === sheet && option.value === selection.value))

  if (scope.status === 'empty') return <Alert color="gray">За поточними відборами немає рядків даних.</Alert>
  if (scope.status === 'missing-axis') return <Alert color="yellow">Для діаграми платежів додайте «Валюта рахунку» до рядків або колонок звіту та сформуйте файл знову. Без цього неможливо підтвердити, що суми належать одній валюті.</Alert>
  if (scope.status === 'ambiguous-axis') return <Alert color="yellow">Валюта рахунку одночасно в рядках і колонках робить структуру неоднозначною. Залиште це групування на одній осі та сформуйте файл знову.</Alert>
  if (scope.status === 'unknown-column') return <Alert color="yellow">Валюту вибраної колонки неможливо підтвердити. Виберіть показник колонки з відомою валютою або додайте «Валюта рахунку» до рядків звіту.</Alert>
  return <Stack gap="sm">
    {!scope.fixedCurrency && scope.options.length > 1 ? <Select label="Валюта діаграми" placeholder="Оберіть одну валюту" data={scope.options}
      value={selected?.value ?? null} allowDeselect={false} onChange={value => setSelection(value ? { sheet, value } : null)} /> : null}
    {scope.unknownRows ? <Alert color="yellow">Рядків із непідтвердженою валютою не показано: {scope.unknownRows}. Їхні значення залишаються в таблиці.</Alert> : null}
    {!selected ? <Alert color="yellow">{scope.options.length ? 'Оберіть валюту діаграми. Суми різних валют не порівнюються на одній шкалі.' : 'У вибраних рядках немає підтвердженої валюти. Діаграма недоступна; перевірте валюту рахунку.'}</Alert>
      : <><Text size="sm">Валюта діаграми: {selected.label}. Суми у власній валюті, без конвертації.</Text>{children(scope.rowsByCurrency.get(selected.value) ?? [], selected.label)}</>}
  </Stack>
}
