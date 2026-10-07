import { Checkbox, MultiSelect, Stack, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { availabilityDateInput, availabilityFields, availabilityFilterKey, availabilityLabels, type AvailabilityChoice, type AvailabilityField, type AvailabilityFilter } from '../data/originalCashAvailability'
function ChoiceField({ field, choices, filters, busy, select }: { field: AvailabilityField; choices: AvailabilityChoice[]; filters: AvailabilityFilter[]; busy: boolean; select: (field: AvailabilityField, keys: string[]) => void }) {
  const { t } = useI18n(), options = choices.filter(v => v.Value.Field === field).map(v => ({ value: availabilityFilterKey(v.Value), label: v.Caption })), values = filters.filter(v => v.Field === field).map(availabilityFilterKey)
  return <MultiSelect label={t(availabilityLabels[field])} data={options} value={values} searchable clearable limit={50} maxValues={256} disabled={busy || (!options.length && !values.length)}
    placeholder={t(options.length ? 'Усі; оберіть потрібні значення' : 'Назви для відбору з’являться після формування')} onChange={keys => select(field, keys)} clearButtonProps={{ 'aria-label': `${t('Очистити')} ${t(availabilityLabels[field])}` }} />
}
export function OriginalCashAvailabilityControls({ dateKon, choices, filters, dimensions, management, busy, changeDate, select, changeDimensions, changeManagement }: {
  dateKon: string; choices: AvailabilityChoice[]; filters: AvailabilityFilter[]; dimensions: AvailabilityField[]; management: boolean; busy: boolean;
  changeDate: (value: string) => void; select: (field: AvailabilityField, keys: string[]) => void; changeDimensions: (values: AvailabilityField[]) => void; changeManagement: (value: boolean) => void
}) {
  const { t } = useI18n()
  return <Stack gap="sm"><TextInput type="datetime-local" step={1} label={t('Дата й час залишку')} value={dateKon} onChange={event => changeDate(availabilityDateInput(event.currentTarget.value))} />
    {[availabilityFields[0], availabilityFields[2], availabilityFields[1], availabilityFields[3]].map(field => <ChoiceField key={field} field={field} choices={choices} filters={filters} busy={busy} select={select} />)}
    <MultiSelect label={t('Рядки звіту')} data={availabilityFields.map(field => ({ value: field, label: t(availabilityLabels[field]) }))} value={dimensions} disabled={busy} clearable
      placeholder={t('Лише загальні суми')} onChange={values => changeDimensions(values as AvailabilityField[])} />
    <Checkbox label={t('Додати управлінські суми')} checked={management} disabled={busy} onChange={event => changeManagement(event.currentTarget.checked)} /></Stack>
}
