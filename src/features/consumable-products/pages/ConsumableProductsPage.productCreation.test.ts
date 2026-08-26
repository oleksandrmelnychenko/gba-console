import { describe, expect, it } from 'vitest'
import type { ConsumableProductCategory } from '../types'
import { addProductToCategory } from './consumableProductCollections'

describe('ConsumableProductsPage product creation', () => {
  it('shows the saved product immediately in its selected category', () => {
    const selectedCategory: ConsumableProductCategory = {
      Id: 10,
      Name: 'Витрати на доставку',
      ConsumableProducts: [],
    }
    const otherCategory: ConsumableProductCategory = {
      Id: 20,
      Name: 'Інша категорія',
      ConsumableProducts: [],
    }

    const result = addProductToCategory(
      [selectedCategory, otherCategory],
      selectedCategory,
      {
        Id: 101,
        ConsumableProductCategoryId: 10,
        Name: 'Послуги брокера',
      },
    )

    expect(result[0].ConsumableProducts).toEqual([
      {
        Id: 101,
        ConsumableProductCategoryId: 10,
        Name: 'Послуги брокера',
      },
    ])
    expect(result[1]).toBe(otherCategory)
  })

  it('does not duplicate a product returned more than once', () => {
    const category: ConsumableProductCategory = {
      Id: 10,
      Name: 'Витрати на доставку',
      ConsumableProducts: [{ Id: 101, Name: 'Стара назва' }],
    }

    const result = addProductToCategory(
      [category],
      category,
      { Id: 101, Name: 'Послуги брокера' },
    )

    expect(result[0].ConsumableProducts).toEqual([{ Id: 101, Name: 'Послуги брокера' }])
  })
})
