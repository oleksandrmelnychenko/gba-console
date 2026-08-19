import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getDirectSupplyOrderForLogisticWay,
  getSupplyOrderOrganizations,
  getSupplyOrderSuppliers,
} from '../api/supplyUkraineOrdersApi'
import {
  SupplyUkraineDirectOrderCreatePage,
  SupplyUkraineToUkraineOrderCreatePage,
} from './SupplyUkraineDirectOrderCreatePage'
import { SupplyUkraineDirectOrderDetailPage } from './SupplyUkraineDirectOrderDetailPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/supplyUkraineOrdersApi', () => ({
  approveDirectSupplyOrderLogistic: vi.fn(),
  clearDirectSupplyOrderDeliveryDocumentFile: vi.fn(),
  createSupplyCreditNote: vi.fn(),
  getDirectSupplyOrderForLogisticWay: vi.fn(),
  getSupplyOrderOrganizations: vi.fn(),
  getSupplyOrderSuppliers: vi.fn(),
  updateDirectSupplyOrderDeliveryDocumentStatus: vi.fn(),
  updateDirectSupplyOrderLogisticAmount: vi.fn(),
  uploadDirectSupplyOrderFromFile: vi.fn(),
  uploadDirectSupplyOrderLogisticDocument: vi.fn(),
  uploadSupplyOrderUkraineFromSupplierFile: vi.fn(),
}))

vi.mock('../components/DirectOrderPaymentTasksCard', () => ({
  DirectOrderPaymentTasksCard: () => null,
}))

vi.mock('../components/DirectSupplyOrderProFormCard', () => ({
  DirectSupplyOrderProFormCard: () => null,
}))

vi.mock('../components/DirectOrderProductIncomeStatus', () => ({
  DirectOrderProductIncomeStatus: () => null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

function renderRoute(path: string, element: ReactNode, route: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Supply Ukraine direct-order logistics permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getDirectSupplyOrderForLogisticWay).mockResolvedValue(null)
    vi.mocked(getSupplyOrderOrganizations).mockResolvedValue([])
    vi.mocked(getSupplyOrderSuppliers).mockResolvedValue([])
  })

  it('does not mount logistic-way model without page access', () => {
    renderRoute(
      '/orders/ukraine/all/edit/order-1',
      <SupplyUkraineDirectOrderDetailPage />,
      '/orders/ukraine/all/edit/:id',
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getDirectSupplyOrderForLogisticWay).not.toHaveBeenCalled()
  })

  it('loads logistic-way details only through the scoped loader', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenLogisticWay)
    renderRoute(
      '/orders/ukraine/all/edit/order-1',
      <SupplyUkraineDirectOrderDetailPage />,
      '/orders/ukraine/all/edit/:id',
    )

    await waitFor(() => expect(getDirectSupplyOrderForLogisticWay).toHaveBeenCalledWith('order-1'))
  })

  it.each([
    ['/orders/ukraine/all/new', <SupplyUkraineDirectOrderCreatePage />],
    ['/orders/ukraine/to-ukraine/new', <SupplyUkraineToUkraineOrderCreatePage />],
  ])('does not load create dictionaries without %s access', (path, element) => {
    renderRoute(path, element, path)

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSupplyOrderOrganizations).not.toHaveBeenCalled()
    expect(getSupplyOrderSuppliers).not.toHaveBeenCalled()
  })
})
