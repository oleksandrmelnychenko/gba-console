import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createProductOriginalNumber, getProductByNetId } from '../api/productsApi'
import { ProductsPage } from './ProductsPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/realtime/events', () => ({ realtimeEvents: {}, useRealtimeEvent: () => {} }))
vi.mock('../components/ProductPriceSourcePanel', () => ({ ProductPriceSourcePanel: () => null }))
vi.mock('../components/ShopImageGallery', () => ({ ShopImageGallery: () => null }))
vi.mock('../api/productsApi', async original => ({ ...await original<typeof import('../api/productsApi')>(),
  getProductByNetId: vi.fn(), getProductReservationByNetId: vi.fn(async () => ({})), createProductOriginalNumber: vi.fn(),
  getProducts: vi.fn(async () => []), getProductSiblings: vi.fn(async () => ({ Cards: [] })), getProductSiblingCounts: vi.fn(async () => []),
}))

beforeEach(() => {
  vi.mocked(getProductByNetId).mockResolvedValue({ NetUid: 'A', VendorCode: 'CODE-A', NameUA: 'Товар А', ProductOriginalNumbers: [] })
  vi.mocked(createProductOriginalNumber).mockReset()
})

it('caps the original number at 100 characters and refuses angle brackets', async () => {
  render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={['/products?netId=A']}><ProductsPage /></MemoryRouter></I18nProvider></MantineProvider>)

  fireEvent.click(await screen.findByRole('button', { name: /Оригінальні номери/ }))
  const input = await screen.findByRole('textbox', { name: 'Оригінальний номер' })
  expect(input.getAttribute('maxlength')).toBe('100')

  fireEvent.change(input, { target: { value: 'C2CAT-<b>OEM</b>' } })
  expect(await screen.findByText('Оригінальний номер не може містити символи < і >')).toBeTruthy()
  expect(createProductOriginalNumber).not.toHaveBeenCalled()
})
