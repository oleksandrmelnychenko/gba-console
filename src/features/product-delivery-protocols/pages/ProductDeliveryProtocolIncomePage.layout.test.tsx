import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  ProductDeliveryProtocolIncomeSheet,
  SupplyUkraineDirectOrderProductIncomePage,
} from './ProductDeliveryProtocolIncomePage'

const apiMocks = vi.hoisted(() => ({
  getDirectSupplyOrderForProductIncome: vi.fn(),
  getOrganizationStorages: vi.fn(),
  getPackingListSpecificationProducts: vi.fn(),
  getProductIncomeByDeliveryProtocolNetId: vi.fn(),
  getProductIncomeBySupplyOrderNetId: vi.fn(),
  getProtocolForProductIncome: vi.fn(),
  getSupplyOrderInvoiceItems: vi.fn(),
}))

vi.mock('../api/productDeliveryProtocolsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productDeliveryProtocolsApi')>(),
  getProtocolForProductIncome: apiMocks.getProtocolForProductIncome,
}))

vi.mock('../api/protocolProductIncomeApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/protocolProductIncomeApi')>(),
  getOrganizationStorages: apiMocks.getOrganizationStorages,
  getPackingListSpecificationProducts: apiMocks.getPackingListSpecificationProducts,
  getProductIncomeByDeliveryProtocolNetId: apiMocks.getProductIncomeByDeliveryProtocolNetId,
  getProductIncomeBySupplyOrderNetId: apiMocks.getProductIncomeBySupplyOrderNetId,
  getSupplyOrderInvoiceItems: apiMocks.getSupplyOrderInvoiceItems,
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../supply-ukraine-orders/api/supplyUkraineOrdersApi')>(),
  getDirectSupplyOrderForProductIncome: apiMocks.getDirectSupplyOrderForProductIncome,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ tableId }: { tableId: string }) => <div data-testid={`data-table-${tableId}`} />,
}))

const PROTOCOL_ID = '7a22b582-e3bc-4f80-9539-b20c58459e86'
const DIRECT_ORDER_ID = '3a290dd3-935b-4212-957b-d1d0067f6d2f'
const PROTOCOL_INVOICE_ID = 'dbb75529-f8fe-483d-ad96-03c675af0574'
const DIRECT_INVOICE_ID = '0e80ee8a-f099-44c6-b3bd-fd1d470d1735'
const PROTOCOL_PACKING_LIST_ID = '15056aad-263b-48e0-8be5-e5283ef52938'
const DIRECT_PACKING_LIST_ID = '5061aa33-1113-4b8f-8349-4317c31ba1c2'

const agreement = {
  Agreement: {
    Currency: { Code: 'EUR' },
    Name: 'Основний договір',
  },
}

const protocolSource = {
  DeliveryProductProtocolNumber: { Number: 'P000000001' },
  FromDate: '2026-08-27T00:00:00',
  IsCompleted: true,
  NetUid: PROTOCOL_ID,
  Organization: { Name: 'GBA Україна', NetUid: 'organization-1' },
  SupplyInvoices: [{
    NetUid: PROTOCOL_INVOICE_ID,
    Number: 'INV-PROTOCOL',
    SupplyOrder: {
      Client: { FullName: 'Постачальник з протоколу' },
      ClientAgreement: agreement,
    },
  }],
}

const directOrderSource = {
  Client: { FullName: 'Постачальник із замовлення' },
  ClientAgreement: agreement,
  DateFrom: '2026-08-27T00:00:00',
  HasArrivedDeliveryProtocol: true,
  NetUid: DIRECT_ORDER_ID,
  Organization: { Name: 'GBA Україна', NetUid: 'organization-1' },
  SupplyInvoices: [{
    DeliveryProductProtocol: { Deleted: false, IsCompleted: true },
    NetUid: DIRECT_INVOICE_ID,
    Number: 'INV-DIRECT',
  }],
  SupplyOrderNumber: { Number: 'SO-000001' },
}

function hydratedInvoice(invoiceId: string, packingListId: string) {
  return {
    // The current invoice-items DTO deliberately omits this navigation.
    DeliveryProductProtocol: null,
    NetUid: invoiceId,
    PackingLists: [{
      DynamicProductPlacementColumns: [],
      NetUid: packingListId,
      No: `PL-${packingListId.slice(0, 4)}`,
    }],
  }
}

function packingList(packingListId: string) {
  return {
    DynamicProductPlacementColumns: [],
    NetUid: packingListId,
    PackingListPackageOrderItems: [{
      Id: 13,
      IsReadyToPlaced: true,
      Qty: 4,
      SupplyInvoiceOrderItem: {
        Product: { NameUA: 'Тестовий товар', VendorCode: 'SKU-13' },
      },
    }],
  }
}

