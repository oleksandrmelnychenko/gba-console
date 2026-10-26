import { Checkbox, Group, Select, Stack } from '@mantine/core'
import { ArrowLeftRight } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { defaultGroupedSettlementBuyer, groupedSettlementPeriod, groupedSettlementRows,
  isGroupedSettlementDataset, groupedSettlementSupportsSuppliers } from '../data/groupedSettlementPeriod'
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
  onExactChange: (value: unknown) => void
  onBuyerChange: (value: unknown) => void; onRowsChange: (value: ReportGroupingItem[]) => void
  onGroupsChange: (value: unknown) => void
  readMode?: unknown; onReadModeChange?: (value: 0 | 1 | undefined) => void; hideRegisterReadMode?: boolean
  part?: 'source' | 'filters' | 'form'
}

export function SettlementPeriodModePanel({ dataset, grouped, exact, buyer, groups, available, rows, from, to,
  disabled, enabled, onModeChange, onExactChange, onBuyerChange, onRowsChange, onGroupsChange,
  readMode, onReadModeChange, hideRegisterReadMode = false, part }: Props) {
  const { t } = useI18n()
  if (!dataset || !isSettlementPeriodDataset(dataset)) return null
  const supported = isGroupedSettlementDataset(dataset)
  const selector = groupedSettlementPeriod(grouped)
  const isGroup = grouped != null
  const explicitSource = readMode != null
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
      {shows('form') && <Select label={<Group component="span" gap={6} wrap="nowrap"><ArrowLeftRight size={16} aria-hidden="true" />{t('Форма взаєморозрахунків')}</Group>} disabled={disabled} allowDeselect={false}
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
    </> : shows('filters') ? <>
      <SettlementPeriodAgreementPicker value={exact} from={from} to={to} disabled={disabled}
        enabled={enabled} onChange={onExactChange} />
      {!supported && <GroupedDebtorWorkbookPanel from={from} to={to} disabled={disabled} enabled={enabled} />}
    </> : null}
  </Stack>
}
