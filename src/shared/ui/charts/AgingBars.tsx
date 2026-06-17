import { BarChart } from '@mantine/charts'
import { paletteColor } from './chartTheme'
import { ChartEmpty, ChartFrame, ChartLoading } from './ChartState'

export type AgingSeries = {
  name: string
  label?: string
  color?: string
}

export type AgingBarsProps = {
  data: Record<string, number | string>[]
  bucketKey: string
  series: AgingSeries[]
  stacked?: boolean
  height?: number
  withLegend?: boolean
  withTooltip?: boolean
  valueFormatter?: (value: number) => string
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel: string
}

export function AgingBars({
  data,
  bucketKey,
  series,
  stacked = false,
  height = 220,
  withLegend = false,
  withTooltip = true,
  valueFormatter,
  isLoading = false,
  loadingLabel = '…',
  emptyLabel,
}: AgingBarsProps) {
  if (isLoading) {
    return <ChartLoading height={height} label={loadingLabel} />
  }

  if (data.length === 0 || series.length === 0) {
    return <ChartEmpty height={height} label={emptyLabel} />
  }

  const resolvedSeries = series.map((item, index) => ({
    name: item.name,
    label: item.label ?? item.name,
    color: item.color ?? paletteColor(index),
    stackId: stacked ? 'aging' : undefined,
  }))

  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        dataKey={bucketKey}
        h={height}
        series={resolvedSeries}
        type={stacked ? 'stacked' : 'default'}
        valueFormatter={valueFormatter}
        withLegend={withLegend}
        withTooltip={withTooltip}
      />
    </ChartFrame>
  )
}
