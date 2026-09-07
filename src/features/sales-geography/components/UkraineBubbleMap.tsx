import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { OBLAST_CENTROIDS, UA_OUTLINE, projectLat, projectLng } from '../data/oblastCentroids'
import type { GeographyMetric, PlottedRegion } from '../types'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 480
const MIN_RADIUS = 6
const MAX_RADIUS = 56
const TOOLTIP_WIDTH = 208
const TOOLTIP_HEIGHT = 74

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
  radius: number
}

type UkraineBubbleMapProps = {
  regions: PlottedRegion[]
  metric: GeographyMetric
  formatMoney: (value: number) => string
  formatCount: (count: number) => string
}

export function UkraineBubbleMap({ regions, metric, formatMoney, formatCount }: UkraineBubbleMapProps) {
  const { t } = useI18n()
  const [hover, setHover] = useState<HoverState | null>(null)

  const outlinePoints = useMemo(
    () => UA_OUTLINE.map(([lng, lat]) => `${projectLng(lng, VIEW_WIDTH).toFixed(1)},${projectLat(lat, VIEW_HEIGHT).toFixed(1)}`).join(' '),
    [],
  )

  // Draw largest-first so that smaller regions remain reachable.
  const bubbles = useMemo(() => {
    const maxValue = regions.reduce((max, region) => Math.max(max, region.valueEur), 0)
    const k = maxValue > 0 ? MAX_RADIUS / Math.sqrt(maxValue) : 0

    return regions
      .map((region) => ({
        region,
        radius: maxValue > 0 ? clamp(k * Math.sqrt(Math.max(0, region.valueEur)), MIN_RADIUS, MAX_RADIUS) : MIN_RADIUS,
        cx: projectLng(region.lng, VIEW_WIDTH),
        cy: projectLat(region.lat, VIEW_HEIGHT),
      }))
      .toSorted((left, right) => right.radius - left.radius)
  }, [regions])

  const tooltipX = hover ? clamp(hover.x - TOOLTIP_WIDTH / 2, 8, VIEW_WIDTH - TOOLTIP_WIDTH - 8) : 0
  const tooltipY = hover ? clamp(hover.y - hover.radius - TOOLTIP_HEIGHT - 8, 8, VIEW_HEIGHT - TOOLTIP_HEIGHT - 8) : 0

  return (
    <div className="sales-geography-map">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="group" aria-label={t('Карта України')}>
        <polygon
          points={outlinePoints}
          fill="var(--mantine-color-gray-0)"
          stroke="var(--mantine-color-gray-3)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {!regions.some((region) => region.code === 'KR' || region.code === '200') && (
          <text
            x={projectLng(OBLAST_CENTROIDS.KR.lng, VIEW_WIDTH)}
            y={projectLat(OBLAST_CENTROIDS.KR.lat, VIEW_HEIGHT)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={500}
            fill="var(--mantine-color-gray-6)"
            pointerEvents="none"
          >
            {t('Крим')}
          </text>
        )}

        {bubbles.map(({ region, radius, cx, cy }) => {
          const isActive = hover?.region.code === region.code
          const showDetails = () => setHover({ region, x: cx, y: cy, radius })
          const hideDetails = () => setHover((current) => current?.region.code === region.code ? null : current)
          return (
            <circle
              key={region.code}
              className="sales-geography-map-bubble"
              cx={cx}
              cy={cy}
              r={radius}
              fill={METRIC_FILL[metric]}
              fillOpacity={isActive ? 0.65 : 0.35}
              stroke={isActive ? 'var(--brand-orange)' : METRIC_STROKE[metric]}
              strokeWidth={isActive ? 2.5 : 1}
              role="img"
              aria-label={`${region.name}: ${formatMoney(region.valueEur)}, ${formatCount(region.clientCount)}`}
              tabIndex={0}
              onFocus={showDetails}
              onBlur={hideDetails}
              onMouseEnter={showDetails}
              onMouseLeave={hideDetails}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setHover(null)
              }}
            />
          )
        })}

        {bubbles.map(({ region, cx, cy }) => (
          <text
            key={`label-${region.code}`}
            className="sales-geography-map-label"
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={600}
            fill="var(--mantine-color-gray-8)"
            pointerEvents="none"
            aria-hidden="true"
          >
            {region.code}
          </text>
        ))}

        {hover && (
          <g transform={`translate(${tooltipX}, ${tooltipY})`} pointerEvents="none" aria-hidden="true">
            <rect
              width={TOOLTIP_WIDTH}
              height={TOOLTIP_HEIGHT}
              rx={8}
              fill="var(--mantine-color-white)"
              stroke="var(--mantine-color-gray-3)"
            />
            <text x={12} y={21} fontSize={12} fontWeight={600} fill="var(--mantine-color-gray-8)">
              {hover.region.name}
            </text>
            <text className="app-money" x={12} y={43} fontSize={13} fill="var(--mantine-color-gray-8)">
              {formatMoney(hover.region.valueEur)}
            </text>
            <text x={12} y={61} fontSize={11} fill="var(--mantine-color-gray-6)">
              {formatCount(hover.region.clientCount)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
