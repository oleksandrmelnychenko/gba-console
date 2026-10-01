import { Checkbox, Select, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { defaultGroupedSettlementBuyer, groupedSettlementPeriod, groupedSettlementRows,
  isGroupedSettlementDataset } from '../data/groupedSettlementPeriod'
import { isSettlementPeriodDataset } from '../data/settlementPeriod'
import { sourceBuyerSubtree } from '../data/nativeExactFilters'
import { SettlementPeriodAgreementPicker } from './SettlementPeriodAgreementPicker'
import { GroupedDebtorWorkbookPanel } from './GroupedDebtorWorkbookPanel'
import { sourceCounterpartyGroupCapability } from '../data/sourceCounterpartyGroups'
import { CounterpartyGroupFilters } from './CounterpartyGroupFilters'

type Props = {
  dataset: ReportDataset | undefined; grouped: unknown; exact: unknown; buyer: unknown; groups: unknown
  available: readonly ReportGroupingItem[]; rows: ReportGroupingItem[]; from: string; to: string
  disabled: boolean; enabled: boolean
  onModeChange: (mode: 'buyers' | 'agreement') => void
  onGroupedChange: (value: unknown) => void; onExactChange: (value: unknown) => void
  onBuyerChange: (value: unknown) => void; onRowsChange: (value: ReportGroupingItem[]) => void
  onGroupsChange: (value: unknown) => void
}

export function SettlementPeriodModePanel({ dataset, grouped, exact, buyer, groups, available, rows, from, to,
  disabled, enabled, onModeChange, onGroupedChange, onExactChange, onBuyerChange, onRowsChange, onGroupsChange }: Props) {
  const { t } = useI18n()
  if (!dataset || !isSettlementPeriodDataset(dataset)) return null
  const supported = isGroupedSettlementDataset(dataset)
  const selector = groupedSettlementPeriod(grouped)
  const isGroup = grouped != null
  return <Stack gap="sm">
    {supported && <Select label={t('Обсяг взаєморозрахунків')} disabled={disabled} allowDeselect={false}
      value={isGroup ? 'buyers' : 'agreement'} data={[
        { value: 'buyers', label: t('Поточні договори покупців') },
        { value: 'agreement', label: t('Один точний договір') },
      ]} onChange={next => { if (next === 'buyers' || next === 'agreement') onModeChange(next) }} />}
    {isGroup && supported ? <>
      <Select label={t('База взаєморозрахунків')} disabled={disabled} allowDeselect={false}
        value={selector?.SourceWorld ?? null} data={[{ value: 'Fenix', label: 'Fenix' }, { value: 'Amg', label: 'AMG' }]}
        onChange={world => {
          if (world !== 'Fenix' && world !== 'Amg') return
          onGroupedChange({ Version: 1, SourceWorld: world, CurrencyBasis: 'SettlementCurrency' })
          onBuyerChange(world === 'Fenix' ? defaultGroupedSettlementBuyer() : undefined)
          if (world === 'Amg') onGroupsChange(undefined)
        }} />
      <Select label={t('Форма взаєморозрахунків')} disabled={disabled} allowDeselect={false}
        value={rows.map(row => row.type).join(',')} data={[
          { value: '4,41,76', label: t('Організація → валюта → контрагент') },
          { value: '4,76', label: t('Організація → контрагент') },
        ]} onChange={layout => {
          if (layout === '4,41,76' || layout === '4,76') onRowsChange(groupedSettlementRows(available, layout === '4,41,76'))
        }} />
      {selector?.SourceWorld === 'Fenix' && <Checkbox label={t('Контрагенти у групі «Покупці» (Fenix)')}
        disabled={disabled} checked={sourceBuyerSubtree(buyer) !== null}
        onChange={event => onBuyerChange(event.currentTarget.checked ? defaultGroupedSettlementBuyer() : undefined)} />}
      {selector?.SourceWorld === 'Fenix' && sourceCounterpartyGroupCapability(dataset.sourceCounterpartyGroups)
        && <CounterpartyGroupFilters value={groups} disabled={disabled || !enabled} onChange={onGroupsChange} />}
      <Text size="sm" c="dimmed">{t('Відбори використовують поточні договори нашої бази. Договори без повних даних за період залишаються з порожніми сумами; залежні підсумки також порожні. Непідтверджена належність до групи позначається окремо.')}</Text>
      <Text size="sm" c="dimmed">{t('Період — до 31 дня включно зі сьогодні. Суми різних валют не додаються; за потреби оберіть форму з валютою.')}</Text>
    </> : <>
      <SettlementPeriodAgreementPicker value={exact} from={from} to={to} disabled={disabled}
        enabled={enabled} onChange={onExactChange} />
      {!supported && <GroupedDebtorWorkbookPanel from={from} to={to} disabled={disabled} enabled={enabled} />}
    </>}
  </Stack>
}
