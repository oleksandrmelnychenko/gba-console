import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductByNetId, getProductReservationByNetId } from '../api/productsApi'
import type { Product, ProductReservation } from '../types'
import { ProductsPage } from './ProductsPage'

const callbacks = vi.hoisted(() => ({ saved: null as null | ((product: Product | null) => void) }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/realtime/events', () => ({ realtimeEvents: {}, useRealtimeEvent: () => {} }))
vi.mock('../components/ProductPriceSourcePanel', () => ({ ProductPriceSourcePanel: () => null }))
vi.mock('../components/ShopImageGallery', () => ({ ShopImageGallery: () => null }))
vi.mock('./ProductDetailPage', async original => ({ ...await original<typeof import('./ProductDetailPage')>(),
  ProductActionDrawer: ({ onProductSaved }: { onProductSaved: (product: Product | null) => void }) => {
    callbacks.saved = onProductSaved
    return null
  },
}))
vi.mock('../api/productsApi', async original => ({ ...await original<typeof import('../api/productsApi')>(),
  getProductByNetId: vi.fn(), getProductReservationByNetId: vi.fn(),
  getProducts: vi.fn(async () => []), getProductSiblings: vi.fn(async () => ({ Cards: [] })), getProductSiblingCounts: vi.fn(async () => []),
}))
const loadProduct = vi.mocked(getProductByNetId), loadReserves = vi.mocked(getProductReservationByNetId)
const first: Product & { NextSearchedProducts: Product[] } = { NetUid: 'A', VendorCode: 'CODE-A', NameUA: 'Товар А', Description: 'Initial', NextSearchedProducts: [{ NetUid: 'B', VendorCode: 'CODE-B', NameUA: 'Товар Б' }] }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function renderPage() {
  return render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={['/products?netId=A']}><ProductsPage /></MemoryRouter></I18nProvider></MantineProvider>)
}
beforeEach(() => {
  loadProduct.mockReset().mockResolvedValue(first)
  loadReserves.mockReset().mockResolvedValue({})
  callbacks.saved = null
})

it('uses one route read, displays the card before reserves and retries only failed reserves', async () => {
  const reserves = deferred<ProductReservation>()
  loadReserves.mockReturnValueOnce(reserves.promise)
  const view = renderPage()
  await waitFor(() => expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('CODE-A'))
  expect(screen.getByRole('status').textContent).toBe('Завантаження резервів')
  await waitFor(() => expect(loadReserves).toHaveBeenCalledOnce())
  expect(loadProduct).toHaveBeenCalledOnce()
  await act(async () => reserves.reject(new Error('Reserves offline')))
  expect(screen.getByText('Reserves offline')).toBeTruthy()
  const retry = deferred<ProductReservation>()
  loadReserves.mockReturnValueOnce(retry.promise)
  const button = screen.getByRole('button', { name: 'Повторити завантаження резервів' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(loadReserves).toHaveBeenCalledTimes(2)
  expect(loadProduct).toHaveBeenCalledOnce()
  await act(async () => retry.resolve({ TotalReservedUK: 17 }))
  expect(screen.getByText('17')).toBeTruthy()
  expect(screen.queryByText('Reserves offline')).toBeNull()
})

it('keeps known details visible during a failed full refresh', async () => {
  loadReserves.mockResolvedValueOnce({ TotalReservedUK: 17 })
  const view = renderPage()
  await screen.findByText('17')
  const product = deferred<Product | null>(), reserves = deferred<ProductReservation>()
  loadProduct.mockReturnValueOnce(product.promise)
  loadReserves.mockReturnValueOnce(reserves.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
  expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('CODE-A')
  await act(async () => { product.reject(new Error('Product offline')); reserves.reject(new Error('Reserves offline')) })
  expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('CODE-A')
  expect(screen.getByText('17')).toBeTruthy()
  expect(screen.getByText('Product offline')).toBeTruthy()
})

it('publishes saved details without rereading and rejects callbacks from a previous selection', async () => {
  const view = renderPage()
  await waitFor(() => expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('CODE-A'))
  const oldSaved = callbacks.saved!
  act(() => oldSaved({ ...first, VendorCode: 'SAVED-A' }))
  expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('SAVED-A')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  expect(loadProduct).toHaveBeenCalledOnce()
  loadProduct.mockResolvedValueOnce({ NetUid: 'B', VendorCode: 'CODE-B', NameUA: 'Товар Б' })
  fireEvent.click(screen.getByRole('button', { name: /CODE-B/ }))
  await waitFor(() => expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('CODE-B'))
  act(() => oldSaved({ ...first, VendorCode: 'LATE-A' }))
  expect(view.container.querySelector('.product-inline-code')?.textContent).toBe('CODE-B')
  expect(loadProduct).toHaveBeenCalledTimes(2)
})
