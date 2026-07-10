import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductByNetId, getProductReservationByNetId } from '../api/productsApi'
import type { Product } from '../types'

vi.mock('../api/productsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productsApi')>()

  return {
    ...actual,
    getProductByNetId: vi.fn(),
    getProductReservationByNetId: vi.fn(),
  }
})

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
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

beforeEach(() => {
  getProductByNetIdMock.mockReset()
  getProductReservationByNetIdMock.mockReset()
})

describe('ProductsPage product analytics action', () => {
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
})
