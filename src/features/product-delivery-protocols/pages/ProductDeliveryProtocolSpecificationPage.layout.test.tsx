import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { SpecificationPackingList, SpecificationProtocol } from '../specificationTypes'
import { ProductDeliveryProtocolSpecificationPage } from './ProductDeliveryProtocolSpecificationPage'

const apiMocks = vi.hoisted(() => ({
  getPackingListSpecificationProducts: vi.fn(),
  getProtocolForSpecification: vi.fn(),
}))

vi.mock('../api/productDeliveryProtocolsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productDeliveryProtocolsApi')>(),
  getProtocolForSpecification: apiMocks.getProtocolForSpecification,
}))

vi.mock('../api/protocolSpecificationApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/protocolSpecificationApi')>(),
  getPackingListSpecificationProducts: apiMocks.getPackingListSpecificationProducts,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../components/SpecificationProductsGrid', () => ({
  SpecificationProductsGrid: () => <div data-testid="specification-products-grid">Specification products</div>,
}))

vi.mock('../components/SpecificationTotals', () => ({
  SpecificationTotals: () => <div data-testid="specification-totals">Specification totals</div>,
}))

const PROTOCOL_NET_ID = '7a22b582-e3bc-4f80-9539-b20c58459e86'
const INVOICE_NET_ID = 'dbb75529-f8fe-483d-ad96-03c675af0574'
const PACKING_LIST_NET_ID = '15056aad-263b-48e0-8be5-e5283ef52938'

const protocol: SpecificationProtocol = {
  DeliveryProductProtocolNumber: { Number: 'P000000001' },
  IsCompleted: false,
  IsShipped: true,
  NetUid: PROTOCOL_NET_ID,
  SupplyInvoices: [
    {
      DateFrom: '2026-08-27T00:00:00',
      Id: 11,
      NetUid: INVOICE_NET_ID,
      Number: 'INV-11',
      PackingLists: [
        {
          FromDate: '2026-08-27T00:00:00',
          Id: 12,
          InvNo: 'PL-12',
          NetUid: PACKING_LIST_NET_ID,
        },
      ],
      SupplyOrder: { Client: { FullName: 'Тестовий постачальник' } },
    },
  ],
}

const packingList: SpecificationPackingList = {
  Id: 12,
  NetUid: PACKING_LIST_NET_ID,
  PackingListPackageOrderItems: [
    {
      Id: 13,
      Qty: 500,
      SupplyInvoiceOrderItem: {
        Product: {
          Name: 'Комплект ремонтний тяги реактивної гума-метал',
          VendorCode: 'SEM7335',
        },
      },
    },
  ],
}

function renderPage() {
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/product-delivery-protocols/${PROTOCOL_NET_ID}/specifications`]}>
          <Routes>
            <Route
              path="/product-delivery-protocols/:id/specifications"
              element={<ProductDeliveryProtocolSpecificationPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('BUG-1193 protocol customs-code window', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getProtocolForSpecification.mockResolvedValue(protocol)
    apiMocks.getPackingListSpecificationProducts.mockResolvedValue(packingList)
  })

  it('uses the same full-page drawer width as Ukraine order specifications', async () => {
    renderPage()

    expect(await screen.findByRole('dialog', { name: /Митні коди згідно протоколу/ })).toBeTruthy()
    expect(
      document
        .querySelector<HTMLElement>('.mantine-Drawer-root')
        ?.style.getPropertyValue('--drawer-size'),
    ).toBe('calc(100vw - 16px)')
  })

  it('keeps the protocol controls, products and totals available in the expanded window', async () => {
    renderPage()

    expect(await screen.findByText('P000000001')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Друк PDF' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Пошук' }).getAttribute('placeholder')).toBe('Код товару')
    expect(screen.getByTestId('specification-products-grid')).toBeTruthy()
    expect(screen.getByTestId('specification-totals')).toBeTruthy()
    expect(apiMocks.getProtocolForSpecification).toHaveBeenCalledWith(PROTOCOL_NET_ID)
    expect(apiMocks.getPackingListSpecificationProducts).toHaveBeenCalledWith(PACKING_LIST_NET_ID)
  })
})
