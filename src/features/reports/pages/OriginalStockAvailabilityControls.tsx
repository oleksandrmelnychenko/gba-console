import { MultiSelect, Select, Stack, Text, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { stockAxes, stockAxisLabels, stockDateInput, stockMeasures, stockMeasureLabel, type StockAxis, type StockFilter, type StockMeasure } from '../data/originalStockAvailability'
import type { StockChoices } from '../data/originalStockAvailabilityResponse'
function NamedStockFilter({ field, choices, filters, busy, select }: { field: StockAxis; choices: StockChoices; filters: StockFilter[]; busy: boolean; select: (field: StockAxis, key: string | null) => void }) {
  const { t } = useI18n(), selected = filters.find(v => v.Field === field), options = useMemo(() => choices[field].map(v => ({ value: v.Key, label: v.Caption })), [choices, field])
  return <Select label={t(stockAxisLabels[field])} value={selected?.Key ?? null} data={options} searchable clearable limit={50} disabled={busy || (!choices[field].length && !selected)}
    placeholder={t(choices[field].length ? 'Усі' : 'Назви для відбору з’являться після формування')} onChange={key => select(field, key)} />
}
export function OriginalStockAvailabilityControls({ at, rows, measures, choices, filters, busy, changeDate, changeRows, changeMeasures, select }: {
  at: string; rows: StockAxis[]; measures: StockMeasure[]; choices: StockChoices; filters: StockFilter[]; busy: boolean;
  changeDate: (v: string) => void; changeRows: (v: StockAxis[]) => void; changeMeasures: (v: StockMeasure[]) => void; select: (field: StockAxis, key: string | null) => void
}) {
  const { t } = useI18n()
  return <Stack gap="sm"><TextInput type="datetime-local" step={1} label={t('Дата й час залишку')} value={at.replace(' ', 'T')} onChange={e => changeDate(stockDateInput(e.currentTarget.value))} />
    {stockAxes.map(field => <NamedStockFilter key={field} field={field} choices={choices} filters={filters} busy={busy} select={select} />)}
    <Text size="sm" c="dimmed">{t('Відбори використовують назви наших довідників. Одне значення на поле; різні поля застосовуються разом.')}</Text>
    <MultiSelect label={t('Рядки звіту')} value={rows} disabled={busy} data={stockAxes.map(a => ({ value: a, label: t(stockAxisLabels[a]) }))} onChange={v => changeRows(v as StockAxis[])} clearable />
    <MultiSelect label={t('Показники')} value={measures} disabled={busy} data={stockMeasures.map(m => ({ value: m, label: t(stockMeasureLabel(m)) }))} onChange={v => changeMeasures(v as StockMeasure[])} searchable />
    <Text size="sm" c="dimmed">{t('Залишок до точної секунди. Базові одиниці й одиниці звітів додаються лише за підтвердженим відповідним перерахунком. Відсутність додаткових назв не змінює звичайні показники.')}</Text></Stack>
}
