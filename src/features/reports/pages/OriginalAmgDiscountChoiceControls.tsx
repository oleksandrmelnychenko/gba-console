import { Alert, Button, MultiSelect, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { amgDiscountFields, amgDiscountLabels, type AmgDiscountChoices, type AmgDiscountField, type AmgDiscountSelection } from '../data/originalAmgClientDiscounts'
export function OriginalAmgDiscountChoiceControls({ names, selection, busy, permitted, dateError, error, loading, onLoad, onSelect }: {
  names: AmgDiscountChoices | null; selection: AmgDiscountSelection; busy: boolean; permitted: boolean; dateError: string | null; error: string | null;
  loading: boolean; onLoad: () => void; onSelect: (field: AmgDiscountField, values: string[]) => void
}) {
  const { t } = useI18n()
  return <Stack gap="xs"><Button variant="light" disabled={!permitted || !!dateError || busy} loading={loading} onClick={onLoad}>{t('Завантажити актуальні назви')}</Button>
    {amgDiscountFields.map(field => <MultiSelect key={field} label={t(amgDiscountLabels[field])} value={selection[field]} searchable limit={100} maxValues={256}
      data={(names?.Choices[field] ?? []).map(c => ({ value: c.Key, label: c.Deleted ? `${c.Caption} · ${t('позначено на видалення')}` : c.Caption }))}
      disabled={!permitted || busy || !names?.FieldAvailability[field]} onChange={values => onSelect(field, values)} />)}
    {error ? <Alert color="red">{t(error)}</Alert> : null}
    {names?.MissingFamilies.length ? <Text size="sm" c="dimmed">{t('Назви ще недоступні')}: {names.MissingFamilies.map(f => t(amgDiscountLabels[f])).join(', ')}.</Text> : null}
  </Stack>
}
