import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/sales-ukraine/pages/sales-grid.css', 'utf8').replace(/\r\n/g, '\n')
const phoneBlock = css.slice(css.indexOf('@media (max-width: 640px)'), css.indexOf('.sg-status {'))

describe('sales grid at phone width', () => {
  it('keeps the client, sale number and date out from under the sticky document actions', () => {
    expect(phoneBlock).toMatch(/\.sales-ukraine-grid \.sg-client-body \{\s*max-width: calc\(100vw - 220px\);/)
    expect(phoneBlock).toMatch(/\.sales-ukraine-grid \.sg-meta \{\s*flex-wrap: wrap;/)
  })

  it('lets wrapped rows grow instead of being squeezed to the minimum height', () => {
    expect(phoneBlock).toMatch(/\.sales-ukraine-grid > \.sales-grid-row \{\s*flex-shrink: 0;/)
  })
})
