import { Button, Checkbox, Group, MultiSelect, Select, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { orderAnalysisFieldLabels, orderAnalysisFilterFields, orderAnalysisFilterKey, orderAnalysisRowOptions, type OrderAnalysisCapability, type OrderAnalysisField, type OrderAnalysisFilter, type OrderAnalysisState } from '../data/originalOrderAnalyses'
import { orderAnalysisMeasureLabel, orderAnalysisPaymentLabels, orderAnalysisShipmentLabels } from '../data/originalOrderAnalysisLabels'
import type { OrderAnalysisChoice } from '../data/originalOrderAnalysisResponse'
function NamedOrderFilter({ field, choices, filters, busy, select }: { field: OrderAnalysisField; choices: OrderAnalysisChoice[]; filters: OrderAnalysisFilter[]; busy: boolean; select: (field: OrderAnalysisField, key: string | null) => void }) {
  const { t } = useI18n(), options = choices.filter(v => v.Field === field).map(v => ({ value: orderAnalysisFilterKey(v), label: v.Caption })), value = filters.find(v => v.Field === field)
  return <Select label={t(orderAnalysisFieldLabels[field])} searchable clearable limit={50} data={options} value={value ? orderAnalysisFilterKey(value) : null} disabled={busy || !options.length && !value}
    placeholder={t(options.length ? 'Усі' : 'Назви для відбору поки недоступні')} onChange={key => select(field, key)} />
}
function StateSubset({ title, labels, values, busy, change }: { title: string; labels: readonly string[]; values: OrderAnalysisState[] | null; busy: boolean; change: (values: OrderAnalysisState[] | null) => void }) {
  const { t } = useI18n()
  return <Stack gap="xs"><Checkbox label={t(title)} disabled={busy} checked={values !== null} onChange={event => change(event.currentTarget.checked ? [0, 1, 2] : null)} />
    {values !== null ? <><MultiSelect label={t('Вибрані стани') + ' · ' + t(title)} disabled={busy} data={labels.map((label, i) => ({ value: String(i), label: t(label) }))} value={values.map(String)}
      onChange={items => change(items.map(v => Number(v) as OrderAnalysisState))} />
      <Button variant="subtle" size="compact-sm" disabled={busy || values.length === 0} onClick={() => change([])}>{t('Очистити вибрані стани') + ' · ' + t(title)}</Button></> : null}</Stack>
}
export function OriginalOrderAnalysisControls({ capability, from, through, rows, measures, filters, choices, shipment, payment, busy, choicesBusy, changePeriod, changeRows, changeMeasures, select, changeShipment, changePayment }: {
  capability: OrderAnalysisCapability; from: string; through: string; rows: OrderAnalysisField[]; measures: string[]; filters: OrderAnalysisFilter[]; choices: OrderAnalysisChoice[];
  shipment: OrderAnalysisState[] | null; payment: OrderAnalysisState[] | null; busy: boolean; choicesBusy: boolean;
  changePeriod: (field: 'from' | 'through', value: string) => void; changeRows: (v: OrderAnalysisField[]) => void; changeMeasures: (v: string[]) => void;
  select: (field: OrderAnalysisField, key: string | null) => void; changeShipment: (v: OrderAnalysisState[] | null) => void; changePayment: (v: OrderAnalysisState[] | null) => void
}) {
  const { t } = useI18n(), kind = capability.Definition.Kind
  return <Stack gap="sm"><Group><TextInput type="date" label={t('Початок періоду')} value={from} onChange={e => changePeriod('from', e.currentTarget.value)} />
    <TextInput type="date" label={t('Кінець періоду')} value={through} onChange={e => changePeriod('through', e.currentTarget.value)} /></Group>
    {orderAnalysisFilterFields(kind).map(field => <NamedOrderFilter key={field} field={field} choices={choices} filters={filters} busy={busy || choicesBusy} select={select} />)}
    <Text size="sm" c="dimmed">{t('Відбори використовують назви наших довідників. Одне значення на поле; різні поля застосовуються разом.')}</Text>
    <MultiSelect label={t('Рядки звіту')} value={rows.map(String)} disabled={busy} data={orderAnalysisRowOptions(kind).map(v => ({ value: String(v), label: t(orderAnalysisFieldLabels[v]) }))} clearable onChange={v => changeRows(v.map(x => Number(x) as OrderAnalysisField))} />
    <MultiSelect label={t('Показники')} value={measures} disabled={busy} data={capability.Measures.map(v => ({ value: v, label: t(orderAnalysisMeasureLabel(v)) }))} searchable onChange={changeMeasures} />
    <StateSubset title={kind === 2 ? 'Відбір за надходженням' : 'Відбір за відвантаженням'} labels={orderAnalysisShipmentLabels(kind)} values={shipment} busy={busy} change={changeShipment} />
    {kind !== 0 ? <StateSubset title="Відбір за оплатою" labels={orderAnalysisPaymentLabels} values={payment} busy={busy} change={changePayment} /> : null}
    <Text size="sm" c="dimmed">{t('Дні від 00:00:00 до 23:59:59 включно. Увімкнений відбір без вибраних станів не вибирає жодного стану.')}</Text>
    {kind === 0 ? <Text size="sm" c="dimmed">{t('Реєстратор і період доступні лише за наявності повного відповідного зрізу внутрішніх замовлень.')}</Text> : null}</Stack>
}
