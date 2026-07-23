import { describe, expect, it } from 'vitest'
import { consoleRoutes } from './consoleRoutes'

describe('console report routes', () => {
  it('registers both sales-report URLs as direct routes', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/reports/sale')).toBe(true)
    expect(paths.has('/reports/sales')).toBe(true)
  })
})
