import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
// Vitest reads the actual page styles without adding Node types to the browser app.
// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { getProductByNetId, getProductReservationByNetId, getProducts } from '../api/productsApi'
import type { Product } from '../types'

vi.mock('../api/productsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productsApi')>()

  return {
    ...actual,
    getProductByNetId: vi.fn(),
    getProductReservationByNetId: vi.fn(),
    getProducts: vi.fn(),
  }
})

const authState = vi.hoisted(() => ({ denied: new Set<string>() }))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permissionKey: string) => !authState.denied.has(permissionKey),
  }),
}))

vi.mock('./ProductDetailPage', () => ({
  PRODUCT_BALANCES_PERMISSION: 'balances',
  PRODUCT_EDIT_PERMISSION: 'edit',
  PRODUCT_MOVEMENT_PERMISSION: 'movement',
  PRODUCT_WRITE_OFF_PERMISSION: 'writeoff',
  ProductActionDrawer: ({ activePanel }: { activePanel: string | null }) => (
    activePanel ? <output data-testid="active-product-panel">{activePanel}</output> : null
  ),
  ProductImageViewerModal: () => null,
  ProductStockSummary: () => null,
}))

import { ProductsPage } from './ProductsPage'

const getProductByNetIdMock = vi.mocked(getProductByNetId)
const getProductReservationByNetIdMock = vi.mocked(getProductReservationByNetId)
const getProductsMock = vi.mocked(getProducts)
const productsStyles = readFileSync('src/features/products/pages/products.css', 'utf8')
let testStyles: HTMLStyleElement

beforeEach(() => {
  authState.denied.clear()
  getProductByNetIdMock.mockReset()
  getProductReservationByNetIdMock.mockReset()
  getProductsMock.mockReset()
  getProductsMock.mockResolvedValue([])
  testStyles = document.createElement('style')
  testStyles.textContent = productsStyles
  document.head.appendChild(testStyles)
})

afterEach(() => {
  testStyles.remove()
})

describe('ProductsPage', () => {
  it.each([
    { VendorCode: undefined },
    { VendorCode: '', Top: 'X9' },
    { VendorCode: '   ', IsForSale: true },
    { VendorCode: '', IsForZeroSale: true },
  ])('shows missing vendor codes in gray, including status-colored products (%j)', async (fields) => {
    const product: Product & { NextSearchedProducts: Product[] } = {
      ...fields,
      Id: 42,
      NameUA: 'Зберігання товару',
      NetUid: '608b1fef-f84f-498e-8ff9-2f5d6a621814',
      NextSearchedProducts: [{
        ...fields,
        NameUA: 'Інша послуга',
        NetUid: 'fe828397-017c-451d-94d5-ab6ab959caa6',
      }],
    }

    getProductByNetIdMock.mockResolvedValue(product)
    getProductReservationByNetIdMock.mockResolvedValue({})

    const { container } = render(
      <MemoryRouter initialEntries={[`/products?netId=${product.NetUid}`]}>
        <MantineProvider>
          <I18nProvider>
            <ProductsPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(container.querySelector('.product-inline-code')?.textContent).toBe('Код відсутній'))

    for (const selector of ['.product-carousel-row-code', '.product-assortment-selected-code', '.product-inline-code']) {
      const label = container.querySelector(selector) as HTMLElement
      expect(label.textContent).toBe('Код відсутній')
      expect(label.dataset.codeMissing).toBe('true')
      expect(getComputedStyle(label).color).toBe('var(--mantine-color-dimmed)')
    }

    const selected = container.querySelector('.product-assortment-selected') as HTMLButtonElement
    expect(selected.disabled).toBe(true)
    expect(selected.hasAttribute('title')).toBe(false)
    expect(screen.queryByRole('button', { name: /Скопіювати код/ })).toBeNull()
    expect(container.textContent).not.toContain(product.NetUid)
    expect(container.textContent).not.toContain('fe828397-017c-451d-94d5-ab6ab959caa6')
    expect(getProductByNetIdMock).toHaveBeenCalledWith(product.NetUid, expect.any(AbortSignal))
  })

  it('keeps real vendor codes visible and available to copy', async () => {
    const product: Product = { Id: 42, NameUA: 'Тестовий товар', NetUid: 'product-42', VendorCode: '  TEST-42  ' }
    getProductByNetIdMock.mockResolvedValue(product)
    getProductReservationByNetIdMock.mockResolvedValue({})

    const { container } = render(
      <MemoryRouter initialEntries={['/products?netId=product-42']}>
        <MantineProvider>
          <I18nProvider>
            <ProductsPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    const copyButton = await screen.findByRole('button', { name: 'Скопіювати код: TEST-42' }) as HTMLButtonElement
    await waitFor(() => expect(container.querySelector('.product-inline-code')?.textContent).toBe('TEST-42'))
    expect(copyButton.disabled).toBe(false)
    expect(copyButton.title).toBe('Скопіювати код')
    expect(container.querySelector('[data-code-missing]')).toBeNull()
    expect(screen.queryByText('Код відсутній')).toBeNull()
  })

  it('keeps the assortment search inside the product drum', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/products']}>
        <MantineProvider>
          <I18nProvider>
            <ProductsPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    const searchInput = container.querySelector('.product-assortment-search-input')

    expect(searchInput).not.toBeNull()
    expect(searchInput?.closest('.product-assortment-drum')).not.toBeNull()
    expect(searchInput?.closest('.app-filter-bar')).toBeNull()
  })

  it('places the enabled AI analytics action first in the assortment product toolbar', async () => {
    const product = {
      Id: 42,
      NameUA: 'Тестовий товар',
      NetUid: 'product-42',
      VendorCode: 'TEST-42',
    } as Product

    getProductByNetIdMock.mockResolvedValue(product)
    getProductReservationByNetIdMock.mockResolvedValue({})

    render(
      <MemoryRouter initialEntries={['/products?netId=product-42']}>
        <MantineProvider>
          <I18nProvider>
            <ProductsPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    const analyticsAction = await screen.findByRole('button', { name: 'AI-аналітика товару' })
    const actionGroup = analyticsAction.closest('.product-inline-actions')

    expect(actionGroup).not.toBeNull()
    expect(analyticsAction.textContent).toContain('AI-аналітика')
    expect(within(actionGroup as HTMLElement).getAllByRole('button')[0]).toBe(analyticsAction)
    await waitFor(() => expect(analyticsAction.hasAttribute('disabled')).toBe(false))

    fireEvent.click(analyticsAction)
    expect((await screen.findByTestId('active-product-panel')).textContent).toBe('analytics')
  })

  it('does not expose the embedded analytics opener without the existing analytics page right', async () => {
    authState.denied.add(PermissionKeys.ProductsAssortment.Analytics.Open)
    const product = {
      Id: 42,
      NameUA: 'Тестовий товар',
      NetUid: 'product-42',
      VendorCode: 'TEST-42',
    } as Product

    getProductByNetIdMock.mockResolvedValue(product)
    getProductReservationByNetIdMock.mockResolvedValue({})

    render(
      <MemoryRouter initialEntries={['/products?netId=product-42']}>
        <MantineProvider>
          <I18nProvider>
            <ProductsPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Тестовий товар')
    expect(screen.queryByRole('button', { name: 'AI-аналітика товару' })).toBeNull()
  })
})
