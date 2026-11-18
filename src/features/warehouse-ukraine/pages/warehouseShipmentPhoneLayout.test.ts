// @ts-expect-error Node type scope is excluded from the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('shipment drawer grid at phone width (WH2-22)', () => {
  it('unpins the sticky columns and scrolls the grid sideways under 600 px', () => {
    const css = readFileSync('src/features/warehouse-ukraine/pages/warehouse-ukraine-page.css', 'utf8')
    const phoneBlock = css.slice(css.lastIndexOf('@media (max-width: 600px)'))

    expect(phoneBlock).toContain('.warehouse-shipment-edit-table .data-table-scroll')
    expect(phoneBlock).toContain('overflow-x: auto')
    expect(phoneBlock).toContain('position: static !important')
  })
})
