// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('specification products grid number format', () => {
  it('formats customs value, duty and VAT columns like the money columns (comma, fixed decimals)', () => {
    const source = readFileSync('src/features/product-delivery-protocols/components/SpecificationProductsGrid.tsx', 'utf8') as string

    for (const field of ['customsValue', 'dutyPercent', 'duty', 'vatPercent', 'vatValue']) {
      expect(source).toContain(`cell: (row) => renderPriceCell(row.${field}),`)
      expect(source).not.toContain(`cell: (row) => renderNumberCell(row.${field}),`)
    }
  })
})
