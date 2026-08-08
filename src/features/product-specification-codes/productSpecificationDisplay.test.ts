import { describe, expect, it } from 'vitest'
import { getProductSpecificationDisplayName } from './productSpecificationDisplay'

describe('product specification display name', () => {
  it('shows the canonical product name when an historical specification name is empty', () => {
    expect(
      getProductSpecificationDisplayName({
        Name: ' ',
        Product: { Name: 'Пневморесора' },
      }),
    ).toBe('Пневморесора')
  })

  it('keeps an explicit specification name as the primary bulk grouping name', () => {
    expect(
      getProductSpecificationDisplayName({
        Name: 'Частини пневматичних підвісок',
        Product: { Name: 'Пневморесора' },
      }),
    ).toBe('Частини пневматичних підвісок')
  })
})
