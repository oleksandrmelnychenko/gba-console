import { Button, Group, Loader, MultiSelect, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

// Presentation shared by both period statements; data loading and access remain with each caller.
export function WarehousePeriodCapabilityStatus({ current, enabled, callerKey, disabled, retry }: {
  current: { failed: boolean } | null; enabled: boolean; callerKey: string | null; disabled: boolean; retry: () => void
}) {
  const { t } = useI18n()
  return <>
    {!current && enabled && callerKey ? <Loader size="xs" aria-label={t('Перевірка періодної відомості')} /> : null}
    {enabled && !callerKey ? <Text size="xs">{t('Для формування потрібен чинний сеанс користувача.')}</Text> : null}
    {current?.failed ? <><Text size="xs">{t('Не вдалося перевірити періодну відомість.')}</Text><Button variant="subtle" disabled={disabled} onClick={retry}>{t('Повторити')}</Button></> : null}
  </>
}

export function WarehousePeriodFilters({ from, through, products, warehouses, productChoices, warehouseChoices, warehouseSupported, busy,
  changeFrom, changeThrough, selectProducts, selectWarehouses }: {
  from: string; through: string; products: string[]; warehouses: string[]; productChoices: { value: string; label: string }[]; warehouseChoices: { value: string; label: string }[];
  warehouseSupported: boolean; busy: boolean; changeFrom: (value: string) => void; changeThrough: (value: string) => void;
  selectProducts: (value: string[]) => void; selectWarehouses: (value: string[]) => void
}) {
  const { t } = useI18n()
  return <>
    <OriginalPeriodDateProductFilters from={from} through={through} products={products} productChoices={productChoices} busy={busy}
      changeFrom={changeFrom} changeThrough={changeThrough} selectProducts={selectProducts} />
    {warehouseSupported ? <MultiSelect label={t('Склади')} placeholder={t('Усі склади; підтверджені назви з’являться після формування')}
      data={warehouseChoices} value={warehouses} searchable clearable maxValues={256} disabled={busy || !warehouseChoices.length}
      onChange={selectWarehouses} /> : <Text size="sm" c="dimmed">{t('Відбір за складом недоступний на цій версії сервера.')}</Text>}
  </>
}

// Same calendar and product equality presentation; each original supplies its own remaining filters.
export function OriginalPeriodDateProductFilters({ from, through, products, productChoices, busy, changeFrom, changeThrough, selectProducts }: {
  from: string; through: string; products: string[]; productChoices: { value: string; label: string }[]; busy: boolean;
  changeFrom: (value: string) => void; changeThrough: (value: string) => void; selectProducts: (value: string[]) => void
}) {
  const { t } = useI18n()
  return <>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={e => changeFrom(e.currentTarget.value)} />
      <TextInput type="date" label={t('Кінець періоду')} value={through} disabled={busy} onChange={e => changeThrough(e.currentTarget.value)} /></Group>
    <MultiSelect label={t('Товари')} placeholder={t('Усі товари; назви для відбору з’являться після формування')} data={productChoices} value={products} searchable clearable
      disabled={busy || !productChoices.length} onChange={selectProducts} maxValues={256} />
  </>
}
