import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('shipment drawer grid at phone width (WH2-22)', () => {
  it('unpins the sticky columns and scrolls the grid sideways under 600 px', () => {
    const css = readFileSync(resolve(__dirname, 'warehouse-ukraine-page.css'), 'utf8')
    const phoneBlock = css.slice(css.lastIndexOf('@media (max-width: 600px)'))

    expect(phoneBlock).toContain('.warehouse-shipment-edit-table .data-table-scroll')
    expect(phoneBlock).toContain('overflow-x: auto')
    expect(phoneBlock).toContain('position: static !important')
  })
})
