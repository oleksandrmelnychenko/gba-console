import { Alert, Button, Group, Select, Stack } from '@mantine/core'
import { ArrowLeftRight } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { groupedSettlementRows, isGroupedSettlementDataset } from '../data/groupedSettlementPeriod'
import { isSettlementPeriodDataset } from '../data/settlementPeriod'
import { sourceCounterpartyGroupCapability } from '../data/sourceCounterpartyGroups'
import { CounterpartyGroupFilters } from './CounterpartyGroupFilters'
import { SettlementReadModeSelect } from './SettlementReadModeSelect'

type Props = {
  dataset: ReportDataset | undefined; grouped: unknown; groups: unknown
  available: readonly ReportGroupingItem[]; rows: ReportGroupingItem[]
  disabled: boolean; enabled: boolean
  onModeChange: () => void
  onRowsChange: (value: ReportGroupingItem[]) => void
  onGroupsChange: (value: unknown) => void
  readMode?: unknown; onReadModeChange?: (value: 0 | undefined) => void
  part?: 'source' | 'filters' | 'form'
}

export function SettlementPeriodModePanel({ dataset, grouped, groups, available, rows,
  disabled, enabled, onModeChange, onRowsChange, onGroupsChange,
  readMode, onReadModeChange, part }: Props) {
  const { t } = useI18n()
  if (!dataset || !isSettlementPeriodDataset(dataset)) return null
  const supported = isGroupedSettlementDataset(dataset)
  const isGroup = grouped != null
  const shows = (name: 'source' | 'filters' | 'form') => part === undefined || part === name
  if (!supported || part === 'form' && !isGroup) return null
  if (!isGroup) return shows('source') ? <Alert color="orange" title={t('Один точний договір більше не підтримується')}>
    <Button mt="xs" size="xs" variant="light" disabled={disabled} onClick={() => onModeChange()}>{t('Перейти до поточних договорів контрагентів')}</Button>
  </Alert> : null
  return <Stack gap="sm">
    {shows('source') && onReadModeChange && <SettlementReadModeSelect capability={dataset.settlementReadMode} value={readMode}
      disabled={disabled} onChange={onReadModeChange} />}
    {shows('form') && <Select label={<Group component="span" gap={6} wrap="nowrap"><ArrowLeftRight size={16} aria-hidden="true" />{t('Форма взаєморозрахунків')}</Group>} disabled={disabled} allowDeselect={false}
      value={rows.map(row => row.type).join(',')} data={[
        { value: '4,41,76', label: t('Організація → валюта → контрагент') },
        { value: '4,76', label: t('Організація → контрагент') },
      ]} onChange={layout => {
        if (layout === '4,41,76' || layout === '4,76') onRowsChange(groupedSettlementRows(available, layout === '4,41,76'))
      }} />}
    {shows('filters') && sourceCounterpartyGroupCapability(dataset.sourceCounterpartyGroups)
      && <CounterpartyGroupFilters value={groups} disabled={disabled || !enabled} onChange={onGroupsChange} />}
  </Stack>
}
