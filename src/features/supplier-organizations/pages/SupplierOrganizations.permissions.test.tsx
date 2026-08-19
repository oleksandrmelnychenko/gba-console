import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { SupplyOrganization } from '../types'
import {
  createSupplierOrganizationAgreement,
  editSupplierOrganization,
  editSupplierOrganizationAgreement,
  exportSupplierOrganizationSettlementsDocument,
  exportSupplyOrganizations,
  getSupplierOrganizationCurrencies,
  getSupplierOrganizationOverviewDetails,
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
  createSupplierOrganizationAgreement: vi.fn(),
  editSupplierOrganization: vi.fn(),
  editSupplierOrganizationAgreement: vi.fn(),
  exportSupplierOrganizationSettlementsDocument: vi.fn(),
  exportSupplyOrganizations: vi.fn(),
  getSupplierOrganizationCurrencies: vi.fn(),
  getSupplierOrganizationOverviewDetails: vi.fn(),
  getSupplierOrganizationSettlementsCashFlow: vi.fn(),
  getSupplierOrganizationSettlementsDetails: vi.fn(),
  getSupplierOrganizationsOwners: vi.fn(),
  getSupplierOrganizationsRegistry: vi.fn(),
  removeSupplierOrganization: vi.fn(),
  searchSupplierOrganizationsRegistry: vi.fn(),
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

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, onSelectFormat }: {
    opened: boolean
    onSelectFormat?: (format: 'excel' | 'pdf') => void
  }) => opened
    ? <button type="button" onClick={() => onSelectFormat?.('excel')}>select-export-format</button>
    : null,
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
    vi.mocked(getSupplierOrganizationCurrencies).mockResolvedValue([{ Code: 'EUR', Id: 2 }])
    vi.mocked(getSupplierOrganizationsOwners).mockResolvedValue([{ Id: 3, Name: 'GBA' }])
    vi.mocked(getSupplierOrganizationOverviewDetails).mockResolvedValue(SUPPLIER)
    vi.mocked(getSupplierOrganizationSettlementsDetails).mockResolvedValue(SUPPLIER)
    vi.mocked(getSupplierOrganizationSettlementsCashFlow).mockResolvedValue({ AccountingCashFlowHeadItems: [] })
    vi.mocked(exportSupplyOrganizations).mockResolvedValue({ DocumentURL: '/suppliers.xlsx' })
    vi.mocked(exportSupplierOrganizationSettlementsDocument).mockResolvedValue({
      DocumentURL: '/settlements.xlsx',
    })
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

  it('keeps registry export independent and rechecks document.export in the final handler', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Document.Export)
    renderRoute('/accounting/supplier-organizations')

    const exportButton = await screen.findByRole('button', { name: 'Друк' })
    allowedPermissions.delete(PermissionKeys.SupplierOrganizations.Document.Export)
    fireEvent.click(exportButton)
    expect(exportSupplyOrganizations).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Document.Export)
    fireEvent.click(exportButton)
    await waitFor(() => expect(exportSupplyOrganizations).toHaveBeenCalledTimes(1))
  })

  it('does not turn the registry row chooser into a separate permission boundary', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    renderRoute('/accounting/supplier-organizations')

    fireEvent.click(await screen.findByRole('button', { name: 'Постачальник QA' }))
    expect(screen.queryByRole('button', { name: 'Взаєморозрахунки' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Перегляд' })).toBeNull()
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

  it('keeps supplier profile save independent from overview access', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Overview.Open)
    renderRoute('/accounting/supplier-organizations/edit/supplier-1')

    const nameInput = await screen.findByRole('textbox', { name: /Назва/ })
    fireEvent.submit(nameInput.closest('form') as HTMLFormElement)

    expect(editSupplierOrganization).not.toHaveBeenCalled()
    expect(getSupplierOrganizationCurrencies).not.toHaveBeenCalled()
    expect(getSupplierOrganizationsOwners).not.toHaveBeenCalled()
  })

  it('saves supplier profile only through the canonical edit capability', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Overview.Open)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Supplier.Edit)
    renderRoute('/accounting/supplier-organizations/edit/supplier-1')

    const nameInput = await screen.findByRole('textbox', { name: /Назва/ })
    fireEvent.submit(nameInput.closest('form') as HTMLFormElement)

    await waitFor(() => expect(editSupplierOrganization).toHaveBeenCalledWith(expect.objectContaining({
      Id: 1,
      NetUid: 'supplier-1',
    })))
  })

  it('keeps agreement create and edit capabilities independent', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Overview.Open)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Agreement.Create)
    renderRoute('/accounting/supplier-organizations/edit/supplier-1')

    fireEvent.click(await screen.findByRole('tab', { name: 'Договори' }))
    await waitFor(() => expect(getSupplierOrganizationCurrencies).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Новий договір' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Новий договір' }))
    const createForm = document.getElementById('supplier-organization-agreement-form')
    expect(createForm).not.toBeNull()
    fireEvent.submit(createForm as HTMLFormElement)

    await waitFor(() => expect(createSupplierOrganizationAgreement).toHaveBeenCalled())
    expect(editSupplierOrganizationAgreement).not.toHaveBeenCalled()
  })

  it('edits an existing agreement without granting agreement creation', async () => {
    vi.mocked(getSupplierOrganizationOverviewDetails).mockResolvedValue({
      ...SUPPLIER,
      SupplyOrganizationAgreements: [{
        Currency: { Code: 'EUR', Id: 2 },
        Id: 10,
        Name: 'Основний договір',
        Organization: { Id: 3, Name: 'GBA' },
        SupplyOrganizationDocuments: [],
        SupplyOrganizationId: 1,
      }],
    })
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Overview.Open)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Agreement.Edit)
    renderRoute('/accounting/supplier-organizations/edit/supplier-1')

    fireEvent.click(await screen.findByRole('tab', { name: 'Договори' }))
    expect(screen.queryByRole('button', { name: 'Новий договір' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Основний договір' }))
    const editForm = document.getElementById('supplier-organization-agreement-form')
    expect(editForm).not.toBeNull()
    fireEvent.submit(editForm as HTMLFormElement)

    await waitFor(() => expect(editSupplierOrganizationAgreement).toHaveBeenCalled())
    expect(createSupplierOrganizationAgreement).not.toHaveBeenCalled()
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

  it('rechecks settlements.export at format selection and keeps it separate from settlements.open', async () => {
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Page.View)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Settlements.Open)
    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Settlements.Export)
    renderRoute('/accounting/supplier-organizations/cash-flow/supplier-1')

    fireEvent.click(await screen.findByRole('button', { name: 'Друк PDF' }))
    const selectFormat = screen.getByRole('button', { name: 'select-export-format' })

    allowedPermissions.delete(PermissionKeys.SupplierOrganizations.Settlements.Export)
    fireEvent.click(selectFormat)
    expect(exportSupplierOrganizationSettlementsDocument).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.SupplierOrganizations.Settlements.Export)
    fireEvent.click(selectFormat)
    await waitFor(() => expect(exportSupplierOrganizationSettlementsDocument).toHaveBeenCalledWith(expect.objectContaining({
      netId: 'supplier-1',
      typePaymentTask: 2,
    })))
  })
})
