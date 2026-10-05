import { Card, SegmentedControl, Select, Text } from '@mantine/core'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { cashPeriodSupportsManagement, type CashPeriodScope } from '../data/cashPeriod'
import { groupedCashSupported, groupedCashWorkbookSupported, CASH_WORKBOOK_ROWS } from '../data/groupedCashPeriod'
import { CashPeriodLegPicker } from './CashPeriodLegPicker'
import { cashWorkbookPresentationSupported } from '../data/workbookPresentation'

export function CashPeriodModePanel({ dataset, grouped, exact, disabled, enabled, onModeChange, onExactChange, rows, available, onRowsChange }: {
  dataset?: ReportDataset; grouped: unknown; exact: unknown; disabled: boolean; enabled: boolean
  rows: ReportGroupingItem[]; available: readonly ReportGroupingItem[]
  onRowsChange: (rows: ReportGroupingItem[]) => void
  onModeChange: (grouped: boolean) => void; onExactChange: (scope: CashPeriodScope | undefined) => void
}) {
  const multiple = grouped != null
  return <>
    {groupedCashSupported(dataset) ? <Card withBorder radius="md" padding="md">
      <SegmentedControl fullWidth aria-label="Рахунки звіту коштів" disabled={disabled}
        value={multiple ? 'accounts' : 'account'} data={[
          { value: 'accounts', label: 'Усі / вибрані рахунки' }, { value: 'account', label: 'Один валютний запис' },
        ]} onChange={value => onModeChange(value === 'accounts')} />
      {multiple && (groupedCashWorkbookSupported(dataset) || cashWorkbookPresentationSupported(dataset)) ? <Select mt="sm" label="Форма руху коштів" disabled={disabled}
        allowDeselect={false} value={rows.map(row => row.type).join(',')} data={[
          { value: '43,40,42,41', label: 'Організація / Рахунок / Запис / Валюта' },
          { value: '40,44,43', label: 'Рахунок / Тип / Організація' },
          ...(cashWorkbookPresentationSupported(dataset) ? [{ value: '40', label: 'Рахунок / каса з додатковими полями' }] : []),
        ]} onChange={value => {
          const types = value === '40' && cashWorkbookPresentationSupported(dataset) ? [40]
            : value === '40,44,43' ? CASH_WORKBOOK_ROWS : value === '43,40,42,41' ? [43, 40, 42, 41] : null
          if (!types) return
          const next = types.flatMap(type => available.filter(row => row.type === type))
          if (next.length === types.length) onRowsChange(next)
        }} /> : null}
      {multiple ? <Text size="sm" mt="sm">Банківські рахунки та каси можна відібрати за рахунком, організацією, валютою й видом. Різні валюти рахунків не додаються; недоступні внески залишаються порожніми.</Text> : null}
    </Card> : null}
    {!multiple ? <CashPeriodLegPicker value={exact} disabled={disabled} enabled={enabled}
      managementSupported={cashPeriodSupportsManagement(dataset)} onChange={onExactChange} /> : null}
  </>
}
