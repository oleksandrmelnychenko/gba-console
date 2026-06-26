import { Group, Stack, Text } from '@mantine/core'
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

// Nested-circle size scale: radius r corresponds to value (r/maxR)^2 * maxValue,
// since bubble area is proportional to value.
export function BubbleLegend({ maxValue, metric, formatMoney, scaleLabel }: BubbleLegendProps) {
  const fill = METRIC_FILL[metric]
  const stroke = METRIC_STROKE[metric]
  const diameter = MAX_RADIUS * 2

  return (
    <Stack gap={4}>
      <Text c="dimmed" fw={600} size="xs" tt="uppercase">
        {scaleLabel}
      </Text>
      <Group align="flex-end" gap="lg">
        <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} aria-hidden>
          {LEGEND_RADII.map((radius) => (
            <circle
              key={radius}
              cx={MAX_RADIUS}
              cy={diameter - radius}
              r={radius}
              fill={fill}
              fillOpacity={0.18}
              stroke={stroke}
              strokeWidth={1}
            />
          ))}
        </svg>
        <Stack gap={2} justify="flex-end">
          {LEGEND_RADII.map((radius) => {
            const value = maxValue > 0 ? Math.round((radius / MAX_RADIUS) ** 2 * maxValue) : 0
            return (
              <Text key={radius} c="dimmed" size="xs">
                {formatMoney(value)}
              </Text>
            )
          })}
        </Stack>
      </Group>
    </Stack>
  )
}
