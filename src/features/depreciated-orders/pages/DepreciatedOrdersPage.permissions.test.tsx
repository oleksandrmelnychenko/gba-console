import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createDepreciatedOrderFromFile,
  exportDepreciatedOrderDocument,
  getDepreciatedOrderByNetId,
  getDepreciatedOrderStorages,
  getDepreciatedOrders,
} from '../api/depreciatedOrdersApi'
import type { DepreciatedOrder, DepreciatedOrderCreateFromFilePayload } from '../types'
import { DepreciatedOrdersPage } from './DepreciatedOrdersPage'

const allowedPermissions = new Set<string>()
const order: DepreciatedOrder = {
  NetUid: 'order-1',
  Number: '0001',
  DepreciatedOrderItems: [],
}
const createPayload = {
  file: new File(['xlsx'], 'write-off.xlsx'),
  parseConfiguration: {
    EndRow: 5,
    QtyColumnNumber: 2,
    StartRow: 2,
    VendorCodeColumnNumber: 1,
  },
  depreciatedOrder: {
    Comment: 'Причина',
    FromDate: '2026-08-19T10:00:00.000Z',
    IsManagement: false,
    Storage: { NetUid: 'storage-1' },
  },
} satisfies DepreciatedOrderCreateFromFilePayload

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

vi.mock('../api/depreciatedOrdersApi', () => ({
  createDepreciatedOrderFromFile: vi.fn(),
  exportDepreciatedOrderDocument: vi.fn(),
  getDepreciatedOrderByNetId: vi.fn(),
  getDepreciatedOrderStorages: vi.fn(),
  getDepreciatedOrders: vi.fn(),
}))

vi.mock('../components/DepreciatedOrderCreateModal', () => ({
  DepreciatedOrderCreateModal: ({ canCreateManagement, opened, onCreate }: {
    canCreateManagement: boolean
    opened: boolean
    onCreate: (payload: DepreciatedOrderCreateFromFilePayload) => void
  }) => opened ? (
    <div>
      {canCreateManagement ? <span>management-create-enabled</span> : null}
      <button type="button" onClick={() => onCreate(createPayload)}>submit-create</button>
      <button
        type="button"
        onClick={() => onCreate({
          ...createPayload,
          depreciatedOrder: { ...createPayload.depreciatedOrder, IsManagement: true },
        })}
      >submit-management</button>
    </div>
  ) : null,
}))

vi.mock('../components/DepreciatedOrderExceptionsModal', () => ({
  DepreciatedOrderExceptionsModal: () => null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, onRowClick, tableId }: {
    data: DepreciatedOrder[]
    onRowClick?: (row: DepreciatedOrder) => void
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {tableId === 'depreciated-orders' && data[0] && onRowClick && (
        <button type="button" onClick={() => onRowClick(data[0])}>open-row</button>
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
    <MantineProvider>
      <I18nProvider>
        <DepreciatedOrdersPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Depreciated orders canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getDepreciatedOrders).mockResolvedValue({ items: [order], totalQty: 1 })
    vi.mocked(getDepreciatedOrderByNetId).mockResolvedValue(order)
    vi.mocked(getDepreciatedOrderStorages).mockResolvedValue([{ NetUid: 'storage-1', Name: 'Склад' }])
    vi.mocked(exportDepreciatedOrderDocument).mockResolvedValue({ DocumentURL: '/write-off.xlsx' })
    vi.mocked(createDepreciatedOrderFromFile).mockResolvedValue({ exceptions: [], message: '' })
  })

  it('does not mount registry or create lookups without page.view', () => {
    renderPage()

    expect(screen.getByText('Немає права переглядати списання')).toBeTruthy()
    expect(getDepreciatedOrders).not.toHaveBeenCalled()
    expect(getDepreciatedOrderStorages).not.toHaveBeenCalled()
  })

  it('keeps page access independent from create and details', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.WriteOff.View)
    renderPage()

    await waitFor(() => expect(getDepreciatedOrders).toHaveBeenCalledTimes(1))
    expect(getDepreciatedOrderStorages).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Створити акт списання' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'open-row' })).toBeNull()
    expect(getDepreciatedOrderByNetId).not.toHaveBeenCalled()
  })

  it('loads create dictionaries only with create and rechecks create on submit', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.WriteOff.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Order.Create)
    renderPage()

    await waitFor(() => expect(getDepreciatedOrderStorages).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Створити акт списання' }))
    const submit = screen.getByRole('button', { name: 'submit-create' })
    allowedPermissions.delete(PermissionKeys.WarehouseAccounting.WriteOff.Order.Create)
    fireEvent.click(submit)

    expect(createDepreciatedOrderFromFile).not.toHaveBeenCalled()
  })

  it('requires the independent management-create key at render and final submit', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.WriteOff.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Order.Create)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Order.CreateManagement)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Створити акт списання' }))
    expect(screen.getByText('management-create-enabled')).toBeTruthy()

    allowedPermissions.delete(PermissionKeys.WarehouseAccounting.WriteOff.Order.CreateManagement)
    fireEvent.click(screen.getByRole('button', { name: 'submit-management' }))
    expect(createDepreciatedOrderFromFile).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Order.CreateManagement)
    fireEvent.click(screen.getByRole('button', { name: 'submit-management' }))
    await waitFor(() => expect(createDepreciatedOrderFromFile).toHaveBeenCalledWith(
      expect.objectContaining({
        depreciatedOrder: expect.objectContaining({ IsManagement: true }),
      }),
    ))
  })

  it('keeps details and export independent and rechecks export in the final handler', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.WriteOff.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Order.OpenDetails)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'open-row' }))
    await waitFor(() => expect(getDepreciatedOrderByNetId).toHaveBeenCalledWith('order-1'))
    const download = await screen.findByRole('button', { name: 'Завантажити' })

    allowedPermissions.delete(PermissionKeys.WarehouseAccounting.WriteOff.Document.Export)
    fireEvent.click(download)
    expect(exportDepreciatedOrderDocument).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.WarehouseAccounting.WriteOff.Document.Export)
    fireEvent.click(download)
    await waitFor(() => expect(exportDepreciatedOrderDocument).toHaveBeenCalledWith('order-1'))
  })
})
