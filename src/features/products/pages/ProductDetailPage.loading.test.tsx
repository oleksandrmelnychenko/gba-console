import { MantineProvider } from '@mantine/core'
import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductByNetId, getProductReservationByNetId } from '../api/productsApi'
import type { ProductReservation } from '../types'
import { ProductDetailPage } from './ProductDetailPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/realtime/events', () => ({ realtimeEvents: {}, useRealtimeEvent: () => {} }))
vi.mock('../api/productsApi', async original => ({ ...await original<typeof import('../api/productsApi')>(),
  getProductByNetId: vi.fn(), getProductReservationByNetId: vi.fn() }))

it('shows the card and prices without waiting for reserves, using a loading state instead of zero reserves', async () => {
  vi.mocked(getProductByNetId).mockResolvedValue({ NetUid: 'product-1', VendorCode: 'FAST-PRODUCT', CurrentPrice: 42.75 })
  let finish!: (reservation: ProductReservation) => void
  vi.mocked(getProductReservationByNetId).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={['/products/product-1']}>
    <Routes><Route path="/products/:netId" element={<ProductDetailPage />} /></Routes>
  </MemoryRouter></I18nProvider></MantineProvider>)
  expect(await screen.findByText('42,75')).toBeTruthy()
  expect(screen.getAllByText('FAST-PRODUCT').length).toBeGreaterThan(0)
  expect(screen.getByRole('status').textContent).toBe('Завантаження резервів')
  const tile = screen.getByText('В рахунках в Україні').parentElement!
  expect(within(tile).getByText('-')).toBeTruthy()
  await act(async () => finish({ TotalReservedUK: 17 }))
  expect(screen.queryByText('Завантаження резервів')).toBeNull()
  expect(within(tile).getByText('17')).toBeTruthy()
})
