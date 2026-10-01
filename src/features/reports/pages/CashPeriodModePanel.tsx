import { Card, SegmentedControl, Text } from '@mantine/core'
import type { ReportDataset } from '../types'
import { cashPeriodSupportsManagement, type CashPeriodScope } from '../data/cashPeriod'
import { groupedCashSupported } from '../data/groupedCashPeriod'
import { CashPeriodLegPicker } from './CashPeriodLegPicker'

export function CashPeriodModePanel({ dataset, grouped, exact, disabled, enabled, onModeChange, onExactChange }: {
  dataset?: ReportDataset; grouped: unknown; exact: unknown; disabled: boolean; enabled: boolean
  onModeChange: (grouped: boolean) => void; onExactChange: (scope: CashPeriodScope | undefined) => void
}) {
  const multiple = grouped != null
  return <>
    {groupedCashSupported(dataset) ? <Card withBorder radius="md" padding="md">
      <SegmentedControl fullWidth aria-label="Рахунки звіту коштів" disabled={disabled}
        value={multiple ? 'accounts' : 'account'} data={[
          { value: 'accounts', label: 'Усі / вибрані рахунки' }, { value: 'account', label: 'Один валютний запис' },
        ]} onChange={value => onModeChange(value === 'accounts')} />
      {multiple ? <Text size="sm" mt="sm">Банківські рахунки та каси можна відібрати за рахунком, організацією, валютою й видом. Різні валюти рахунків не додаються; недоступні внески залишаються порожніми.</Text> : null}
    </Card> : null}
    {!multiple ? <CashPeriodLegPicker value={exact} disabled={disabled} enabled={enabled}
      managementSupported={cashPeriodSupportsManagement(dataset)} onChange={onExactChange} /> : null}
  </>
}
