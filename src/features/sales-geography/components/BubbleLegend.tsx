import { Text } from '@mantine/core'
import type { GeographyMetric } from '../types'

const MAX_RADIUS = 56
const LEGEND_RADII = [56, 32, 14]

const METRIC_FILL: Record<GeographyMetric, string> = {
  sales: 'var(--mantine-color-teal-6)',
  debt: 'var(--mantine-color-orange-6)',
}

const METRIC_STROKE: Record<GeographyMetric, string> = {
  sales: 'var(--mantine-color-teal-8)',
  debt: 'var(--mantine-color-orange-8)',
}

type BubbleLegendProps = {
  maxValue: number
  metric: GeographyMetric
  formatMoney: (value: number) => string
  scaleLabel: string
}

// The legend preserves the map's area-to-value ratio at a compact display size.
export function BubbleLegend({ maxValue, metric, formatMoney, scaleLabel }: BubbleLegendProps) {
  return (
    <div className="sales-geography-legend" role="group" aria-label={scaleLabel}>
      <Text c="gray.6" size="xs">{scaleLabel}</Text>
      <ul className="sales-geography-legend-values">
        {LEGEND_RADII.map((radius) => {
          const value = maxValue > 0 ? Math.round((radius / MAX_RADIUS) ** 2 * maxValue) : 0
          return (
            <li key={radius}>
              <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden="true">
                <circle
                  cx={22}
                  cy={22}
                  r={(radius / MAX_RADIUS) * 20}
                  fill={METRIC_FILL[metric]}
                  fillOpacity={0.18}
                  stroke={METRIC_STROKE[metric]}
                  strokeWidth={1}
                />
              </svg>
              <Text className="app-money" size="xs">{formatMoney(value)}</Text>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
