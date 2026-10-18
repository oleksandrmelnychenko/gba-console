import { Checkbox, Select, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { defaultGroupedSettlementBuyer, groupedSettlementPeriod, groupedSettlementRows,
  isGroupedSettlementDataset, groupedSettlementSupportsSuppliers, SETTLEMENT_CURRENCY_TOTALS_RULE } from '../data/groupedSettlementPeriod'
import { isSettlementPeriodDataset } from '../data/settlementPeriod'
import { sourceBuyerSubtree } from '../data/nativeExactFilters'
import { SettlementPeriodAgreementPicker } from './SettlementPeriodAgreementPicker'
import { GroupedDebtorWorkbookPanel } from './GroupedDebtorWorkbookPanel'
import { sourceCounterpartyGroupCapability } from '../data/sourceCounterpartyGroups'
import { CounterpartyGroupFilters } from './CounterpartyGroupFilters'
import { SettlementReadModeSelect } from './SettlementReadModeSelect'

type Props = {
  dataset: ReportDataset | undefined; grouped: unknown; exact: unknown; buyer: unknown; groups: unknown
  available: readonly ReportGroupingItem[]; rows: ReportGroupingItem[]; from: string; to: string
  disabled: boolean; enabled: boolean
  onModeChange: (mode: 'buyers' | 'agreement') => void
  onGroupedChange: (value: unknown) => void; onExactChange: (value: unknown) => void
  onBuyerChange: (value: unknown) => void; onRowsChange: (value: ReportGroupingItem[]) => void
  onGroupsChange: (value: unknown) => void
  readMode?: unknown; onReadModeChange?: (value: 0 | 1 | undefined) => void; hideRegisterReadMode?: boolean
  part?: 'source' | 'filters' | 'form'
}

export function SettlementPeriodModePanel({ dataset, grouped, exact, buyer, groups, available, rows, from, to,
  disabled, enabled, onModeChange, onGroupedChange, onExactChange, onBuyerChange, onRowsChange, onGroupsChange,
  readMode, onReadModeChange, hideRegisterReadMode = false, part }: Props) {
  const { t } = useI18n()
  if (!dataset || !isSettlementPeriodDataset(dataset)) return null
  const supported = isGroupedSettlementDataset(dataset)
  const selector = groupedSettlementPeriod(grouped)
  const isGroup = grouped != null
  const explicitSource = readMode != null
  const worlds = [{ value: 'Fenix', label: 'Fenix' }, ...(hideRegisterReadMode && selector?.SourceWorld !== 'Amg' ? [] : [{ value: 'Amg', label: 'AMG' }])]
  const lockedSource = hideRegisterReadMode && explicitSource
  const shows = (name: 'source' | 'filters' | 'form') => part === undefined || part === name
  if (part === 'form' && !(isGroup && supported)) return null
  return <Stack gap="sm">
    {shows('source') && supported && !(hideRegisterReadMode && isGroup) && <Select label={t('Обсяг взаєморозрахунків')} disabled={disabled} allowDeselect={false}
      value={isGroup ? 'buyers' : 'agreement'} data={[
        { value: 'buyers', label: t(groupedSettlementSupportsSuppliers(dataset) ? 'Поточні договори контрагентів' : 'Поточні договори покупців') },
        { value: 'agreement', label: t('Один точний договір') },
      ]} onChange={next => { if (next === 'buyers' || next === 'agreement') onModeChange(next) }} />}
    {isGroup && supported ? <>
      {shows('source') && onReadModeChange && <SettlementReadModeSelect capability={dataset.settlementReadMode} value={readMode}
        disabled={disabled} hideRegister={hideRegisterReadMode} onChange={onReadModeChange} />}
      {shows('source') && !(lockedSource && worlds.length <= 1) && <Select label={t('База взаєморозрахунків')} disabled={disabled || explicitSource} allowDeselect={false}
        value={selector?.SourceWorld ?? null} data={worlds}
        onChange={world => {
          if (world !== 'Fenix' && world !== 'Amg') return
          onGroupedChange({ Version: 1, SourceWorld: world, CurrencyBasis: 'SettlementCurrency' })
          onBuyerChange(world === 'Fenix' ? defaultGroupedSettlementBuyer() : undefined)
          if (world === 'Amg') onGroupsChange(undefined)
        }} />}
      {shows('form') && <Select label={t('Форма взаєморозрахунків')} disabled={disabled} allowDeselect={false}
        value={rows.map(row => row.type).join(',')} data={[
          { value: '4,41,76', label: t('Організація → валюта → контрагент') },
          { value: '4,76', label: t('Організація → контрагент') },
        ]} onChange={layout => {
          if (layout === '4,41,76' || layout === '4,76') onRowsChange(groupedSettlementRows(available, layout === '4,41,76'))
        }} />}
      {shows('filters') && selector?.SourceWorld === 'Fenix' && !lockedSource && <Checkbox label={t('Контрагенти у групі «Покупці» (Fenix)')}
        disabled={disabled || explicitSource} checked={sourceBuyerSubtree(buyer) !== null}
        onChange={event => onBuyerChange(event.currentTarget.checked ? defaultGroupedSettlementBuyer() : undefined)} />}
      {shows('filters') && selector?.SourceWorld === 'Fenix' && sourceCounterpartyGroupCapability(dataset.sourceCounterpartyGroups)
        && <CounterpartyGroupFilters value={groups} disabled={disabled || !enabled} onChange={onGroupsChange} />}
      {shows('filters') && <Text size="sm" c="dimmed">{t('Відбори використовують поточні договори нашої бази. Договори без повних даних за період залишаються з порожніми сумами; залежні підсумки також порожні. Непідтверджена належність до групи позначається окремо.')}</Text>}
      {shows('form') && <Text size="sm" c="dimmed">{t(explicitSource ? SETTLEMENT_CURRENCY_TOTALS_RULE
        : `Період — до 31 дня включно зі сьогодні. ${SETTLEMENT_CURRENCY_TOTALS_RULE}`)}</Text>}
    </> : shows('filters') ? <>
      <SettlementPeriodAgreementPicker value={exact} from={from} to={to} disabled={disabled}
        enabled={enabled} onChange={onExactChange} />
      {!supported && <GroupedDebtorWorkbookPanel from={from} to={to} disabled={disabled} enabled={enabled} />}
    </> : null}
  </Stack>
}
