import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createCompanyCar,
  deleteCompanyCarRoadList,
  getCompanyCarForEdit,
  getCompanyCarForRoadLists,
  getCompanyCarOrganizations,
  getCompanyCarRoadLists,
  getCompanyCars,
  searchCompanyCars,
  updateCompanyCar,
} from '../api/companyCarsApi'
import type { CompanyCar, CompanyCarRoadList } from '../types'
import { CompanyCarFormPage } from './CompanyCarFormPage'
import { CompanyCarRoadListsPage } from './CompanyCarRoadListsPage'
import { CompanyCarsPage } from './CompanyCarsPage'

const allowedPermissions = new Set<string>()
const companyCar: CompanyCar = {
  CarBrand: 'Ford',
  CompanyCarFuelings: [],
  CompanyCarRoadLists: [],
  FuelAmount: 10,
  LicensePlate: 'AA 0001 AA',
  Mileage: 100,
  NetUid: 'car-1',
}
const roadList: CompanyCarRoadList = {
  CompanyCar: companyCar,
  Id: 1,
  NetUid: 'road-list-1',
}

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
    user: { Id: 7, NetUid: 'user-1' },
  }),
}))

vi.mock('../api/companyCarsApi', () => ({
  calculateCompanyCarRoadListForCreate: vi.fn(),
  calculateCompanyCarRoadListForEdit: vi.fn(),
  createCompanyCar: vi.fn(),
  createCompanyCarRoadList: vi.fn(),
  deleteCompanyCar: vi.fn(),
  deleteCompanyCarRoadList: vi.fn(),
  getCompanyCarForEdit: vi.fn(),
  getCompanyCarForRoadLists: vi.fn(),
  getCompanyCarOrganizations: vi.fn(),
  getCompanyCarRoadLists: vi.fn(),
  getCompanyCars: vi.fn(),
  getOutcomeOrdersByCompanyCar: vi.fn(),
  searchCompanyCars: vi.fn(),
  searchCompanyCarUsers: vi.fn(),
  updateCompanyCar: vi.fn(),
  updateCompanyCarRoadList: vi.fn(),
}))

