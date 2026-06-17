import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { CHART_GRID_COLOR, CHART_LABEL_COLOR } from './chartTheme'
import { ChartEmpty, ChartFrame, ChartLoading } from './ChartState'
import { computeWaterfall, type WaterfallStepInput } from './marginWaterfallData'
import { useChartColor } from './useChartColor'

export type MarginWaterfallProps = {
  steps: WaterfallStepInput[]
  formatValue?: (value: number) => string
  height?: number
  risingColor?: string
  fallingColor?: string
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel: string
}

export function MarginWaterfall({
  steps,
  formatValue,
  height = 220,
  risingColor = 'teal.6',
  fallingColor = 'orange.6',
  isLoading = false,
  loadingLabel = '…',
  emptyLabel,
}: MarginWaterfallProps) {
  const resolveColor = useChartColor()
  const format = formatValue ?? defaultFormat

  if (isLoading) {
    return <ChartLoading height={height} label={loadingLabel} />
  }

  const { rows, domainMax } = computeWaterfall(steps)

  if (rows.length === 0) {
    return <ChartEmpty height={height} label={emptyLabel} />
  }

  const resolvedRising = resolveColor(risingColor, 'var(--mantine-color-teal-6)')
  const resolvedFalling = resolveColor(fallingColor, 'var(--mantine-color-orange-6)')

  return (
    <ChartFrame height={height}>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={rows} margin={{ top: 20, right: 12, bottom: 4, left: 12 }}>
          <XAxis
            axisLine={{ stroke: CHART_GRID_COLOR }}
            dataKey="label"
            tick={{ fill: CHART_LABEL_COLOR, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis domain={[0, domainMax]} hide />
          <Bar dataKey="base" fill="transparent" isAnimationActive={false} stackId="waterfall" />
          <Bar dataKey="delta" isAnimationActive={false} radius={[3, 3, 0, 0]} stackId="waterfall">
            <LabelList
              dataKey="value"
              fill={CHART_LABEL_COLOR}
              fontSize={11}
              formatter={(value: number) => format(value)}
              position="top"
            />
            {rows.map((row) => (
              <Cell
                fill={
                  row.color ? resolveColor(row.color) : row.rising ? resolvedRising : resolvedFalling
                }
                key={row.key}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function defaultFormat(value: number): string {
  return value.toFixed(2)
}
