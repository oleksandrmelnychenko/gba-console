import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
// Vitest executes this contract test in Node, while the browser app intentionally excludes Node globals.
// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'

const productsStyles = readFileSync('src/features/products/pages/products.css', 'utf8')

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('./ProductDetailPage', () => ({
  PRODUCT_BALANCES_PERMISSION: 'balances',
  PRODUCT_EDIT_PERMISSION: 'edit',
  PRODUCT_MOVEMENT_PERMISSION: 'movement',
  PRODUCT_WRITE_OFF_PERMISSION: 'writeoff',
  ProductActionDrawer: () => null,
  ProductImageViewerModal: () => null,
  ProductStockSummary: () => null,
}))

import { ProductsPage } from './ProductsPage'

describe('ProductsPage upload toolbar', () => {
  it('does not hide the assortment upload actions with page styles', () => {
    const headerRule = productsStyles.match(/\.product-assortment-carousel-header\s*\{([^}]*)\}/)?.[1]

    expect(headerRule).toBeDefined()
    expect(headerRule).not.toMatch(/\bdisplay\s*:\s*none\b/)
  })

  it('offers product and related-product uploads before a product is selected', async () => {
    renderProductsPage()

    fireEvent.click(screen.getByRole('button', { name: 'Завантаження' }))

    const menu = await screen.findByRole('menu')

    expect(within(menu).getByRole('menuitem', { hidden: true, name: 'Товари' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { hidden: true, name: 'Аналоги' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { hidden: true, name: 'Комплектуючі' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { hidden: true, name: 'Оригінальні номери' })).toBeTruthy()
  })
})

function renderProductsPage() {
  render(
    <MemoryRouter initialEntries={['/products']}>
      <MantineProvider>
        <I18nProvider>
          <ProductsPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}
