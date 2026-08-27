import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createOrganizationClient,
  deleteOrganizationClient,
  getCurrencies,
  getOrganizationClient,
  getOrganizationClients,
  updateOrganizationClient,
} from '../api/organizationClientsApi'
import type { OrganizationClient } from '../types'
import { OrganizationClientEditPage } from './OrganizationClientEditPage'
import { OrganizationClientNewPage } from './OrganizationClientNewPage'
import { OrganizationClientsPage } from './OrganizationClientsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/organizationClientsApi', () => ({
  createOrganizationClient: vi.fn(),
  deleteOrganizationClient: vi.fn(),
  getCurrencies: vi.fn(),
  getOrganizationClient: vi.fn(),
  getOrganizationClients: vi.fn(),
  updateOrganizationClient: vi.fn(),
}))

vi.mock('../components/OrganizationClientForm', () => ({
  OrganizationClientForm: ({
    disabled,
    onFieldChange,
  }: {
    disabled: boolean
    onFieldChange: (key: keyof OrganizationClient, value: OrganizationClient[keyof OrganizationClient]) => void
  }) => (
    <div>
      <output data-testid="organization-form-disabled">{String(disabled)}</output>
      <button
        disabled={disabled}
        type="button"
        onClick={() => {
          onFieldChange('FullName', 'New organization')
          onFieldChange('NIP', '123456')
          onFieldChange('MarginAmount', 10)
          onFieldChange('Address', 'Main street')
          onFieldChange('Country', 'Ukraine')
          onFieldChange('City', 'Kyiv')
        }}
      >
        fill-valid-organization
      </button>
    </div>
  ),
}))

vi.mock('../components/OrganizationClientAgreementsPanel', () => ({
  OrganizationClientAgreementsPanel: ({ disabled }: { disabled: boolean }) => (
    <output data-testid="agreements-disabled">{String(disabled)}</output>
  ),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => (
    opened ? <section>{children}{footer}</section> : null
  ),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title?: ReactNode }) => (
    opened ? <section>{title}{children}</section> : null
  ),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: OrganizationClient[]
    onRowClick?: (row: OrganizationClient) => void
  }) => (
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

const ORGANIZATION: OrganizationClient = {
  Address: 'Main street',
  City: 'Kyiv',
  Country: 'Ukraine',
  FullName: 'Acme buyer',
  MarginAmount: 10,
  NetUid: 'organization-1',
  NIP: '123456',
  OrganizationClientAgreements: [],
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderRoute(element: ReactNode, path: string, routePath: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('buyer organization canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getOrganizationClients).mockResolvedValue([ORGANIZATION])
    vi.mocked(getOrganizationClient).mockResolvedValue(ORGANIZATION)
    vi.mocked(getCurrencies).mockResolvedValue([])
    vi.mocked(createOrganizationClient).mockResolvedValue(ORGANIZATION)
    vi.mocked(updateOrganizationClient).mockResolvedValue(ORGANIZATION)
    vi.mocked(deleteOrganizationClient).mockResolvedValue()
  })

  it('does not mount the registry without page access', () => {
    renderRoute(<OrganizationClientsPage />, '/organization-clients', '/organization-clients')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getOrganizationClients).not.toHaveBeenCalled()
  })

  it('treats the row action chooser as technical without open-details access', async () => {
    allowedPermissions.add(PermissionKeys.OrganizationClients.Page.View)
    renderRoute(<OrganizationClientsPage />, '/organization-clients', '/organization-clients')

    const row = await screen.findByRole('button', { name: 'Acme buyer' })
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Нова організація' })).toBeNull()
  })

  it('keeps create and open-details independent', async () => {
    allowedPermissions.add(PermissionKeys.OrganizationClients.Page.View)
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.OpenDetails)
    renderRoute(<OrganizationClientsPage />, '/organization-clients', '/organization-clients')

    fireEvent.click(await screen.findByRole('button', { name: 'Acme buyer' }))
    expect(screen.queryByRole('button', { name: 'Нова організація' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити картку' }))

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/organization-clients/edit/organization-1')
    })
  })

  it('loads a read-only detail card with only open-details access', async () => {
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.OpenDetails)
    renderRoute(
      <OrganizationClientEditPage />,
      '/organization-clients/edit/organization-1',
      '/organization-clients/edit/:netId',
    )

    expect((await screen.findByTestId('organization-form-disabled')).textContent).toBe('true')
    expect(screen.getByTestId('agreements-disabled').textContent).toBe('true')
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
  })

  it('uses edit for the final aggregate save without granting delete', async () => {
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.OpenDetails)
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.Edit)
    renderRoute(
      <OrganizationClientEditPage />,
      '/organization-clients/edit/organization-1',
      '/organization-clients/edit/:netId',
    )

    expect((await screen.findByTestId('organization-form-disabled')).textContent).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateOrganizationClient).toHaveBeenCalledTimes(1))
    expect(deleteOrganizationClient).not.toHaveBeenCalled()
  })

  it('keeps delete independent from edit', async () => {
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.OpenDetails)
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.Delete)
    renderRoute(
      <OrganizationClientEditPage />,
      '/organization-clients/edit/organization-1',
      '/organization-clients/edit/:netId',
    )

    expect((await screen.findByTestId('organization-form-disabled')).textContent).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Видалити' })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(deleteOrganizationClient).toHaveBeenCalledWith('organization-1'))
    expect(updateOrganizationClient).not.toHaveBeenCalled()
  })

  it('does not mount new-client lookups without create access', () => {
    renderRoute(<OrganizationClientNewPage />, '/organization-clients/new', '/organization-clients/new')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getCurrencies).not.toHaveBeenCalled()
  })

  it('uses the same create permission for the direct form and final submit', async () => {
    allowedPermissions.add(PermissionKeys.OrganizationClients.Client.Create)
    renderRoute(<OrganizationClientNewPage />, '/organization-clients/new', '/organization-clients/new')

    fireEvent.click(await screen.findByRole('button', { name: 'fill-valid-organization' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(createOrganizationClient).toHaveBeenCalledTimes(1))
  })
})
