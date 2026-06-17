export type ChartHeight = number

export type UrgencyLevel = 'critical' | 'high' | 'normal' | 'low'

export const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  critical: 'var(--mantine-color-red-6)',
  high: 'var(--mantine-color-orange-6)',
  normal: 'var(--mantine-color-yellow-6)',
  low: 'var(--mantine-color-teal-6)',
}

export const URGENCY_ORDER: UrgencyLevel[] = ['critical', 'high', 'normal', 'low']

export const CHART_AXIS_COLOR = 'var(--mantine-color-gray-4)'
export const CHART_GRID_COLOR = 'var(--mantine-color-gray-2)'
export const CHART_LABEL_COLOR = 'var(--mantine-color-gray-7)'
export const CHART_MUTED_COLOR = 'var(--mantine-color-gray-5)'

export const SERIES_PALETTE = [
  'violet.6',
  'teal.6',
  'blue.6',
  'orange.6',
  'grape.6',
  'cyan.6',
  'lime.6',
  'pink.6',
]

export function paletteColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length]
}

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
