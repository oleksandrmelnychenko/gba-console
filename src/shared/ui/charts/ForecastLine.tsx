import { LineChart } from '@mantine/charts'
import { ChartEmpty, ChartFrame, ChartLoading } from './ChartState'
import { buildForecastRows, type ForecastPoint } from './forecastData'

export type ForecastLineProps = {
  data: ForecastPoint[]
  actualLabel: string
  forecastLabel: string
  actualColor?: string
  forecastColor?: string
  height?: number
  withLegend?: boolean
  withTooltip?: boolean
  valueFormatter?: (value: number) => string
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel: string
}

const ACTUAL_KEY = 'actual'
const FORECAST_KEY = 'forecast'

export function ForecastLine({
  data,
  actualLabel,
  forecastLabel,
  actualColor = 'violet.6',
  forecastColor = 'grape.4',
  height = 220,
  withLegend = false,
  withTooltip = true,
  valueFormatter,
  isLoading = false,
  loadingLabel = '…',
  emptyLabel,
}: ForecastLineProps) {
  if (isLoading) {
    return <ChartLoading height={height} label={loadingLabel} />
  }

  const { rows, hasActual, hasForecast } = buildForecastRows(data, ACTUAL_KEY, FORECAST_KEY)

  if (!hasActual && !hasForecast) {
    return <ChartEmpty height={height} label={emptyLabel} />
  }

  const series = [
    { name: ACTUAL_KEY, label: actualLabel, color: actualColor },
    { name: FORECAST_KEY, label: forecastLabel, color: forecastColor },
  ]

  return (
    <ChartFrame height={height}>
      <LineChart
        connectNulls={false}
        data={rows}
        dataKey="period"
        h={height}
        lineProps={(item) =>
          item.name === FORECAST_KEY ? { strokeDasharray: '6 4' } : {}
        }
        series={series}
        valueFormatter={valueFormatter}
        withDots={false}
        withLegend={withLegend}
        withTooltip={withTooltip}
      />
    </ChartFrame>
  )
}
