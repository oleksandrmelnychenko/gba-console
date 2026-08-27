import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProtocolForSpecification } from '../api/productDeliveryProtocolsApi'
import {
  getPackingListSpecificationProducts,
  mergeSupplyInvoices,
} from '../api/protocolSpecificationApi'
import { ProductDeliveryProtocolSpecificationPage } from './ProductDeliveryProtocolSpecificationPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/productDeliveryProtocolsApi', () => ({
  getProtocolForSpecification: vi.fn(),
}))

vi.mock('../api/protocolDetailApi', () => ({
  searchDirectSupplyOrderSpecificationOrganizations: vi.fn(async () => []),
}))

vi.mock('../api/protocolSpecificationApi', () => ({
  addDeliveryDocumentsToInvoice: vi.fn(),
  addOrUpdateProductSpecification: vi.fn(),
  getPackingListSpecificationProducts: vi.fn(),
  getSpecificationDownloadUrls: vi.fn(),
  mergeSupplyInvoices: vi.fn(),
  uploadProductSpecificationForInvoice: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../components/MergeInvoicesModal', () => ({
  MergeInvoicesModal: ({ opened, onConfirm }: { opened: boolean; onConfirm: () => void }) =>
    opened ? <button onClick={onConfirm}>Підтвердити об'єднання</button> : null,
}))

vi.mock('../components/ProductSpecificationEditDrawer', () => ({
  ProductSpecificationEditDrawer: () => null,
}))

vi.mock('../components/SpecificationDownloadModal', () => ({
  SpecificationDownloadModal: () => null,
}))

vi.mock('../components/SpecificationProductsGrid', () => ({
  SpecificationProductsGrid: () => null,
}))

vi.mock('../components/SpecificationTotals', () => ({
  SpecificationTotals: () => null,
}))

vi.mock('../components/UploadDeliveryDocumentsModal', () => ({
  UploadDeliveryDocumentsModal: () => null,
}))

vi.mock('../components/UploadProductSpecificationModal', () => ({
  UploadProductSpecificationModal: () => null,
}))

vi.mock('../components/UploadProductSpecificationResultModal', () => ({
  UploadProductSpecificationResultModal: () => null,
}))

const PROTOCOL = {
  IsCompleted: false,
  IsShipped: true,
  NetUid: 'protocol-1',
  SupplyInvoices: [
    {
      Id: 1,
      NetUid: 'invoice-1',
      Number: 'INV-1',
      PackingLists: [{ Id: 11, NetUid: 'pack-1', PackingListPackageOrderItems: [] }],
    },
    {
      Id: 2,
      NetUid: 'invoice-2',
      Number: 'INV-2',
      PackingLists: [{ Id: 12, NetUid: 'pack-2', PackingListPackageOrderItems: [] }],
    },
  ],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/product-delivery-protocols/protocol-1/specifications']}>
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

describe('Product delivery protocol specification permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProtocolForSpecification).mockResolvedValue(PROTOCOL)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue({
      Id: 11,
      NetUid: 'pack-1',
      PackingListPackageOrderItems: [],
    })
    vi.mocked(mergeSupplyInvoices).mockResolvedValue(undefined)
  })

  it('does not mount specification data without open access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProtocolForSpecification).not.toHaveBeenCalled()
  })

  it('does not expose invoice merge with specification access alone', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Open)
    renderPage()

    await waitFor(() => expect(getProtocolForSpecification).toHaveBeenCalledWith('protocol-1'))
    expect(screen.queryByRole('button', { name: "Об'єднати інвойси?" })).toBeNull()
  })

  it('rechecks invoice merge permission at the final handler boundary', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Open)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.Invoice.Merge)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: "Об'єднати інвойси?" }))
    const confirm = screen.getByRole('button', { name: "Підтвердити об'єднання" })

    allowedPermissions.delete(PermissionKeys.ProductDeliveryProtocols.Invoice.Merge)
    fireEvent.click(confirm)
    expect(mergeSupplyInvoices).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.Invoice.Merge)
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(mergeSupplyInvoices).toHaveBeenCalledWith('protocol-1', ['invoice-1', 'invoice-2']),
    )
  })

  it('keeps customs-code upload available after the protocol has arrived', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Open)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.SpecificationCodes.Download)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.Invoice.Merge)
    vi.mocked(getProtocolForSpecification).mockResolvedValue({
      ...PROTOCOL,
      IsCompleted: true,
    })

    renderPage()

    expect(await screen.findByRole('button', { name: 'Завантаження митних кодів' })).toBeTruthy()
    expect(screen.queryByText('Редагування специфікації недоступне після завершення протоколу')).toBeNull()
    expect(screen.queryByRole('button', { name: "Об'єднати інвойси?" })).toBeNull()
  })
})
