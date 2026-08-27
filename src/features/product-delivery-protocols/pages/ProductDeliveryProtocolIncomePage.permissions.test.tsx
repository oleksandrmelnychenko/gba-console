import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProtocolForProductIncome } from '../api/productDeliveryProtocolsApi'
import {
  createProductIncomeFromPackingListDynamic,
  getOrganizationStorages,
  getPackingListSpecificationProducts,
  getProductIncomeByDeliveryProtocolNetId,
  getSupplyOrderInvoiceItems,
  updatePackingListInInvoice,
} from '../api/protocolProductIncomeApi'
import { ProductDeliveryProtocolIncomePage } from './ProductDeliveryProtocolIncomePage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
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
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
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
  NewIncomeDynamicColumnModal: ({ disabled, opened, onAdd }: {
    disabled: boolean
    opened: boolean
    onAdd: (fromDate: string) => void
  }) => opened
    ? <button disabled={disabled} onClick={() => onAdd('2026-08-18')}>Підтвердити додавання</button>
    : null,
}))

vi.mock('../components/ProtocolIncomePlacementDrawer', () => ({
  ProtocolIncomePlacementDrawer: () => null,
}))

const PACKING_LIST = {
  Id: 11,
  NetUid: 'pack-1',
  PackingListPackageOrderItems: [{
    Id: 111,
    IsReadyToPlaced: false,
    PlacedQty: 0,
    Qty: 4,
    SupplyInvoiceOrderItem: { Product: { Name: 'Товар', VendorCode: 'A-1' } },
  }],
  DynamicProductPlacementColumns: [{
    Id: 21,
    NetUid: 'column-1',
    FromDate: '2026-08-18',
    DynamicProductPlacementRows: [],
  }],
}

const INVOICE = {
  Id: 1,
  NetUid: 'invoice-1',
  Number: 'INV-1',
  PackingLists: [PACKING_LIST],
}

const PROTOCOL = {
  IsCompleted: true,
  NetUid: 'protocol-1',
  Organization: { NetUid: 'organization-1', Name: 'GBA' },
  SupplyInvoices: [INVOICE],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/product-delivery-protocols/protocol-1/product-income']}>
          <Routes>
            <Route
              path="/product-delivery-protocols/:id/product-income"
              element={<ProductDeliveryProtocolIncomePage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Product delivery protocol income permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProtocolForProductIncome).mockResolvedValue(PROTOCOL as never)
    vi.mocked(getProductIncomeByDeliveryProtocolNetId).mockResolvedValue(null)
    vi.mocked(getOrganizationStorages).mockResolvedValue([{ NetUid: 'storage-1', Name: 'Основний' }] as never)
    vi.mocked(getSupplyOrderInvoiceItems).mockResolvedValue(INVOICE as never)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(PACKING_LIST as never)
    vi.mocked(updatePackingListInInvoice).mockResolvedValue(INVOICE as never)
    vi.mocked(createProductIncomeFromPackingListDynamic).mockResolvedValue(PACKING_LIST as never)
  })

  it('does not mount income data without open access', () => {
    renderPage()

    expect(screen.getByText('Недостатньо прав для перегляду приходу товару')).toBeTruthy()
    expect(getProtocolForProductIncome).not.toHaveBeenCalled()
  })

  it('keeps capitalization independent from edit, readiness, document, and post actions', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Capitalize)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Оприходувати' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Всі готові до розміщення' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Документ PZ' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Провести' })).toBeNull()
  })

  it('rechecks capitalization permission in the final handler', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Capitalize)
    renderPage()

    const capitalize = await screen.findByRole('button', { name: 'Оприходувати' })
    allowedPermissions.delete(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Capitalize)
    fireEvent.click(capitalize)

    expect(createProductIncomeFromPackingListDynamic).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Capitalize)
    fireEvent.click(capitalize)

    await waitFor(() => expect(createProductIncomeFromPackingListDynamic).toHaveBeenCalledWith(
      'delivery-protocol',
      'capitalize',
      expect.stringContaining('2026-'),
      'storage-1',
      expect.objectContaining({ NetUid: 'pack-1' }),
    ))
  })

  it('rechecks placement-edit permission after the add modal is open', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.ProductIncome.EditPlacement)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Додати' }))
    const confirm = screen.getByRole('button', { name: 'Підтвердити додавання' })
    allowedPermissions.delete(PermissionKeys.ProductDeliveryProtocols.ProductIncome.EditPlacement)
    fireEvent.click(confirm)

    expect(updatePackingListInInvoice).not.toHaveBeenCalled()
  })
})
