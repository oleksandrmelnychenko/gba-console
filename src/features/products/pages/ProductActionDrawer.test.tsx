import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'

vi.mock('../components/ProductAnalyticsPanel', () => ({
  getProductAnalyticsId: (product: { Id?: number }) => product.Id ?? null,
  ProductAnalyticsPanel: ({ product }: { product: { Id?: number } }) => (
    <div data-testid="product-analytics-panel">Analytics for {product.Id}</div>
  ),
}))

import { ProductActionDrawer } from './ProductDetailPage'

describe('ProductActionDrawer analytics', () => {
  it('opens product analytics in the shared right sheet', async () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <I18nProvider>
            <ProductActionDrawer
              activePanel="analytics"
              product={{ Id: 42, NameUA: 'Тестовий товар' }}
              onClose={vi.fn()}
              onProductSaved={vi.fn()}
              onReload={vi.fn()}
            />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    const dialog = await screen.findByRole('dialog', { name: 'AI-аналітика товару' })
    const drawerRoot = document.querySelector('.mantine-Drawer-root')

    expect(dialog).toBeTruthy()
    expect(drawerRoot?.getAttribute('style')).toContain('--drawer-size: min(900px, 100vw)')
    expect(screen.getByTestId('product-analytics-panel').textContent).toBe('Analytics for 42')
  })
})
