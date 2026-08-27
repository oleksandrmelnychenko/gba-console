import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { RemainingConsignment } from '../types'
import {
  exportGroupedProductRemains,
  getGroupedProductRemains,
  getProductRemainMovements,
  getProductRemainStorages,
  getProductRemainSuppliers,
  getProductRemains,
} from '../api/productRemainsApi'
import { ProductRemainsPage } from './ProductRemainsPage'

const allowedPermissions = new Set<string>()
const productRow = {
  ConsignmentItemNetId: 'item-1',
  Product: { Name: 'Товар', VendorCode: 'P-1' },
} as RemainingConsignment

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null, permissionKey }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/productRemainsApi', () => ({
  exportGroupedProductRemains: vi.fn(),
  exportProductRemains: vi.fn(),
  getGroupedProductRemains: vi.fn(),
  getProductRemainMovements: vi.fn(),
  getProductRemainStorages: vi.fn(),
  getProductRemainSuppliers: vi.fn(),
  getProductRemains: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, onRowClick, tableId }: {
    data: RemainingConsignment[]
    onRowClick?: (row: RemainingConsignment) => void
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {tableId === 'product-remains-products' && data[0] && onRowClick && (
        <button type="button" onClick={() => onRowClick(data[0])}>open-movement</button>
      )}
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
    <MemoryRouter initialEntries={['/products/storages/incomes/products']}>
      <MantineProvider>
        <I18nProvider>
          <ProductRemainsPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Product remains canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductRemainStorages).mockResolvedValue([])
    vi.mocked(getProductRemainSuppliers).mockResolvedValue([])
    vi.mocked(getGroupedProductRemains).mockResolvedValue({ Collection: [] })
    vi.mocked(getProductRemains).mockResolvedValue({ Collection: [productRow] })
    vi.mocked(getProductRemainMovements).mockResolvedValue([])
    vi.mocked(exportGroupedProductRemains).mockResolvedValue({ DocumentURL: '/remains.xlsx' })
  })

  it('does not mount page data without page.view', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductRemainStorages).not.toHaveBeenCalled()
    expect(getGroupedProductRemains).not.toHaveBeenCalled()
    expect(getProductRemains).not.toHaveBeenCalled()
  })

  it('keeps page access independent from export and rechecks the right in the handler', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.ConsignmentBalances.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.ConsignmentBalances.Document.Export)
    renderPage()

    const exportButton = await screen.findByRole('button', { name: 'Експорт' })
    allowedPermissions.delete(PermissionKeys.WarehouseAccounting.ConsignmentBalances.Document.Export)
    fireEvent.click(exportButton)

    expect(exportGroupedProductRemains).not.toHaveBeenCalled()
  })

  it('keeps movement independent and rechecks it before opening the protected loader', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.ConsignmentBalances.View)
    allowedPermissions.add(PermissionKeys.ProductsAssortment.Movement.Open)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Товари' }))
    const movementButton = await screen.findByRole('button', { name: 'open-movement' })
    allowedPermissions.delete(PermissionKeys.ProductsAssortment.Movement.Open)
    fireEvent.click(movementButton)
    expect(getProductRemainMovements).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.ProductsAssortment.Movement.Open)
    fireEvent.click(movementButton)
    await waitFor(() => expect(getProductRemainMovements).toHaveBeenCalledWith(expect.objectContaining({
      consignmentItemNetId: 'item-1',
    })))
  })
})
