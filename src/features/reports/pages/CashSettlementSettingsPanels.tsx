import type { ComponentProps } from 'react'
import type { ReportMeasurementGroup } from '../types'
import { datasetMeasurements } from '../data/reportDatasets'
import { CASH_PERIOD_ALL_MEASURES } from '../data/cashPeriod'
import { defaultGroupedCashPeriod } from '../data/groupedCashPeriod'
import { isCashReadModeCapability } from '../data/cashReadMode'
import { CashPeriodModePanel } from './CashPeriodModePanel'
import { SettlementPeriodModePanel } from './SettlementPeriodModePanel'

type Props = {
  dataSource: number
  cash: Omit<ComponentProps<typeof CashPeriodModePanel>, 'onModeChange'>
  settlement: ComponentProps<typeof SettlementPeriodModePanel>
  onGroupedCashChange: (value: unknown) => void
  onExactCashChange: (value: unknown) => void
  onCashMeasurementsChange: (value: ReportMeasurementGroup[]) => void
  onClearCashFilters: () => void
  part?: 'source' | 'filters' | 'form'
}

export function CashSettlementSettingsPanels({ dataSource, cash, settlement, onGroupedCashChange,
  onExactCashChange, onCashMeasurementsChange, onClearCashFilters, part }: Props) {
  if (dataSource === 41) return <SettlementPeriodModePanel {...settlement} part={part} />
  if (dataSource !== 40 || part === 'filters') return null
  const { dataset, available, onRowsChange } = cash
  return <CashPeriodModePanel {...cash} part={part}
    onModeChange={() => {
      onGroupedCashChange(defaultGroupedCashPeriod())
      cash.onReadModeChange?.(isCashReadModeCapability(dataset?.cashReadMode) ? 0 : undefined)
      onExactCashChange(undefined)
      onRowsChange([43, 40, 42, 41].flatMap(type => available.filter(group => group.type === type)))
      onClearCashFilters()
      const required = new Set<number>(CASH_PERIOD_ALL_MEASURES)
      onCashMeasurementsChange(datasetMeasurements(dataset, (dataset?.Measurements ?? [])
        .filter(field => required.has(field.Type)).map(field => ({ ...field, IsChecked: true, parentName: '' }))))
    }} />
}
