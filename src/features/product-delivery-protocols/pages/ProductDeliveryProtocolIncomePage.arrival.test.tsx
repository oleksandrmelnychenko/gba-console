import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getDirectSupplyOrderForProductIncome } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import {
  createProductIncomeFromPackingListDynamic,
  getOrganizationStorages,
  getPackingListSpecificationProducts,
  getProductIncomeBySupplyOrderNetId,
  getSupplyOrderInvoiceItems,
} from '../api/protocolProductIncomeApi'
import { SupplyUkraineDirectOrderProductIncomePage } from './ProductDeliveryProtocolIncomePage'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/productDeliveryProtocolsApi', () => ({
  getProtocolForProductIncome: vi.fn(),
}))

vi.mock('../api/protocolProductIncomeApi', () => ({
  addDynamicPlacementRow: vi.fn(),
  createProductIncomeFromPackingListDynamic: vi.fn(),
  getOrganizationStorages: vi.fn(),
  getPackingListSpecificationProducts: vi.fn(),
  getProductIncomeByDeliveryProtocolNetId: vi.fn(),
  getProductIncomeBySupplyOrderNetId: vi.fn(),
  getPzDocumentBySupplyInvoiceId: vi.fn(),
  getSupplyOrderInvoiceItems: vi.fn(),
  markAllItemsReadyToPlace: vi.fn(),
  updateDynamicPlacementRow: vi.fn(),
  updatePackingListInInvoice: vi.fn(),
  updateVatOfPackListInvoiceItems: vi.fn(),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getDirectSupplyOrderForProductIncome: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <section>{title}{children}</section> : null,
  AppDrawerFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div data-testid="income-table" />,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../components/NewIncomeDynamicColumnModal', () => ({
  NewIncomeDynamicColumnModal: () => null,
}))

vi.mock('../components/ProtocolIncomePlacementDrawer', () => ({
  ProtocolIncomePlacementDrawer: () => null,
}))

const ORDER_ID = '4cf05247-b435-4ca6-9614-55c3afd42739'
const INVOICE_ID = '28df7843-0052-475f-ae01-d6ae42194753'
const PACKING_LIST_ID = 'cbaf308f-9313-4579-9e98-5311b91cc1f1'
const ARRIVAL_WARNING = 'Оприходування доступне після того, як протокол доставки має статус «Прибув»'

const PACKING_LIST = {
  Id: 89,
  NetUid: PACKING_LIST_ID,
  No: '89',
  DynamicProductPlacementColumns: [],
  PackingListPackageOrderItems: [{
    Id: 1199,
    IsReadyToPlaced: true,
    PlacedQty: 0,
    Qty: 3248,
    SupplyInvoiceOrderItem: {
      Product: { Name: 'Товар з P0000000001', VendorCode: 'SEM7335' },
    },
  }],
}

const HYDRATED_INVOICE_WITHOUT_PROTOCOL = {
  DeliveryProductProtocol: null,
  Id: 8,
  NetUid: INVOICE_ID,
  Number: '8',
  PackingLists: [PACKING_LIST],
}

function directOrder(isArrived: boolean) {
  return {
    HasArrivedDeliveryProtocol: isArrived,
    NetUid: ORDER_ID,
    Organization: { Name: 'ТОВ «АМГ «КОНКОРД»', NetUid: 'organization-1' },
    SupplyInvoices: [{
      DeliveryProductProtocol: {
        Deleted: false,
        IsCompleted: isArrived,
      },
      NetUid: INVOICE_ID,
      Number: '8',
    }],
  }
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/orders/ukraine/all/edit/${ORDER_ID}/product-income`]}>
          <Routes>
            <Route
              element={<SupplyUkraineDirectOrderProductIncomePage />}
              path="/orders/ukraine/all/edit/:id/product-income"
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('BUG-1199 direct-order product income arrival gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProductIncomeBySupplyOrderNetId).mockResolvedValue(null)
    vi.mocked(createProductIncomeFromPackingListDynamic).mockResolvedValue(PACKING_LIST as never)
    vi.mocked(getOrganizationStorages).mockResolvedValue([
      { Name: 'Автопарк Конкорд', NetUid: 'storage-1' },
    ] as never)
    vi.mocked(getSupplyOrderInvoiceItems).mockResolvedValue(HYDRATED_INVOICE_WITHOUT_PROTOCOL as never)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(PACKING_LIST as never)
  })

  it('enables income for the arrived selected invoice when the invoice-items DTO omits its protocol navigation', async () => {
    vi.mocked(getDirectSupplyOrderForProductIncome).mockResolvedValue(directOrder(true) as never)

    renderPage()

    const capitalize = await screen.findByTestId('income-capitalize')

    await waitFor(() => expect(capitalize.hasAttribute('disabled')).toBe(false))
    expect(screen.queryByText(ARRIVAL_WARNING)).toBeNull()
    expect(screen.getByTestId('income-table')).toBeTruthy()
    expect(getSupplyOrderInvoiceItems).toHaveBeenCalledWith('direct-supply-order', INVOICE_ID)

    fireEvent.click(capitalize)

    await waitFor(() => expect(createProductIncomeFromPackingListDynamic).toHaveBeenCalledWith(
      'direct-supply-order',
      'capitalize',
      expect.stringContaining('T'),
      'storage-1',
      expect.objectContaining({ NetUid: PACKING_LIST_ID }),
    ))
  })

  it('keeps income blocked when the selected invoice protocol has not arrived', async () => {
    vi.mocked(getDirectSupplyOrderForProductIncome).mockResolvedValue(directOrder(false) as never)

    renderPage()

    expect(await screen.findByText(ARRIVAL_WARNING)).toBeTruthy()
    expect(screen.queryByTestId('income-capitalize')).toBeNull()
  })
})
