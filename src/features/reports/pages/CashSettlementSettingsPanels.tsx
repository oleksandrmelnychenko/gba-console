import type { ComponentProps } from 'react'
import type { ReportMeasurementGroup } from '../types'
import { datasetMeasurements } from '../data/reportDatasets'
import { CASH_PERIOD_ALL_MEASURES, CASH_PERIOD_MEASURES, cashPeriodMeasurements, cashPeriodSupportsManagement } from '../data/cashPeriod'
import { defaultGroupedCashPeriod } from '../data/groupedCashPeriod'
import { CashPeriodModePanel } from './CashPeriodModePanel'
import { SettlementPeriodModePanel } from './SettlementPeriodModePanel'

type Props = {
  dataSource: number
  cash: Omit<ComponentProps<typeof CashPeriodModePanel>, 'onModeChange' | 'onExactChange'>
  settlement: ComponentProps<typeof SettlementPeriodModePanel>
  onGroupedCashChange: (value: unknown) => void
  onExactCashChange: (value: unknown) => void
  onCashMeasurementsChange: (value: ReportMeasurementGroup[]) => void
  onClearCashFilters: () => void
}

export function CashSettlementSettingsPanels({ dataSource, cash, settlement, onGroupedCashChange,
  onExactCashChange, onCashMeasurementsChange, onClearCashFilters }: Props) {
  if (dataSource === 41) return <SettlementPeriodModePanel {...settlement} />
  if (dataSource !== 40) return null
  const { dataset, available, onRowsChange } = cash
  return <CashPeriodModePanel {...cash}
    onModeChange={multiple => {
      onGroupedCashChange(multiple ? defaultGroupedCashPeriod() : undefined)
      onExactCashChange(undefined)
      onRowsChange([43, 40, 42, 41].flatMap(type => available.filter(group => group.type === type)))
      onClearCashFilters()
      const required = new Set<number>(multiple || cashPeriodSupportsManagement(dataset) ? CASH_PERIOD_ALL_MEASURES : CASH_PERIOD_MEASURES)
      onCashMeasurementsChange(datasetMeasurements(dataset, (dataset?.Measurements ?? [])
        .filter(field => required.has(field.Type)).map(field => ({ ...field, IsChecked: true, parentName: '' }))))
    }}
    onExactChange={next => {
      onExactCashChange(next)
      const required = new Set(next ? cashPeriodMeasurements(next) : cashPeriodSupportsManagement(dataset)
        ? CASH_PERIOD_ALL_MEASURES : CASH_PERIOD_MEASURES)
      onCashMeasurementsChange(datasetMeasurements(dataset, (dataset?.Measurements ?? [])
        .filter(field => required.has(field.Type)).map(field => ({ ...field, IsChecked: true, parentName: '' }))))
    }} />
}
