export type ConsoleNavMeasure = { items: number[]; more: number; gap: number; padding: number }

export function sameConsoleNavMeasure(left: ConsoleNavMeasure | null, right: ConsoleNavMeasure): boolean {
  return left !== null && left.more === right.more && left.gap === right.gap && left.padding === right.padding
    && left.items.length === right.items.length && left.items.every((width, index) => width === right.items[index])
}

export function fitConsoleNavEntries(measure: ConsoleNavMeasure, available: number, active: number): number[] {
  const { items, more, gap, padding } = measure
  const all = items.map((_, index) => index)
  const span = (indices: readonly number[], withMore: boolean) => {
    const count = indices.length + (withMore ? 1 : 0)
    return padding + indices.reduce((sum, index) => sum + items[index], 0) + (withMore ? more : 0) + Math.max(0, count - 1) * gap
  }
  if (span(all, false) <= available) return all
  const visible: number[] = []
  for (const index of all) {
    if (span([...visible, index], true) > available) break
    visible.push(index)
  }
  if (active < 0 || active >= items.length || visible.includes(active)) return visible
  const kept = [...visible]
  while (kept.length && span([...kept, active], true) > available) kept.pop()
  return span([...kept, active], true) <= available ? [...kept, active].sort((left, right) => left - right) : visible
}
