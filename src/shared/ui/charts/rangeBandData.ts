import { isFiniteNumber } from './chartTheme'

export type RangeBandMarker = {
  value: number | null | undefined
  label: string
  color?: string
  dashed?: boolean
}

export type RangeBandComputation = {
  hasBand: boolean
  low: number | null
  high: number | null
  median: number | null
  domain: [number, number]
  markers: { value: number; label: string; color?: string; dashed?: boolean }[]
}

const DEFAULT_DOMAIN: [number, number] = [0, 1]

export function computeRangeBand(args: {
  low: number | null | undefined
  high: number | null | undefined
  median: number | null | undefined
  markers: RangeBandMarker[]
  padFraction?: number
}): RangeBandComputation {
  const padFraction = args.padFraction ?? 0.08

  const low = isFiniteNumber(args.low) ? args.low : null
  const high = isFiniteNumber(args.high) ? args.high : null
  const median = isFiniteNumber(args.median) ? args.median : null

  const validMarkers = args.markers
    .filter((marker): marker is RangeBandMarker & { value: number } => isFiniteNumber(marker.value))
    .map((marker) => ({
      value: marker.value,
      label: marker.label,
      color: marker.color,
      dashed: marker.dashed,
    }))

  const points = [low, high, median, ...validMarkers.map((marker) => marker.value)].filter(isFiniteNumber)

  const hasBand = low !== null && high !== null && high >= low

  if (points.length === 0) {
    return { hasBand: false, low, high, median, domain: DEFAULT_DOMAIN, markers: validMarkers }
  }

  let min = Math.min(...points)
  let max = Math.max(...points)

  if (min === max) {
    const spread = Math.abs(min) > 0 ? Math.abs(min) * padFraction : 1
    min -= spread
    max += spread
  } else {
    const pad = (max - min) * padFraction
    min -= pad
    max += pad
  }

  return { hasBand, low, high, median, domain: [min, max], markers: validMarkers }
}
