import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { Product } from '../types'

const renderProductCard = ({ productId }: { productId: number }) => (
  <div data-testid="product-card">Product {productId}</div>
)
const productCard = vi.fn(renderProductCard)

vi.mock('../../assortment/components/ProductCard', () => ({
  ProductCard: productCard,
}))

import { getProductAnalyticsId, ProductAnalyticsPanel } from './ProductAnalyticsPanel'

describe('ProductAnalyticsPanel', () => {
  it('lazy-loads analytics for a product with a valid Id', async () => {
    const product: Product = { Id: 42, Name: 'Test product' }

    renderPanel(product)

    expect(screen.getByRole('status').textContent).toContain('Завантаження аналітики товару')
    expect((await screen.findByTestId('product-card')).textContent).toBe('Product 42')
    expect(productCard).toHaveBeenCalledWith(expect.objectContaining({ productId: 42 }), undefined)
    expect(getProductAnalyticsId(product)).toBe(42)
  })

  it('does not load analytics when the product Id is missing', () => {
    const product: Product = { Name: 'Product without Id' }

    renderPanel(product)

    expect(screen.getByRole('alert').textContent).toContain('Аналітика недоступна')
    expect(screen.queryByTestId('product-card')).toBeNull()
    expect(getProductAnalyticsId(product)).toBeNull()
  })

  it('contains a lazy analytics render failure inside the drawer', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    productCard.mockImplementation(() => {
      throw new Error('Chunk failed')
    })
    try {
      renderPanel({ Id: 42, Name: 'Test product' })

      expect((await screen.findByRole('alert')).textContent).toContain('Не вдалося відкрити модуль аналітики')
    } finally {
      productCard.mockImplementation(renderProductCard)
      consoleError.mockRestore()
    }
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid product Id %s',
    (Id) => {
      expect(getProductAnalyticsId({ Id })).toBeNull()
    },
  )
})

function renderPanel(product: Product) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductAnalyticsPanel product={product} />
      </I18nProvider>
    </MantineProvider>,
  )
}
