// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Додати позицію: Назва / Артикул', () => {
  const source = readFileSync('src/features/consumable-orders/pages/ConsumableOrderFormPage.tsx', 'utf8') as string

  it('Артикул shows the vendor code and Назва the name, not both «001 - QA Папір А4»', () => {
    expect(source).toContain('const label = product.VendorCode || joinTruthyParts')
    expect(source).toContain('const label = product.Name || joinTruthyParts')
  })

  it('the dropdowns still show and search the code with the name', () => {
    expect(source.match(/renderOption=\{renderProductOption\}/g)).toHaveLength(2)
    expect(source.match(/filter=\{filterProductOptions\}/g)).toHaveLength(2)
  })
})
