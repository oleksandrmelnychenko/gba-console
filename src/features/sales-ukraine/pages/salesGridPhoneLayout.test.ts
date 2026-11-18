// @ts-expect-error Node type scope is excluded from the application compilation unit.
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

  it('lets the sticky document actions reach the scroll edge, so no column peeks out beside them', () => {
    expect(phoneBlock).toMatch(/\.sales-ukraine-grid \{\s*padding-right: 0;/)
    // full row height, so nothing shows above or below the sticky cell
    expect(phoneBlock).toMatch(/\.sales-grid-row \.sg-doc-actions \{[^}]*align-self: stretch;[^}]*position: sticky;/)
    // the carrier comment starts past the sticky cell's left edge instead of peeking out beside it
    expect(phoneBlock).toMatch(/\.sales-ukraine-grid \.sg-carrier-comment \{\s*margin-left: 16px;/)
  })
})
