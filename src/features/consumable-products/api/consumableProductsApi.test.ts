import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createConsumableProduct,
  createConsumableProductCategory,
  deleteConsumableProduct,
  deleteConsumableProductCategory,
  getConsumableProductCategories,
  searchConsumableProductCategories,
  updateConsumableProduct,
  updateConsumableProductCategory,
} from './consumableProductsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('consumable-products canonical routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('uses page-scoped category reads', async () => {
    await getConsumableProductCategories()
    await searchConsumableProductCategories('oil')

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/consumables/categories/accounting/all',
      '/consumables/categories/accounting/search',
    ])
  })

  it('uses independently permission-scoped category and product mutations', async () => {
    const category = { Name: 'Категорія', NetUid: 'category-1' }
    const product = { Name: 'Товар', NetUid: 'product-1' }

    await createConsumableProductCategory(category)
    await updateConsumableProductCategory(category)
    await deleteConsumableProductCategory('category-1')
    await createConsumableProduct(product)
    await updateConsumableProduct(product)
    await deleteConsumableProduct('product-1')

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/consumables/categories/accounting/create',
      '/consumables/categories/accounting/update',
      '/consumables/categories/accounting/delete',
      '/consumables/products/accounting/create',
      '/consumables/products/accounting/update',
      '/consumables/products/accounting/delete',
    ])
  })
})
