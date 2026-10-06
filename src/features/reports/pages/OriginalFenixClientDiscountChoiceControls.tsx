import { Alert, Button, MultiSelect, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { fenixDiscountFields, fenixDiscountLabels, type FenixDiscountChoices, type FenixDiscountField, type FenixDiscountSelection } from '../data/originalFenixClientDiscounts'
export function OriginalFenixClientDiscountChoiceControls({ names, selection, busy, permitted, dateError, error, loading, onLoad, onSelect }: {
  names: FenixDiscountChoices | null; selection: FenixDiscountSelection; busy: boolean; permitted: boolean; dateError: string | null; error: string | null;
  loading: boolean; onLoad: () => void; onSelect: (field: FenixDiscountField, values: string[]) => void
}) {
  const { t } = useI18n()
  return <Stack gap="xs"><Button variant="light" disabled={!permitted || !!dateError || busy} loading={loading} onClick={onLoad}>{t('Завантажити актуальні назви')}</Button>
    {fenixDiscountFields.map(field => <MultiSelect key={field} label={t(fenixDiscountLabels[field])} value={selection[field]} searchable limit={100} maxValues={256}
      data={(names?.Choices[field] ?? []).map(c => ({ value: c.Key, label: c.Deleted ? `${c.Caption} · ${t('позначено на видалення')}` : c.Caption }))}
      disabled={!permitted || busy || !names?.FieldAvailability[field]} onChange={values => onSelect(field, values)} />)}
    {error ? <Alert color="red">{t(error)}</Alert> : null}
    {names?.MissingFamilies.length ? <Text size="sm" c="dimmed">{t('Назви ще недоступні')}: {names.MissingFamilies.map(f => t(fenixDiscountLabels[f])).join(', ')}.</Text> : null}
  </Stack>
}
