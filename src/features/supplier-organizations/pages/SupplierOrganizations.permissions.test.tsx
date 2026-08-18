import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { SupplyOrganization } from '../types'
import {
  getSupplierOrganizationCurrencies,
  getSupplierOrganizationSettlementsCashFlow,
  getSupplierOrganizationSettlementsDetails,
  getSupplierOrganizationsOwners,
  getSupplierOrganizationsRegistry,
} from '../api/supplierOrganizationsApi'
import { SupplierOrganizationCashFlowPage } from './SupplierOrganizationCashFlowPage'
import { SupplierOrganizationEditPage } from './SupplierOrganizationEditPage'
import { SupplierOrganizationsPage } from './SupplierOrganizationsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/supplierOrganizationsApi', () => ({
  createSupplierOrganization: vi.fn(),
  createSupplyOrganizationAgreement: vi.fn(),
  exportSupplyOrganizations: vi.fn(),
  getSupplierOrganizationCurrencies: vi.fn(),
  getSupplierOrganizationOverviewDetails: vi.fn(),
  getSupplierOrganizationSettlementsCashFlow: vi.fn(),
  getSupplierOrganizationSettlementsDetails: vi.fn(),
  getSupplierOrganizationsOwners: vi.fn(),
  getSupplierOrganizationsRegistry: vi.fn(),
  removeSupplierOrganization: vi.fn(),
  searchSupplierOrganizationsRegistry: vi.fn(),
  updateSupplyOrganization: vi.fn(),
  updateSupplyOrganizationAgreement: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: SupplyOrganization[]
    onRowClick?: (row: SupplyOrganization) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <button key={row.NetUid || index} type="button" onClick={() => onRowClick?.(row)}>
          {row.Name || row.NetUid || `row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

const SUPPLIER: SupplyOrganization = {
  Id: 1,
  Name: 'Постачальник QA',
  NetUid: 'supplier-1',
  SupplyOrganizationAgreements: [],
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/supplier-organizations" element={<SupplierOrganizationsPage />} />
            <Route path="/accounting/supplier-organizations/new" element={<SupplierOrganizationEditPage />} />
            <Route path="/accounting/supplier-organizations/edit/:id" element={<SupplierOrganizationEditPage />} />
            <Route path="/accounting/supplier-organizations/cash-flow/:id" element={<SupplierOrganizationCashFlowPage />} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Supplier Organizations canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getSupplierOrganizationsRegistry).mockResolvedValue([SUPPLIER])
    vi.mocked(getSupplierOrganizationCurrencies).mockResolvedValue([])
    vi.mocked(getSupplierOrganizationsOwners).mockResolvedValue([])
    vi.mocked(getSupplierOrganizationSettlementsDetails).mockResolvedValue(SUPPLIER)
    vi.mocked(getSupplierOrganizationSettlementsCashFlow).mockResolvedValue({ AccountingCashFlowHeadItems: [] })
  })

  it('does not mount the registry model without the page permission', () => {
    renderRoute('/accounting/supplier-organizations')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSupplierOrganizationsRegistry).not.toHaveBeenCalled()
  })

  it('keeps settlements, overview and create controls independently guarded', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Settlements.Open)
    renderRoute('/accounting/supplier-organizations')

    fireEvent.click(await screen.findByRole('button', { name: 'Постачальник QA' }))

    expect(screen.getByRole('button', { name: 'Взаєморозрахунки' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Перегляд' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull()
  })

  it.each([
    '/accounting/supplier-organizations/new',
    '/accounting/supplier-organizations/edit/supplier-1',
  ])('blocks direct %s navigation without its action permission', (path) => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    renderRoute(path)

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSupplierOrganizationCurrencies).not.toHaveBeenCalled()
    expect(getSupplierOrganizationsOwners).not.toHaveBeenCalled()
  })

  it('mounts settlements details and ledger only with page plus settlements permissions', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Settlements.Open)
    renderRoute('/accounting/supplier-organizations/cash-flow/supplier-1')

    await waitFor(() => expect(getSupplierOrganizationSettlementsDetails).toHaveBeenCalledWith('supplier-1'))
    await waitFor(() => expect(getSupplierOrganizationSettlementsCashFlow).toHaveBeenCalledWith(expect.objectContaining({
      netId: 'supplier-1',
      typePaymentTask: 2,
    })))
  })
})
