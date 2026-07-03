import { useMemo, useState } from 'react'
import { Box } from '@mantine/core'
import {
  UA_OUTLINE,
  projectLat,
  projectLng,
} from '../data/oblastCentroids'
import type { GeographyMetric, PlottedRegion } from '../types'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 480
const MIN_RADIUS = 6
const MAX_RADIUS = 56

const METRIC_FILL: Record<GeographyMetric, string> = {
  sales: 'var(--mantine-color-teal-6)',
  debt: 'var(--mantine-color-orange-6)',
}

const METRIC_STROKE: Record<GeographyMetric, string> = {
  sales: 'var(--mantine-color-teal-8)',
  debt: 'var(--mantine-color-orange-8)',
}

type HoverState = {
  region: PlottedRegion
  x: number
  y: number
}

type UkraineBubbleMapProps = {
  regions: PlottedRegion[]
  metric: GeographyMetric
  formatMoney: (value: number) => string
  formatCount: (count: number) => string
}

export function UkraineBubbleMap({ regions, metric, formatMoney, formatCount }: UkraineBubbleMapProps) {
  const [hover, setHover] = useState<HoverState | null>(null)

  const outlinePoints = useMemo(
    () =>
      UA_OUTLINE.map(([lng, lat]) => `${projectLng(lng, VIEW_WIDTH).toFixed(1)},${projectLat(lat, VIEW_HEIGHT).toFixed(1)}`).join(' '),
    [],
  )

  // Area ∝ value: radius = clamp(k * sqrt(value), minR, maxR), with k scaled so the
  // largest value maps to maxR. Drawn largest-first so small bubbles stay clickable.
  const bubbles = useMemo(() => {
    const maxValue = regions.reduce((max, region) => Math.max(max, region.valueEur), 0)
    const k = maxValue > 0 ? MAX_RADIUS / Math.sqrt(maxValue) : 0

    return regions
      .map((region) => {
        const radius = maxValue > 0 ? clamp(k * Math.sqrt(region.valueEur), MIN_RADIUS, MAX_RADIUS) : MIN_RADIUS
        return {
          region,
          radius,
          cx: projectLng(region.lng, VIEW_WIDTH),
          cy: projectLat(region.lat, VIEW_HEIGHT),
        }
      })
      .toSorted((left, right) => right.radius - left.radius)
  }, [regions])

  const fill = METRIC_FILL[metric]
  const stroke = METRIC_STROKE[metric]

  return (
    <Box pos="relative" w="100%">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Карта України"
        style={{ display: 'block', height: 'auto', maxHeight: 520 }}
      >
        <polygon
          points={outlinePoints}
          fill="var(--mantine-color-gray-1)"
          stroke="var(--mantine-color-gray-4)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {bubbles.map(({ region, radius, cx, cy }) => {
          const isActive = hover?.region.code === region.code
          return (
            <circle
              key={region.code}
              cx={cx}
              cy={cy}
              r={radius}
              fill={fill}
              fillOpacity={isActive ? 0.85 : 0.55}
              stroke={stroke}
              strokeWidth={isActive ? 2 : 1}
              style={{ cursor: 'pointer', transition: 'fill-opacity 120ms ease' }}
              onMouseEnter={() => setHover({ region, x: cx, y: cy })}
              onMouseLeave={() => setHover((current) => (current?.region.code === region.code ? null : current))}
            />
          )
        })}

        {bubbles.map(({ region, cx, cy }) => (
          <text
            key={`label-${region.code}`}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={600}
            fill="var(--mantine-color-gray-8)"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            {region.code}
          </text>
        ))}
      </svg>

      {hover && (
        <Box
          pos="absolute"
          left={`${(hover.x / VIEW_WIDTH) * 100}%`}
          top={`${(hover.y / VIEW_HEIGHT) * 100}%`}
          style={{
            transform: 'translate(-50%, -120%)',
            pointerEvents: 'none',
            background: 'var(--mantine-color-dark-7)',
            color: 'var(--mantine-color-white)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--mantine-shadow-md)',
            zIndex: 2,
          }}
        >
          <div style={{ fontWeight: 700 }}>{hover.region.name}</div>
          <div>{formatMoney(hover.region.valueEur)}</div>
          <div style={{ opacity: 0.8 }}>{formatCount(hover.region.clientCount)}</div>
        </Box>
      )}
    </Box>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