function renderRoute(element: ReactElement, path: string, routePath: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={element} path={routePath} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

async function captureFormSignature(expectedTitle: RegExp) {
  const dialog = await screen.findByRole('dialog', { name: expectedTitle })
  const summary = dialog.querySelector<HTMLElement>('.product-income-summary-panel')
  const controls = dialog.querySelector<HTMLElement>('.product-income-controls-panel')

  if (!summary || !controls) {
    throw new Error('Product-income form panels were not rendered')
  }

  return {
    actionLabels: within(controls).getAllByRole('button').map((button) => button.textContent),
    controlLabels: Array.from(controls.querySelectorAll('label')).map((label) => label.textContent),
    sectionTitles: Array.from(dialog.querySelectorAll('.app-section-title')).map((title) => title.textContent),
    summaryLabels: Array.from(summary.querySelectorAll('.product-income-detail-label')).map((label) => label.textContent),
  }
}

describe('BUG-1197 and BUG-1198 packing-list income form contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getProtocolForProductIncome.mockResolvedValue(protocolSource)
    apiMocks.getDirectSupplyOrderForProductIncome.mockResolvedValue(directOrderSource)
    apiMocks.getProductIncomeByDeliveryProtocolNetId.mockResolvedValue(null)
    apiMocks.getProductIncomeBySupplyOrderNetId.mockResolvedValue(null)
    apiMocks.getOrganizationStorages.mockResolvedValue([{ Name: 'Основний', NetUid: 'storage-1' }])
    apiMocks.getSupplyOrderInvoiceItems.mockImplementation((_scope: string, invoiceId: string) => Promise.resolve(
      invoiceId === PROTOCOL_INVOICE_ID
        ? hydratedInvoice(PROTOCOL_INVOICE_ID, PROTOCOL_PACKING_LIST_ID)
        : hydratedInvoice(DIRECT_INVOICE_ID, DIRECT_PACKING_LIST_ID),
    ))
    apiMocks.getPackingListSpecificationProducts.mockImplementation((_scope: string, packingListId: string) => (
      Promise.resolve(packingList(packingListId))
    ))
  })

  it('uses one observable form contract from the protocol and direct-order entry points', async () => {
    const protocolRender = renderRoute(
      <ProductDeliveryProtocolIncomeSheet sourceId={PROTOCOL_ID} onClose={vi.fn()} />,
      '/protocol-income',
      '/protocol-income',
    )
    const protocolSignature = await captureFormSignature(/Прихід товару згідно замовлення: P000000001/)

    protocolRender.unmount()
    cleanup()

    renderRoute(
      <SupplyUkraineDirectOrderProductIncomePage />,
      `/orders/ukraine/all/edit/${DIRECT_ORDER_ID}/product-income`,
      '/orders/ukraine/all/edit/:id/product-income',
    )
    const directSignature = await captureFormSignature(/Прихід товару згідно замовлення: SO-000001/)

    expect(protocolSignature).toEqual(directSignature)
    expect(protocolSignature.summaryLabels).toEqual([
      'Статус',
      'Від',
      'Організація',
      'Постачальник',
      'Договір',
      'Валюта',
    ])
    expect(protocolSignature.controlLabels).toContain('Інвойс')
    expect(protocolSignature.controlLabels).not.toContain('Накладна')
    expect(protocolSignature.controlLabels).not.toContain('Відсоток ПДВ')
    expect(protocolSignature.actionLabels).not.toContain('Документ PZ')
    expect(screen.getByTestId('data-table-protocol-product-income')).toBeTruthy()
  })

  it('keeps each API scope and the arrived direct-order fallback intact', async () => {
    const protocolRender = renderRoute(
      <ProductDeliveryProtocolIncomeSheet sourceId={PROTOCOL_ID} onClose={vi.fn()} />,
      '/protocol-income',
      '/protocol-income',
    )

    expect(await screen.findAllByText('Постачальник з протоколу')).not.toHaveLength(0)
    expect(apiMocks.getProtocolForProductIncome).toHaveBeenCalledWith(PROTOCOL_ID)
    expect(apiMocks.getProductIncomeByDeliveryProtocolNetId).toHaveBeenCalledWith(PROTOCOL_ID)
    expect(apiMocks.getDirectSupplyOrderForProductIncome).not.toHaveBeenCalled()
    expect(apiMocks.getSupplyOrderInvoiceItems).toHaveBeenCalledWith('delivery-protocol', PROTOCOL_INVOICE_ID)

    protocolRender.unmount()
    cleanup()
    vi.clearAllMocks()

    renderRoute(
      <SupplyUkraineDirectOrderProductIncomePage />,
      `/orders/ukraine/all/edit/${DIRECT_ORDER_ID}/product-income`,
      '/orders/ukraine/all/edit/:id/product-income',
    )

    expect(await screen.findAllByText('Постачальник із замовлення')).not.toHaveLength(0)
    const capitalizeButton = screen.getByRole('button', { name: 'Оприходувати' })
    expect(capitalizeButton.hasAttribute('disabled')).toBe(false)
    expect(screen.queryByText('Оприходування доступне після того, як протокол доставки має статус «Прибув»')).toBeNull()
    expect(apiMocks.getDirectSupplyOrderForProductIncome).toHaveBeenCalledWith(DIRECT_ORDER_ID)
    expect(apiMocks.getProductIncomeBySupplyOrderNetId).toHaveBeenCalledWith(DIRECT_ORDER_ID)
    expect(apiMocks.getProtocolForProductIncome).not.toHaveBeenCalled()
    expect(apiMocks.getSupplyOrderInvoiceItems).toHaveBeenCalledWith('direct-supply-order', DIRECT_INVOICE_ID)
  })
})
