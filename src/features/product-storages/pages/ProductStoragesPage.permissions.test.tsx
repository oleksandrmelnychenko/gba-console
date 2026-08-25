import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createProductStorageTransfer,
  exportProductStorageAvailability,
  getAvailableProductsByStorage,
  getProductStorageStorages,
} from '../api/productStoragesApi'
import { ProductStoragesPage } from './ProductStoragesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
    user: null,
  }),
}))

vi.mock('../api/productStoragesApi', () => ({
  createProductStorageSupplyReturn: vi.fn(),
  createProductStorageTransfer: vi.fn(),
  createProductStorageWriteOff: vi.fn(),
  exportProductStorageAvailability: vi.fn(),
  getAvailableProductsByStorage: vi.fn(),
  getProductStorageAvailableConsignments: vi.fn(),
  getProductStorageStorages: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) =>
    opened ? <section>{children}{footer}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns = [], data = [], tableId }: {
    columns?: Array<{ cell?: (row: unknown) => ReactNode; id: string }>
    data?: unknown[]
    tableId?: string
  }) => (
    <div data-testid={tableId || 'data-table'}>
      {tableId === 'product-storages' && data[0]
        ? columns.find((column) => column.id === 'actions')?.cell?.(data[0])
        : null}
    </div>
  ),
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductStoragesPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Product storages canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductStorageStorages).mockResolvedValue([
      { Name: 'Основний склад', NetUid: 'storage-1', Organization: { Id: 1, Name: 'Організація 1' } },
      { Name: 'Інший склад', NetUid: 'storage-2', Organization: { Id: 2, Name: 'Організація 2' } },
    ])
    vi.mocked(getAvailableProductsByStorage).mockResolvedValue({
      items: [{
        NetUid: 'availability-1',
        Product: { NetUid: 'product-1', VendorCode: 'P-1' },
        Qty: 5,
        Storage: { Name: 'Основний склад', NetUid: 'storage-1', Organization: { Id: 1, Name: 'Організація 1' } },
      }],
      totalQty: 1,
    })
    vi.mocked(exportProductStorageAvailability).mockResolvedValue({
      PdfDocumentURL: '/storage.pdf',
      XlsxDocument: '/storage.xlsx',
    })
    vi.mocked(createProductStorageTransfer).mockResolvedValue(undefined)
  })

  it('does not mount storage data without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductStorageStorages).not.toHaveBeenCalled()
  })

  it('does not expose export with page access alone', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Page.View)
    renderPage()

    await screen.findByTestId('product-storages')
    expect(screen.queryByRole('button', { name: 'Експорт' })).toBeNull()
    expect(exportProductStorageAvailability).not.toHaveBeenCalled()
  })

  it('exports independently when the document right is assigned', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Експорт' }))

    await waitFor(() =>
      expect(exportProductStorageAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ storageNetId: 'storage-1' }),
      ),
    )
  })

  it('does not render a technical action opener without the business permission', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.PositionAction.Open)
    renderPage()

    await screen.findByTestId('product-storages')
    expect(screen.queryByRole('button', { name: 'Операція зі складської позиції' })).toBeNull()
  })

  it('submits a management cross-organization action only with its canonical key', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.PositionAction.Management)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Операція зі складської позиції' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Управлінська операція' }))
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити' }))

    await waitFor(() => expect(createProductStorageTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        productTransfer: expect.objectContaining({
          IsManagement: true,
          ToStorage: expect.objectContaining({ NetUid: 'storage-2' }),
        }),
      }),
    ))
  })
})
