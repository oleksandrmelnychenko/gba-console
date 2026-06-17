import { DonutChart } from '@mantine/charts'
import { Center } from '@mantine/core'
import { ChartEmpty, ChartLoading } from './ChartState'
import { buildUrgencySlices, type UrgencySliceInput } from './donutData'

export type UrgencyDonutProps = {
  data: UrgencySliceInput[]
  size?: number
  thickness?: number
  chartLabel?: string | number
  withTooltip?: boolean
  withLabels?: boolean
  valueFormatter?: (value: number) => string
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel: string
}

export function UrgencyDonut({
  data,
  size = 160,
  thickness = 24,
  chartLabel,
  withTooltip = true,
  withLabels = false,
  valueFormatter,
  isLoading = false,
  loadingLabel = '…',
  emptyLabel,
}: UrgencyDonutProps) {
  if (isLoading) {
    return <ChartLoading height={size} label={loadingLabel} />
  }

  const slices = buildUrgencySlices(data)

  if (slices.length === 0) {
    return <ChartEmpty height={size} label={emptyLabel} />
  }

  return (
    <Center>
      <DonutChart
        chartLabel={chartLabel}
        data={slices}
        size={size}
        thickness={thickness}
        valueFormatter={valueFormatter}
        withLabels={withLabels}
        withTooltip={withTooltip}
      />
    </Center>
  )
}
