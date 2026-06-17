import { DonutChart } from '@mantine/charts'
import { Center } from '@mantine/core'
import { ChartEmpty, ChartLoading } from './ChartState'
import { buildTaskTypeSlices, type TaskTypeSliceInput } from './donutData'

export type TaskTypeDonutProps = {
  data: TaskTypeSliceInput[]
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

export function TaskTypeDonut({
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
}: TaskTypeDonutProps) {
  if (isLoading) {
    return <ChartLoading height={size} label={loadingLabel} />
  }

  const slices = buildTaskTypeSlices(data)

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
