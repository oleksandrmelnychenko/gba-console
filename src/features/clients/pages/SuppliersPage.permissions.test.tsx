import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportSuppliersDocument,
  getSupplierCount,
  getSupplierFilterItems,
  getSuppliers,
  switchClientActiveStateForRegistry,
} from '../api/clientsApi'
import type { Client } from '../types'
import { SuppliersPage } from './SuppliersPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/clientsApi', () => ({
  exportSuppliersDocument: vi.fn(),
  getSupplierCount: vi.fn(),
  getSupplierFilterItems: vi.fn(),
  getSuppliers: vi.fn(),
  switchClientActiveStateForRegistry: vi.fn(),
}))

vi.mock('../components/SupplierPassport', () => ({
  SupplierPassport: ({ client }: { client: Client }) => <div>passport:{client.FullName}</div>,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title?: ReactNode }) => (
    opened ? <section>{title}{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, onRowClick }: { data: Client[]; onRowClick?: (row: Client) => void }) => (
    <div>
      {data.map((row, index) => (
        <button
          disabled={!onRowClick}
          key={row.NetUid || index}
          type="button"
          onClick={() => onRowClick?.(row)}
        >
          {row.FullName || row.NetUid || `row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened }: { opened: boolean }) => (opened ? <div>supplier-export-ready</div> : null),
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

const SUPPLIER: Client = {
  FullName: 'Test supplier',
  IsActive: true,
  NetUid: 'supplier-1',
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/suppliers']}>
          <SuppliersPage />
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SuppliersPage canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getSuppliers).mockResolvedValue([SUPPLIER])
    vi.mocked(getSupplierCount).mockResolvedValue(1)
    vi.mocked(getSupplierFilterItems).mockResolvedValue([])
    vi.mocked(exportSuppliersDocument).mockResolvedValue({ DocumentURL: '/suppliers.xlsx' })
    vi.mocked(switchClientActiveStateForRegistry).mockResolvedValue()
  })

  it('does not mount supplier requests without the page permission', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSuppliers).not.toHaveBeenCalled()
    expect(getSupplierCount).not.toHaveBeenCalled()
  })

  it('treats row selection as technical when no business action is available', async () => {
    allowedPermissions.add(PermissionKeys.Suppliers.Page.View)
    renderPage()

    const row = await screen.findByRole('button', { name: 'Test supplier' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Добавити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Експорт в Excel' })).toBeNull()
  })

  it('keeps supplier passport independent from card, cash flow, and status actions', async () => {
    allowedPermissions.add(PermissionKeys.Suppliers.Page.View)
    allowedPermissions.add(PermissionKeys.Suppliers.Passport.Open)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Test supplier' }))
    expect(screen.queryByRole('button', { name: 'Відкрити картку' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Взаєморозрахунки' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Позначити неактивним' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Паспорт постачальника' }))
    expect(await screen.findByText('passport:Test supplier')).toBeTruthy()
  })

  it('reuses the existing client details right without exposing sibling actions', async () => {
    allowedPermissions.add(PermissionKeys.Suppliers.Page.View)
    allowedPermissions.add(PermissionKeys.Clients.Details.Open)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Test supplier' }))
    expect(screen.queryByRole('button', { name: 'Паспорт постачальника' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Взаєморозрахунки' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити картку' }))

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/suppliers/edit/supplier-1')
    })
  })

  it('does not grant active-state mutation through the export permission', async () => {
    allowedPermissions.add(PermissionKeys.Suppliers.Page.View)
    allowedPermissions.add(PermissionKeys.Suppliers.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Експорт в Excel' }))
    await waitFor(() => expect(exportSuppliersDocument).toHaveBeenCalledTimes(1))
    expect(switchClientActiveStateForRegistry).not.toHaveBeenCalled()
  })
})
