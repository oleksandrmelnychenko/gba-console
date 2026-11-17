import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductByNetId } from '../api/productsApi'
import { ProductsPage } from './ProductsPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/realtime/events', () => ({ realtimeEvents: {}, useRealtimeEvent: () => {} }))
vi.mock('../components/ProductPriceSourcePanel', () => ({ ProductPriceSourcePanel: () => null }))
vi.mock('../components/ShopImageGallery', () => ({ ShopImageGallery: () => null }))
vi.mock('../api/productsApi', async original => ({ ...await original<typeof import('../api/productsApi')>(),
  getProductByNetId: vi.fn(), getProductReservationByNetId: vi.fn(async () => ({})),
  getProducts: vi.fn(async () => []), getProductSiblings: vi.fn(async () => ({ Cards: [] })), getProductSiblingCounts: vi.fn(async () => []),
}))
const loadProduct = vi.mocked(getProductByNetId)

function renderPage(netId: string) {
  return render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={[`/products?netId=${netId}`]}><ProductsPage /></MemoryRouter></I18nProvider></MantineProvider>)
}

beforeEach(() => {
  loadProduct.mockReset()
})

it('says «Товар не знайдено» for a deep link to a product that does not exist', async () => {
  loadProduct.mockResolvedValue(null)
  renderPage('00000000-0000-0000-0000-000000000000')
  expect(await screen.findByText('Товар не знайдено')).toBeTruthy()
})

it('says «Товар не знайдено» instead of the raw server error for a malformed netId', async () => {
  loadProduct.mockRejectedValue(new Error('The value \'not-a-guid\' is not valid.'))
  renderPage('not-a-guid')
  expect(await screen.findByText('Товар не знайдено')).toBeTruthy()
  expect(screen.queryByText(/is not valid/)).toBeNull()
})

it('keeps the plain picker for the «Весь асортимент» sentinel', async () => {
  renderPage('assortment')
  expect(await screen.findByText('Оберіть товар у барабанчику')).toBeTruthy()
  expect(screen.queryByText('Товар не знайдено')).toBeNull()
  expect(loadProduct).not.toHaveBeenCalled()
})
