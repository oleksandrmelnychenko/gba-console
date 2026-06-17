import { isFiniteNumber } from './chartTheme'

export type WaterfallStepInput = {
  key: string
  label: string
  value: number | null | undefined
  color?: string
}

export type WaterfallRow = {
  key: string
  label: string
  value: number
  base: number
  delta: number
  rising: boolean
  color?: string
}

export function computeWaterfall(steps: WaterfallStepInput[]): {
  rows: WaterfallRow[]
  domainMax: number
} {
  const valid = steps.filter((step) => isFiniteNumber(step.value)) as (WaterfallStepInput & {
    value: number
  })[]

  const rows: WaterfallRow[] = []
  let domainMax = 0
  let previous: number | null = null

  for (const step of valid) {
    if (previous === null) {
      rows.push({
        key: step.key,
        label: step.label,
        value: step.value,
        base: 0,
        delta: step.value,
        rising: true,
        color: step.color,
      })
    } else {
      const base = Math.min(previous, step.value)
      const delta = Math.abs(step.value - previous)
      rows.push({
        key: step.key,
        label: step.label,
        value: step.value,
        base,
        delta,
        rising: step.value >= previous,
        color: step.color,
      })
    }

    domainMax = Math.max(domainMax, step.value)
    previous = step.value
  }

  return { rows, domainMax: domainMax * 1.1 }
}
