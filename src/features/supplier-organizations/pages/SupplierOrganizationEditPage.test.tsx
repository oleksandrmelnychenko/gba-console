import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { SupplyOrganization, SupplyOrganizationAgreement } from '../types'
import {
  createSupplierOrganization,
  createSupplyOrganizationAgreement,
  getSupplierOrganizationCurrencies,
  getSupplierOrganizationsOwners,
  getSupplierOrganizationOverviewDetails,
  updateSupplyOrganization,
  updateSupplyOrganizationAgreement,
} from '../api/supplierOrganizationsApi'
import { SupplierOrganizationEditPage } from './SupplierOrganizationEditPage'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({
    children,
    footer,
    opened,
    title,
  }: {
    children: ReactNode
    footer?: ReactNode
    opened: boolean
    title?: ReactNode
  }) => opened ? (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
      {footer}
    </section>
  ) : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: SupplyOrganizationAgreement[]
    onRowClick?: (row: SupplyOrganizationAgreement) => void
  }) => (
    <div>
      {data.map((row, index) => (
        <button
          key={row.NetUid || row.Id || index}
          type="button"
          onClick={() => onRowClick?.(row)}
        >
          {row.Name || `Договір ${index + 1}`}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../api/supplierOrganizationsApi', () => ({
  createSupplierOrganization: vi.fn(),
  createSupplyOrganizationAgreement: vi.fn(),
  removeSupplierOrganization: vi.fn(),
  getSupplierOrganizationCurrencies: vi.fn(),
  getSupplierOrganizationsOwners: vi.fn(),
  getSupplierOrganizationOverviewDetails: vi.fn(),
  updateSupplyOrganization: vi.fn(),
  updateSupplyOrganizationAgreement: vi.fn(),
}))

const EXISTING_SUPPLIER: SupplyOrganization = {
  Id: 1,
  Name: 'Постачальник',
  NetUid: 'supplier-1',
  SupplyOrganizationAgreements: [],
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route
              path="/accounting/supplier-organizations/new"
              element={<SupplierOrganizationEditPage />}
            />
            <Route
              path="/accounting/supplier-organizations/edit/:id"
              element={<SupplierOrganizationEditPage />}
            />
            <Route
              path="/accounting/supplier-organizations"
              element={<div>Список постачальників</div>}
            />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupplierOrganizationCurrencies).mockResolvedValue([{ Code: 'EUR', Id: 2 }])
  vi.mocked(getSupplierOrganizationsOwners).mockResolvedValue([{ Id: 3, Name: 'GBA' }])
  vi.mocked(getSupplierOrganizationOverviewDetails).mockResolvedValue(EXISTING_SUPPLIER)
  vi.mocked(createSupplierOrganization).mockResolvedValue(EXISTING_SUPPLIER)
  vi.mocked(updateSupplyOrganization).mockResolvedValue(EXISTING_SUPPLIER)
  vi.mocked(createSupplyOrganizationAgreement).mockResolvedValue(null)
  vi.mocked(updateSupplyOrganizationAgreement).mockResolvedValue(null)
})

describe('SupplierOrganizationEditPage QA', () => {
  it('blocks an empty name and sends normalized create values', async () => {
    renderPage('/accounting/supplier-organizations/new')

    const nameInput = await screen.findByRole('textbox', { name: /Назва/ })
    const generalForm = nameInput.closest('form')
    expect(generalForm).not.toBeNull()

    fireEvent.submit(generalForm as HTMLFormElement)

    expect(await screen.findByText('Вкажіть назву')).not.toBeNull()
    expect(createSupplierOrganization).not.toHaveBeenCalled()

    fireEvent.change(nameInput, { target: { value: ' Постачальник QA ' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: ' qa@example.com ' },
    })
    fireEvent.submit(generalForm as HTMLFormElement)

    await waitFor(() => {
      expect(createSupplierOrganization).toHaveBeenCalledWith(expect.objectContaining({
        EmailAddress: 'qa@example.com',
        Name: 'Постачальник QA',
      }))
    })
  })

  it('updates an agreement identified only by NetUid instead of creating a duplicate', async () => {
    const agreement: SupplyOrganizationAgreement = {
      Currency: { Code: 'EUR', Id: 2 },
      ExistFrom: '2026-07-24',
      ExistTo: '2027-07-24',
      Name: 'Основний договір',
      NetUid: 'agreement-1',
      Organization: { Id: 3, Name: 'GBA' },
      SupplyOrganizationDocuments: [],
      SupplyOrganizationId: 1,
    }
    vi.mocked(getSupplierOrganizationOverviewDetails).mockResolvedValue({
      ...EXISTING_SUPPLIER,
      SupplyOrganizationAgreements: [agreement],
    })

    renderPage('/accounting/supplier-organizations/edit/supplier-1')

    fireEvent.click(await screen.findByRole('tab', { name: 'Договори' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Основний договір' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти' }))

    await waitFor(() => {
      expect(updateSupplyOrganizationAgreement).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'Основний договір',
          NetUid: 'agreement-1',
          SupplyOrganizationId: 1,
        }),
        [],
      )
    })
    expect(createSupplyOrganizationAgreement).not.toHaveBeenCalled()
  })
})
