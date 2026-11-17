import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { getProductByNetId } from './api/productsApi'
import { PRODUCT_IMAGE_PLACEHOLDER } from './productImagePlaceholder'
import { ProductsPage } from './pages/ProductsPage'

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../shared/realtime/events', () => ({ realtimeEvents: {}, useRealtimeEvent: () => {} }))
vi.mock('./components/ProductPriceSourcePanel', () => ({ ProductPriceSourcePanel: () => null }))
vi.mock('./components/ShopImageGallery', () => ({ ShopImageGallery: () => null }))
vi.mock('./api/productsApi', async original => ({ ...await original<typeof import('./api/productsApi')>(),
  getProductByNetId: vi.fn(), getProductReservationByNetId: vi.fn(async () => ({})),
  getProducts: vi.fn(async () => []), getProductSiblings: vi.fn(async () => ({ Cards: [] })), getProductSiblingCounts: vi.fn(async () => []),
}))

beforeEach(() => {
  vi.mocked(getProductByNetId).mockResolvedValue({
    NetUid: 'A', VendorCode: 'QA-BRK-003', NameUA: 'Гальмо', Image: 'https://concord-shop.com/userdata/shop/product/qa-brk-003_water.jpg',
  })
})

it('swaps a product picture that fails to load for the local placeholder', async () => {
  render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={['/products?netId=A']}><ProductsPage /></MemoryRouter></I18nProvider></MantineProvider>)

  const image = await screen.findByAltText('Гальмо') as HTMLImageElement
  expect(image.getAttribute('src')).toContain('concord-shop.com')
  fireEvent.error(image)
  expect((await screen.findByAltText('Гальмо')).getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER)
  expect(PRODUCT_IMAGE_PLACEHOLDER.startsWith('data:image/svg+xml')).toBe(true)
})
