import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportSupplyReturnDocument,
  getSupplyReturnByNetId,
  getSupplyReturns,
} from '../api/supplyReturnsApi'
import type { SupplyReturn } from '../types'
import { SupplyReturnsPage } from './SupplyReturnsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/supplyReturnsApi', () => ({
  exportSupplyReturnDocument: vi.fn(),
  getSupplyReturnByNetId: vi.fn(),
  getSupplyReturns: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section>{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: Array<{ NetUid?: string; Number?: string }>
    onRowClick?: (row: { NetUid?: string; Number?: string }) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <button
          disabled={!onRowClick}
          key={row.NetUid || index}
          type="button"
          onClick={() => onRowClick?.(row)}
        >
          {row.Number || row.NetUid || `row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

const SUPPLY_RETURN: SupplyReturn = {
  NetUid: 'return-1',
  Number: 'RETURN-1',
  SupplyReturnItems: [],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <SupplyReturnsPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Supplier returns canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getSupplyReturns).mockResolvedValue({ items: [SUPPLY_RETURN], totalQty: 1 })
    vi.mocked(getSupplyReturnByNetId).mockResolvedValue(SUPPLY_RETURN)
    vi.mocked(exportSupplyReturnDocument).mockResolvedValue({ DocumentURL: '/return.xlsx' })
  })

  it('does not mount the page model without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSupplyReturns).not.toHaveBeenCalled()
  })

  it('does not expose either duplicate detail trigger without open-details', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.SupplierReturns.Page.View)
    renderPage()

    const row = await screen.findByRole('button', { name: 'RETURN-1' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(row)
    expect(getSupplyReturnByNetId).not.toHaveBeenCalled()
  })

  it('opens details with one right but keeps document export independent', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.SupplierReturns.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.SupplierReturns.Return.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'RETURN-1' }))

    await waitFor(() => expect(getSupplyReturnByNetId).toHaveBeenCalledWith('return-1'))
    expect(screen.queryByRole('button', { name: 'Завантажити' })).toBeNull()
  })

  it('exports only when the independent export right is assigned', async () => {
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.SupplierReturns.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.SupplierReturns.Return.OpenDetails)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.SupplierReturns.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'RETURN-1' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Завантажити' }))

    await waitFor(() => expect(exportSupplyReturnDocument).toHaveBeenCalledWith('return-1'))
  })
})
