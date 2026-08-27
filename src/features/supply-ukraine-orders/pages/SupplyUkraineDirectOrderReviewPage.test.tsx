import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DirectSupplyOrder, SupplyOrderItem } from '../types'
import { SupplyUkraineDirectOrderInvoicesPage } from './SupplyUkraineDirectOrderInvoicesPage'

const apiMocks = vi.hoisted(() => ({
  getDirectSupplyOrderForInvoices: vi.fn(),
  getDirectSupplyOrderInvoiceInformationProtocolKeys: vi.fn(),
  getDirectSupplyOrderInvoicePaymentProtocolKeys: vi.fn(),
  getDirectSupplyOrderInvoiceResponsibleUsers: vi.fn(),
  getSupplyOrderInvoiceTotalsForInvoices: vi.fn(),
  getSupplyOrderItemsForInvoices: vi.fn(),
}))

vi.mock('../api/supplyUkraineOrdersApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/supplyUkraineOrdersApi')>(),
  ...apiMocks,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

const ORDER_NET_UID = '5c4de72c-471a-465d-a05b-77ce00726b96'
const ORDER_ITEM: SupplyOrderItem = {
  Id: 1,
  NetUid: '19b68624-259d-4a69-b5e6-b97c96283df0',
  Product: {
    Name: 'Кабель електричний',
    NetUid: '1ba2ee76-d092-42a9-aeb7-198616a47c63',
    VendorCode: '2010270HP',
  },
  Qty: 20,
  TotalAmount: 240,
  UnitPrice: 12,
}

function createOrder(patch: Partial<DirectSupplyOrder> = {}): DirectSupplyOrder {
  return {
    Client: { Name: 'SETFREN OTOMOTIV' },
    NetUid: ORDER_NET_UID,
    SupplyInvoices: [],
    SupplyOrderNumber: { Number: '00000002413' },
    SupplyProForm: null,
    SupplyProFormId: null,
    ...patch,
  }
}

function renderReviewPage() {
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/orders/ukraine/all/edit/${ORDER_NET_UID}/supply-invoices`]}>
          <Routes>
            <Route
              path="/orders/ukraine/all/edit/:id/supply-invoices"
              element={<SupplyUkraineDirectOrderInvoicesPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('BUG-1187 direct-order products page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getDirectSupplyOrderForInvoices.mockResolvedValue(createOrder())
    apiMocks.getDirectSupplyOrderInvoiceInformationProtocolKeys.mockResolvedValue([])
    apiMocks.getDirectSupplyOrderInvoicePaymentProtocolKeys.mockResolvedValue([])
    apiMocks.getDirectSupplyOrderInvoiceResponsibleUsers.mockResolvedValue([])
    apiMocks.getSupplyOrderInvoiceTotalsForInvoices.mockResolvedValue({})
    apiMocks.getSupplyOrderItemsForInvoices.mockResolvedValue([ORDER_ITEM])
  })

  it('loads the exact products tab before a proforma and keeps invoice creation read-only', async () => {
    renderReviewPage()

    expect(await screen.findByRole('tab', { name: 'Товари замовлення' })).toBeTruthy()
    expect(await screen.findByText('Кабель електричний')).toBeTruthy()
    expect(screen.getByText('2010270HP')).toBeTruthy()
    expect(screen.getAllByText('Кількість').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Залишок').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ціна').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Сума нетто').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Додати інвойс' })).toBeNull()
    expect(apiMocks.getDirectSupplyOrderForInvoices).toHaveBeenCalledWith(ORDER_NET_UID)
    expect(apiMocks.getSupplyOrderItemsForInvoices).toHaveBeenCalledWith(ORDER_NET_UID)
    expect(apiMocks.getSupplyOrderInvoiceTotalsForInvoices).toHaveBeenCalledWith(ORDER_NET_UID)
  })

  it('restores invoice creation after a proforma exists', async () => {
    apiMocks.getDirectSupplyOrderForInvoices.mockResolvedValue(createOrder({
      IsApproved: true,
      SupplyProForm: { Id: 17, Number: 'PF-17' },
      SupplyProFormId: 17,
    }))

    renderReviewPage()

    expect(await screen.findByRole('button', { name: 'Додати інвойс' })).toBeTruthy()
  })
})
