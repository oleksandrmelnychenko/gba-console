import { paletteColor, URGENCY_COLOR, URGENCY_ORDER, type UrgencyLevel } from './chartTheme'

export type DonutSlice = {
  name: string
  value: number
  color: string
}

export type UrgencySliceInput = {
  level: UrgencyLevel
  label: string
  value: number
}

export type TaskTypeSliceInput = {
  type: string
  label: string
  value: number
  color?: string
}

export function buildUrgencySlices(input: UrgencySliceInput[]): DonutSlice[] {
  const byLevel = new Map(input.map((item) => [item.level, item]))

  return URGENCY_ORDER.flatMap((level) => {
    const item = byLevel.get(level)

    if (!item || !(item.value > 0)) {
      return []
    }

    return [{ name: item.label, value: item.value, color: URGENCY_COLOR[level] }]
  })
}

export function buildTaskTypeSlices(input: TaskTypeSliceInput[]): DonutSlice[] {
  return input
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      name: item.label,
      value: item.value,
      color: item.color ?? paletteColor(index),
    }))
}
