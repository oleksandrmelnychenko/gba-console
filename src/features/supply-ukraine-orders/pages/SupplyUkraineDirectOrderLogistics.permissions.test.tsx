import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getDirectSupplyOrderForLogisticWay,
  getSupplyOrderCreateSuppliers,
  getSupplyOrderOrganizations,
  uploadDirectSupplyOrderFromFile,
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
  getSupplyOrderCreateSuppliers: vi.fn(),
  getSupplyOrderOrganizations: vi.fn(),
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
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) =>
    opened ? <section>{children}{footer}</section> : null,
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
    vi.mocked(getSupplyOrderCreateSuppliers).mockResolvedValue([])
    vi.mocked(getSupplyOrderOrganizations).mockResolvedValue([])
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
    expect(getSupplyOrderCreateSuppliers).not.toHaveBeenCalled()
  })

  it('returns a successful creator to the registry when logistic-way access is absent', async () => {
    const organization = {
      Culture: 'uk',
      Id: 10,
      Name: 'GBA Україна',
      NetUid: 'organization-1',
    }
    const clientAgreement = {
      Agreement: {
        Id: 30,
        Name: 'USD',
        NetUid: 'agreement-1',
        Organization: organization,
      },
      Id: 20,
      NetUid: 'client-agreement-1',
    }

    allowedPermissions.add(PermissionKeys.OrdersUkraine.Page.View)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenOrder)
    vi.mocked(getSupplyOrderOrganizations).mockResolvedValue([organization])
    vi.mocked(getSupplyOrderCreateSuppliers).mockResolvedValue([{
      ClientAgreements: [clientAgreement],
      Id: 40,
      Name: 'Test supplier',
      NetUid: 'supplier-1',
    }])
    vi.mocked(uploadDirectSupplyOrderFromFile).mockResolvedValue({
      SupplyOrder: { NetUid: 'order-1208' },
    })

    const { container } = render(
      <MantineProvider env="test">
        <I18nProvider>
          <MemoryRouter initialEntries={['/orders/ukraine/all/new']}>
            <Routes>
              <Route path="/orders/ukraine/all/new" element={<SupplyUkraineDirectOrderCreatePage />} />
              <Route path="/orders/ukraine/all" element={<div>orders-registry</div>} />
              <Route path="/orders/ukraine/all/edit/:id" element={<div>logistic-way</div>} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => expect(getSupplyOrderCreateSuppliers).toHaveBeenCalledWith('direct'))

    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).not.toBeNull()
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(
          ['test'],
          'order.xlsx',
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        )],
      },
    })
    fireEvent.change(screen.getByLabelText('Код товару'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Кількість'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('З рядка'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('До рядка'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Колонка ціни'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(uploadDirectSupplyOrderFromFile).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('orders-registry')).toBeTruthy()
    expect(screen.queryByText('logistic-way')).toBeNull()
  })
})
