import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'

const authState = vi.hoisted(() => ({ allowed: new Set<string>() }))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permissionKey: string) => authState.allowed.has(permissionKey),
  }),
}))

vi.mock('../components/ProductAnalyticsPanel', () => ({
  getProductAnalyticsId: (product: { Id?: number }) => product.Id ?? null,
  ProductAnalyticsPanel: ({ product }: { product: { Id?: number } }) => (
    <div data-testid="product-analytics-panel">Analytics for {product.Id}</div>
  ),
}))

import { ProductActionDrawer } from './ProductDetailPage'

describe('ProductActionDrawer analytics', () => {
  beforeEach(() => {
    authState.allowed.clear()
  })

  it('opens product analytics in the shared right sheet', async () => {
    authState.allowed.add(PermissionKeys.ProductsAssortment.Analytics.Open)

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
    expect(drawerRoot?.getAttribute('style')).toContain('--drawer-size: min(1200px, 100vw)')
    expect(screen.getByTestId('product-analytics-panel').textContent).toBe('Analytics for 42')
  })

  it('does not mount analytics when the direct drawer state lacks its permission', async () => {
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

    expect(await screen.findByText('Недостатньо прав для цієї дії')).toBeTruthy()
    expect(screen.queryByTestId('product-analytics-panel')).toBeNull()
  })
})
