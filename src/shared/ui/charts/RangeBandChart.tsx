import { ComposedChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis, type LabelProps } from 'recharts'
import { CHART_AXIS_COLOR, CHART_LABEL_COLOR } from './chartTheme'
import { ChartEmpty, ChartFrame, ChartLoading } from './ChartState'
import { computeRangeBand, type RangeBandMarker } from './rangeBandData'
import { useChartColor } from './useChartColor'

export type RangeBandChartProps = {
  low: number | null | undefined
  high: number | null | undefined
  median?: number | null | undefined
  markers?: RangeBandMarker[]
  bandColor?: string
  medianColor?: string
  bandLabel?: string
  medianLabel?: string
  formatValue?: (value: number) => string
  height?: number
  ticks?: number
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel: string
}

const Y_VALUE = 'band'
const SINGLE_ROW = [{ row: Y_VALUE }]

export function RangeBandChart({
  low,
  high,
  median,
  markers = [],
  bandColor = 'violet.2',
  medianColor = 'violet.7',
  bandLabel,
  medianLabel,
  formatValue,
  height = 160,
  ticks = 5,
  isLoading = false,
  loadingLabel = '…',
  emptyLabel,
}: RangeBandChartProps) {
  const resolveColor = useChartColor()
  const format = formatValue ?? defaultFormat

  if (isLoading) {
    return <ChartLoading height={height} label={loadingLabel} />
  }

  const computed = computeRangeBand({ low, high, median, markers })

  if (!computed.hasBand && computed.markers.length === 0 && computed.median === null) {
    return <ChartEmpty height={height} label={emptyLabel} />
  }

  const resolvedBand = resolveColor(bandColor, 'var(--mantine-color-violet-2)')
  const resolvedMedian = resolveColor(medianColor, 'var(--mantine-color-violet-7)')

  return (
    <ChartFrame height={height}>
      <ResponsiveContainer height="100%" width="100%">
        <ComposedChart data={SINGLE_ROW} layout="vertical" margin={{ top: 28, right: 16, bottom: 8, left: 16 }}>
          <XAxis
            domain={computed.domain}
            tick={{ className: 'app-money', fill: CHART_LABEL_COLOR, fontSize: 11 }}
            tickCount={ticks}
            tickFormatter={(value: number) => format(value)}
            type="number"
          />
          <YAxis dataKey="row" hide type="category" />

          {computed.hasBand && computed.low !== null && computed.high !== null && (
            <ReferenceArea
              fill={resolvedBand}
              fillOpacity={0.55}
              ifOverflow="extendDomain"
              label={
                bandLabel
                  ? { position: 'insideTopLeft', value: bandLabel, fill: CHART_LABEL_COLOR, fontSize: 11 }
                  : undefined
              }
              stroke="none"
              x1={computed.low}
              x2={computed.high}
            />
          )}

          {computed.median !== null && (
            <ReferenceLine
              ifOverflow="extendDomain"
              label={{
                content: ({ viewBox }) => (
                  <PriceReferenceLabel
                    color={resolvedMedian}
                    label={medianLabel}
                    position="top"
                    value={format(computed.median!)}
                    viewBox={viewBox}
                  />
                ),
              }}
              stroke={resolvedMedian}
              strokeWidth={2}
              x={computed.median}
            />
          )}

          {computed.markers.map((marker) => {
            const color = resolveColor(marker.color, CHART_AXIS_COLOR)

            return (
              <ReferenceLine
                ifOverflow="extendDomain"
                key={`${marker.label}-${marker.value}`}
                label={{
                  content: ({ viewBox }) => (
                    <PriceReferenceLabel
                      color={color}
                      label={marker.label}
                      position="bottom"
                      value={format(marker.value)}
                      viewBox={viewBox}
                    />
                  ),
                }}
                stroke={color}
                strokeDasharray={marker.dashed === false ? undefined : '4 3'}
                strokeWidth={1.5}
                x={marker.value}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function PriceReferenceLabel({ color, label, position, value, viewBox }: {
  color: string
  label?: string
  position: 'top' | 'bottom'
  value: string
  viewBox: LabelProps['viewBox']
}) {
  if (!viewBox || !('x' in viewBox) || typeof viewBox.x !== 'number' || typeof viewBox.y !== 'number') {
    return null
  }

  return (
    <text
      className="recharts-label"
      dominantBaseline={position === 'bottom' ? 'hanging' : 'auto'}
      fill={color}
      fontSize={11}
      fontWeight={position === 'top' && label ? 600 : undefined}
      textAnchor="middle"
      x={viewBox.x + (viewBox.width ?? 0) / 2}
      y={position === 'bottom' ? viewBox.y + (viewBox.height ?? 0) + 22 : viewBox.y - 5}
    >
      {label && <tspan>{label} </tspan>}
      <tspan className="app-money">{value}</tspan>
    </text>
  )
}

function defaultFormat(value: number): string {
  return value.toFixed(2)
}