vi.mock('../components/CompanyCarRoadListFormModal', () => ({
  CompanyCarRoadListFormModal: ({ canSave, opened, roadList: target }: {
    canSave: boolean
    opened: boolean
    roadList?: CompanyCarRoadList | null
  }) => opened ? <span>{target ? 'edit-road-list' : 'create-road-list'}:{String(canSave)}</span> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, onRowClick, tableId }: {
    columns: Array<{ cell?: (item: CompanyCar & CompanyCarRoadList) => ReactNode; id: string }>
    data: Array<CompanyCar & CompanyCarRoadList>
    onRowClick?: (item: CompanyCar & CompanyCarRoadList) => void
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {data.map((item, index) => (
        <div key={String(item.NetUid || item.Id || index)}>
          {onRowClick && <button type="button" onClick={() => onRowClick(item)}>row-open</button>}
          {columns.find((column) => column.id === 'actions')?.cell?.(item)}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../../../shared/ui/table-row-action', () => ({
  TableRowAction: ({ disabled, label, onClick }: {
    disabled?: boolean
    label: string
    onClick?: (event: { stopPropagation: () => void }) => void
  }) => (
    <button
      aria-label={label}
      disabled={disabled}
      type="button"
      onClick={() => onClick?.({ stopPropagation: () => undefined })}
    >
      {label}
    </button>
  ),
}))

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}</span>
}

function renderAt(path: string, routePath: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
          <LocationProbe />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Company cars canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getCompanyCars).mockResolvedValue([companyCar])
    vi.mocked(searchCompanyCars).mockResolvedValue([companyCar])
    vi.mocked(getCompanyCarForEdit).mockResolvedValue(companyCar)
    vi.mocked(getCompanyCarForRoadLists).mockResolvedValue(companyCar)
    vi.mocked(getCompanyCarOrganizations).mockResolvedValue([])
    vi.mocked(getCompanyCarRoadLists).mockResolvedValue([roadList])
    vi.mocked(createCompanyCar).mockResolvedValue(companyCar)
    vi.mocked(updateCompanyCar).mockResolvedValue(companyCar)
    vi.mocked(deleteCompanyCarRoadList).mockResolvedValue(companyCar)
  })

  it('does not mount the registry without page.view', () => {
    renderAt('/accounting/company-cars', '/accounting/company-cars', <CompanyCarsPage />)

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getCompanyCars).not.toHaveBeenCalled()
  })

  it('keeps create, edit and road-list opening independent on the registry', async () => {
    allowedPermissions.add(PermissionKeys.Warehouses.CompanyCars.Page.View)
    const view = renderAt('/accounting/company-cars', '/accounting/company-cars', <CompanyCarsPage />)
    await screen.findByTestId('company-cars')

    expect(screen.queryByRole('button', { name: 'Завести нову машину компанії' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Шляхові листи автомобіля' })).toBeNull()
    view.unmount()

    allowedPermissions.add(PermissionKeys.Warehouses.CompanyCars.Car.Create)
    allowedPermissions.add(PermissionKeys.Warehouses.CompanyCars.Car.Edit)
    allowedPermissions.add(PermissionKeys.Warehouses.CompanyCars.RoadList.Open)
    renderAt('/accounting/company-cars', '/accounting/company-cars', <CompanyCarsPage />)

    expect(await screen.findByRole('button', { name: 'Завести нову машину компанії' })).toBeTruthy()
    const edit = screen.getByRole('button', { name: 'Редагувати' })
    const roadLists = screen.getByRole('button', { name: 'Шляхові листи автомобіля' })

    allowedPermissions.delete(PermissionKeys.Warehouses.CompanyCars.Car.Edit)
    fireEvent.click(edit)
    expect(screen.getByTestId('location').textContent).toBe('/accounting/company-cars')

    allowedPermissions.delete(PermissionKeys.Warehouses.CompanyCars.RoadList.Open)
    fireEvent.click(roadLists)
    expect(screen.getByTestId('location').textContent).toBe('/accounting/company-cars')
  })

  it('blocks direct car forms and rechecks edit before final submit', async () => {
    const denied = renderAt('/accounting/company-cars/edit/car-1', '/accounting/company-cars/edit/:id', <CompanyCarFormPage />)
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getCompanyCarForEdit).not.toHaveBeenCalled()
    expect(getCompanyCarOrganizations).not.toHaveBeenCalled()
    denied.unmount()

    allowedPermissions.add(PermissionKeys.Warehouses.CompanyCars.Car.Edit)
    renderAt('/accounting/company-cars/edit/car-1', '/accounting/company-cars/edit/:id', <CompanyCarFormPage />)
    await waitFor(() => expect(getCompanyCarForEdit).toHaveBeenCalledWith('car-1'))

    const save = await screen.findByRole('button', { name: 'Зберегти' })
    allowedPermissions.delete(PermissionKeys.Warehouses.CompanyCars.Car.Edit)
    fireEvent.click(save)
    await waitFor(() => expect(updateCompanyCar).not.toHaveBeenCalled())
  })

  it('requires road-list.open for data and keeps create/edit/delete controls independent', async () => {
    const denied = renderAt(
      '/accounting/company-cars/car-1/road-lists',
      '/accounting/company-cars/:id/road-lists',
      <CompanyCarRoadListsPage />,
    )
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getCompanyCarForRoadLists).not.toHaveBeenCalled()
    expect(getCompanyCarRoadLists).not.toHaveBeenCalled()
    denied.unmount()

    allowedPermissions.add(PermissionKeys.Warehouses.CompanyCars.RoadList.Open)
    renderAt(
      '/accounting/company-cars/car-1/road-lists',
      '/accounting/company-cars/:id/road-lists',
      <CompanyCarRoadListsPage />,
    )
    await screen.findByTestId('company-car-road-lists')

    expect(screen.queryByRole('button', { name: 'Створення шляхового листа' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
  })
})
