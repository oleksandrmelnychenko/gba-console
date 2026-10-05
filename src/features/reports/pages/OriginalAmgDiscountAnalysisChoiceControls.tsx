import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { amgDiscountAnalysisFields, type AmgDiscountAnalysisChoices, type AmgDiscountAnalysisField, type AmgDiscountAnalysisSelection } from '../data/originalAmgDiscountAnalysisChoices'
export function OriginalAmgDiscountAnalysisChoiceControls({ names, selection, busy, selectionBlocked = false, permitted, dateError, error, loading, onLoad, onSelect }: {
  names: AmgDiscountAnalysisChoices | null; selection: AmgDiscountAnalysisSelection; busy: boolean; selectionBlocked?: boolean; permitted: boolean; dateError: string | null; error: string | null;
  loading: boolean; onLoad: () => void; onSelect: (field: AmgDiscountAnalysisField, values: string[]) => void
}) {
  const { t } = useI18n()
  return <Stack gap="xs"><Button variant="light" disabled={!permitted || !!dateError || busy} loading={loading} onClick={onLoad}>{t('Оновити назви')}</Button>
    <Group grow>{amgDiscountAnalysisFields.map(field => <MultiSelect key={field} label={t(field === 'Контрагент' ? 'Контрагенти' : field)} value={selection[field]} searchable limit={100} maxValues={256}
      data={(names?.Choices[field] ?? []).map(c => ({ value: c.Reference, label: c.Deleted ? `${c.Caption} · ${t('позначено на видалення')}` : c.Caption }))}
      disabled={!permitted || busy || selectionBlocked || !names?.FieldAvailability[field]} onChange={values => onSelect(field, values)}
      description={!names?.FieldAvailability[field] ? t('Назви для відбору ще недоступні.') : undefined} />)}</Group>
    {error ? <Alert color="red">{t(error)}</Alert> : null}
    {names?.MissingFamilies.length ? <Text size="sm" c="dimmed">{t('Назви ще недоступні')}: {names.MissingFamilies.map(f => t(f)).join(', ')}.</Text> : null}
  </Stack>
}
