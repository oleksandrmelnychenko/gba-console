import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductForOrderSpecifications } from '../../products/api/productsApi'
import {
  getPackingListSpecificationProducts,
  uploadProductSpecificationForInvoice,
} from '../../product-delivery-protocols/api/protocolSpecificationApi'
import type { ProductSpecificationParseConfiguration } from '../../product-delivery-protocols/specificationTypes'
import {
  getDirectSupplyOrderForSpecifications,
  getSupplyInvoiceItemsForSpecifications,
} from '../api/supplyUkraineOrdersApi'
import { SupplyUkraineDirectOrderSpecificationsPage } from './SupplyUkraineDirectOrderSpecificationsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../../products/api/productsApi', () => ({
  getProductForOrderSpecifications: vi.fn(),
}))

vi.mock('../../product-delivery-protocols/api/protocolSpecificationApi', () => ({
  addOrUpdateProductSpecification: vi.fn(),
  getPackingListSpecificationProducts: vi.fn(),
  getSpecificationDownloadUrls: vi.fn(),
  uploadProductSpecificationForInvoice: vi.fn(),
}))

vi.mock('../api/supplyUkraineOrdersApi', () => ({
  addDeliveryDocumentsToDirectSupplyInvoiceForSpecifications: vi.fn(),
  getDirectSupplyOrderForSpecifications: vi.fn(),
  getSupplyInvoiceItemsForSpecifications: vi.fn(),
  searchSupplyOrderServiceOrganizationsForSpecifications: vi.fn(async () => []),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../product-delivery-protocols/components/SpecificationProductsGrid', () => ({
  SpecificationProductsGrid: ({
    onEditSpecification,
    onOpenProductCard,
  }: {
    onEditSpecification?: (item: { NetUid: string }) => void
    onOpenProductCard?: (productNetId: string) => void
  }) => (
    <section>
      {onOpenProductCard && <button onClick={() => onOpenProductCard('product-1')}>product-card</button>}
      {onEditSpecification && <button onClick={() => onEditSpecification({ NetUid: 'item-1' })}>spec-edit</button>}
    </section>
  ),
}))

vi.mock('../../product-delivery-protocols/components/SpecificationTotals', () => ({
  SpecificationTotals: () => null,
}))

vi.mock('../../product-delivery-protocols/components/UploadProductSpecificationModal', () => ({
  UploadProductSpecificationModal: ({
    opened,
    onSubmit,
  }: {
    opened: boolean
    onSubmit: (
      configuration: ProductSpecificationParseConfiguration,
      date: string,
      file: File,
    ) => Promise<void>
  }) => opened ? (
    <button
      onClick={() => void onSubmit({
        CustomsValue: 2,
        Duty: 3,
        EndRow: 2,
        Price: 4,
        Qty: 5,
        SpecificationCode: 6,
        StartRow: 1,
        VATValue: 7,
        VendorCode: 1,
      }, '2026-08-18', new File(['x'], 'spec.xlsx'))}
    >
      upload-final
    </button>
  ) : null,
}))

vi.mock('../../product-delivery-protocols/components/UploadProductSpecificationResultModal', () => ({
  UploadProductSpecificationResultModal: () => null,
}))

vi.mock('../../product-delivery-protocols/components/UploadDeliveryDocumentsModal', () => ({
  UploadDeliveryDocumentsModal: () => null,
}))

vi.mock('../../product-delivery-protocols/components/SpecificationDownloadModal', () => ({
  SpecificationDownloadModal: () => null,
}))

vi.mock('../../product-delivery-protocols/components/ProductSpecificationEditDrawer', () => ({
  ProductSpecificationEditDrawer: () => null,
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: ({
    loadProduct,
    productNetId,
  }: {
    loadProduct: typeof getProductForOrderSpecifications
    productNetId: string | null
  }) => productNetId ? (
    <output data-loader={loadProduct === getProductForOrderSpecifications ? 'scoped' : 'legacy'}>
      {productNetId}
    </output>
  ) : null,
}))

const ORDER = {
  NetUid: 'order-1',
  SupplyInvoices: [{ NetUid: 'invoice-1', Number: 'INV-1', PackingLists: [{ Id: 1, NetUid: 'pack-1' }] }],
}

const INVOICE = {
  NetUid: 'invoice-1',
  Number: 'INV-1',
  PackingLists: [{ Id: 1, NetUid: 'pack-1' }],
  SupplyInvoiceDeliveryDocuments: [],
}

const PACKING_LIST = {
  Id: 1,
  NetUid: 'pack-1',
  PackingListPackageOrderItems: [{ NetUid: 'item-1' }],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/all/edit/order-1/specifications']}>
          <Routes>
            <Route
              path="/orders/ukraine/all/edit/:id/specifications"
              element={<SupplyUkraineDirectOrderSpecificationsPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Supply Ukraine direct-order specification permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getDirectSupplyOrderForSpecifications).mockResolvedValue(ORDER)
    vi.mocked(getSupplyInvoiceItemsForSpecifications).mockResolvedValue(INVOICE)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(PACKING_LIST)
    vi.mocked(uploadProductSpecificationForInvoice).mockResolvedValue(null)
  })

  it('does not mount the model or call APIs without specification-page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getDirectSupplyOrderForSpecifications).not.toHaveBeenCalled()
  })

  it('keeps product-card read independent and injects the scoped loader', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenSpecificationCodes)
    const withoutProductRead = renderPage()

    await waitFor(() => expect(getPackingListSpecificationProducts).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'product-card' })).toBeNull()
    withoutProductRead.unmount()

    vi.clearAllMocks()
    vi.mocked(getDirectSupplyOrderForSpecifications).mockResolvedValue(ORDER)
    vi.mocked(getSupplyInvoiceItemsForSpecifications).mockResolvedValue(INVOICE)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(PACKING_LIST)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenProducts)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'product-card' }))

    const productCard = screen.getByText('product-1')
    expect(productCard.getAttribute('data-loader')).toBe('scoped')
  })

  it('rechecks specification upload permission at the final handler boundary', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenSpecificationCodes)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.SpecificationCodes.DownloadCodes)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Завантаження митних кодів' }))
    const finalSubmit = screen.getByRole('button', { name: 'upload-final' })

    allowedPermissions.delete(PermissionKeys.OrdersUkraine.SpecificationCodes.DownloadCodes)
    fireEvent.click(finalSubmit)
    expect(uploadProductSpecificationForInvoice).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.OrdersUkraine.SpecificationCodes.DownloadCodes)
    fireEvent.click(finalSubmit)

    await waitFor(() => expect(uploadProductSpecificationForInvoice).toHaveBeenCalledWith(
      'invoice-1',
      expect.any(Object),
      '2026-08-18',
      expect.any(File),
      'direct-supply-order',
    ))
  })
})
