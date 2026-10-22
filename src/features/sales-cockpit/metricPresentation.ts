/** Pace compares actual with the working-calendar expectation, not the full month. */
export function departmentPaceColor(target: number, actual: number, expected: number): 'gray' | 'green' | 'orange' | 'red' {
  if (target <= 0) return 'gray'
  if (expected <= 0) return 'orange'
  return actual >= expected * 1.05 ? 'green' : actual < expected * 0.95 ? 'red' : 'orange'
}
