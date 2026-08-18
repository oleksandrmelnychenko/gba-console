import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
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
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div data-testid="product-storages-table" />,
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
      { Name: 'Основний склад', NetUid: 'storage-1' },
    ])
    vi.mocked(getAvailableProductsByStorage).mockResolvedValue({ items: [], totalQty: 0 })
    vi.mocked(exportProductStorageAvailability).mockResolvedValue({
      PdfDocumentURL: '/storage.pdf',
      XlsxDocument: '/storage.xlsx',
    })
  })

  it('does not mount storage data without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductStorageStorages).not.toHaveBeenCalled()
  })

  it('does not expose export with page access alone', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Page.View)
    renderPage()

    await screen.findByTestId('product-storages-table')
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
})
