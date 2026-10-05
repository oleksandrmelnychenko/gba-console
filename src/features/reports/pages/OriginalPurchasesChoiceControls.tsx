import { Alert, Button, Group, MultiSelect, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { purchasesFilterLabels, purchasesFilters, type PurchasesField } from '../data/originalPurchases'
import type { PurchasesChoices, PurchasesSelections } from '../data/originalPurchasesChoices'
import type { usePurchasesNamedChoices } from '../hooks/usePurchasesNamedChoices'

function PurchasesNamesStatus({ named, error }: { named: PurchasesChoices | null; error: string | null }) {
  const { t } = useI18n()
  return <>
    {error ? <Alert color="yellow">{t(error)}</Alert> : null}
    <Text size="sm" c="dimmed">{t('Відбори доступні окремо для кожного поля після завантаження його назв. Формування без відборів не потребує назв.')}</Text>
    {named ? <Text size="sm" c="dimmed">{t('Назви ще недоступні')}: {named.MissingFamilies.map(field => t(purchasesFilterLabels[field])).join(', ')}.</Text> : null}
    {named && purchasesFilters.some(field => named.FieldAvailability[field] && !named.Choices[field].length)
      ? <Text size="sm" c="dimmed">{t('Для перевірених порожніх полів немає варіантів відбору.')}</Text> : null}
  </>
}
export function OriginalPurchasesChoiceControls({ names, selection, busy, permitted, periodError, onSelect, onLoad }: {
  names: ReturnType<typeof usePurchasesNamedChoices>; selection: PurchasesSelections; busy: boolean; permitted: boolean;
  periodError: string | null; onSelect: (field: PurchasesField, keys: string[]) => void; onLoad: () => void
}) {
  const { t } = useI18n(), named = names.run.lastRun
  return <>
    <Group grow>{purchasesFilters.map(field => {
      const available = named?.OurSnapshotVerified === true && named.FieldAvailability[field]
      return <MultiSelect key={field} label={t(purchasesFilterLabels[field])}
        data={available ? named.Choices[field].map(choice => ({ value: choice.Key, label: choice.Deleted ? `${choice.Caption} (${t('позначено на видалення')})` : choice.Caption })) : []}
        value={available ? selection[field] : []} disabled={!available || busy || !permitted} maxValues={256} searchable limit={100}
        placeholder={t(available ? named.Choices[field].length ? 'Усі' : 'Немає варіантів відбору' : 'Назви ще недоступні')}
        onChange={keys => onSelect(field, keys)} />
    })}</Group>
    <Button variant="light" disabled={!names.permitted || !!periodError || busy} loading={names.run.isLoading} onClick={onLoad}>{t('Завантажити назви')}</Button>
    <PurchasesNamesStatus named={named} error={names.run.error} />
  </>
}
