import { Button, Popover, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { formatDebtAmount } from '../model/debtorCurrency'
import { getAgingDateLabel, getAgingUnknownCount, getKnownAgingDays, type AgingCurrencySource } from '../model/debtorAging'
import type { DebtAging } from '../types'

const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** One compact disclosure shared by register, drawer and sale/payment read summaries. */
export function DebtAgingInfo({ aging, currencies = [], compact = false }: { aging?: DebtAging | null; currencies?: AgingCurrencySource[]; compact?: boolean }) {
  const { t } = useI18n()
  if (aging === undefined) return null
  const label = getAgingInfoLabel(aging, compact, t)

  return <Popover position="bottom-start" withinPortal shadow="md" width={360}>
    <Popover.Target><Button color={aging?.HasCompleteAging === true ? 'gray' : 'orange'} size="compact-xs" variant="subtle" onClick={(event) => event.stopPropagation()}>{label}</Button></Popover.Target>
    <Popover.Dropdown onClick={(event) => event.stopPropagation()}>
      <Stack gap="xs">
        {aging ? <AgingBreakdown aging={aging} currencies={currencies} /> : <Text size="sm">{t('Не визначено')}</Text>}
      </Stack>
    </Popover.Dropdown>
  </Popover>
}

function getAgingInfoLabel(aging: DebtAging | null, compact: boolean, t: (value: string) => string): string {
  if (compact && aging?.HasCompleteAging !== true) return t('Неповні дані')
  if (!aging) return t('Строки не визначено')
  if (getAgingUnknownCount(aging) === 0) return t('Розрахунок строків')
  return `${t('Невідома дата')}: ${aging.UnknownDateDebtCount} · ${t('Невідомий строк')}: ${aging.UnknownTermsDebtCount}`
}

function AgingBreakdown({ aging, currencies }: { aging: DebtAging; currencies: AgingCurrencySource[] }) {
  const { t } = useI18n()
  const businessDay = getAgingDateLabel(aging.AsOfBusinessDay)
  return <>
    {businessDay ? <Text size="xs">{t('Станом на')}: {businessDay} ({t('Київ')})</Text> : null}
    {aging.TermBasis === 'current_agreement' ? <Text size="xs">{t('За чинними умовами договорів')}</Text> : null}
    <Text size="xs">{t('Макс. відоме прострочення, днів')}: {getKnownAgingDays(aging) ?? t('Не визначено')}</Text>
    <AgingBucket aging={aging} currencies={currencies} field="KnownOverdue" label={t('Відоме прострочення')} />
    {aging.UnknownDateDebtCount > 0 ? <AgingBucket aging={aging} currencies={currencies} field="UnknownDateDebt" label={t('Невідома дата')} /> : null}
    {aging.UnknownTermsDebtCount > 0 ? <AgingBucket aging={aging} currencies={currencies} field="UnknownTermsDebt" label={t('Невідомий строк')} /> : null}
    {!aging.HasCompleteAging ? <Text size="xs" c="dimmed">{t('Суми з невідомою датою або строком входять у борг, але не у відоме прострочення.')}</Text> : null}
  </>
}

function AgingBucket({ aging, currencies, field, label }: {
  aging: DebtAging
  currencies: AgingCurrencySource[]
  field: 'KnownOverdue' | 'UnknownDateDebt' | 'UnknownTermsDebt'
  label: string
}) {
  const { t } = useI18n()
  const count = aging[`${field}Count`]
  return <Stack gap={2}>
    <Text size="sm" fw={600}>{label} · {count} {t('боргів')}</Text>
    {currencies.filter((item) => (item.Aging?.[`${field}Count`] ?? 0) > 0).map((item) => (
      <Text key={item.CurrencyCode || 'local'} size="sm" className="app-money">
        {formatDebtAmount(item.Aging?.[field], money.format, t('Не визначено'))} {item.CurrencyCode || t('Локальні валюти')}
      </Text>
    ))}
    <Text size="sm" className="app-money">{formatDebtAmount(aging[`${field}Euro`], money.format, t('Не визначено'))} EUR</Text>
  </Stack>
}
