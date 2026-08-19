import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createSupplyOrderUkrainePaymentProtocol,
  deleteSupplyOrderUkrainePaymentProtocol,
  getLogisticPaymentTaskResponsibleUsers,
  getResponsibleUsers,
  getSupplyOrderUkraineById,
  getSupplyOrderUkraineProtocolKeys,
} from '../api/paymentProtocolsApi'
import { SupplyUkrainePaymentProtocolsView } from './SupplyUkrainePaymentProtocolsView'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/paymentProtocolsApi', () => ({
  createSupplyOrderUkrainePaymentProtocol: vi.fn(),
  deleteSupplyOrderUkrainePaymentProtocol: vi.fn(),
  getLogisticPaymentTaskResponsibleUsers: vi.fn(),
  getResponsibleUsers: vi.fn(),
  getSupplyOrderUkraineById: vi.fn(),
  getSupplyOrderUkraineProtocolKeys: vi.fn(),
  updateSupplyOrderUkraine: vi.fn(),
  uploadUkraineMergedService: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <div>{title}{children}</div> : null,
}))

vi.mock('../components/MergedServicesSection', () => ({
  MergedServicesSection: () => null,
}))

vi.mock('../components/PaymentDeliveryProtocolsSection', () => ({
  PaymentDeliveryProtocolsSection: ({
    canCreateProtocol,
    canRemoveProtocol,
    onCreateProtocol,
    onRemoveProtocol,
    protocols,
  }: {
    canCreateProtocol: boolean
    canRemoveProtocol: boolean
    onCreateProtocol: (values: {
      comment: string
      discount: string
      isAccounting: boolean
      payToDate: Date | null
      protocolKey: { Key: string; NetUid: string }
      responsible: null
      value: string
    }) => Promise<void>
    onRemoveProtocol: (protocol: { NetUid: string }) => Promise<void>
    protocols: Array<{ NetUid: string }>
  }) => (
    <div>
      {canCreateProtocol ? (
        <button
          type="button"
          onClick={() => void onCreateProtocol({
            comment: 'Оплатити',
            discount: '50',
            isAccounting: false,
            payToDate: null,
            protocolKey: { Key: 'Платіж', NetUid: 'key-1' },
            responsible: null,
            value: '500',
          }).catch(() => undefined)}
        >
          Створити протокол
        </button>
      ) : null}
      {canRemoveProtocol && protocols[0] ? (
        <button
          type="button"
          onClick={() => void onRemoveProtocol(protocols[0]).catch(() => undefined)}
        >
          Видалити протокол
        </button>
      ) : null}
    </div>
  ),
}))

const protocol = { NetUid: 'protocol-1' }
const order = {
  NetUid: 'order-1',
  MergedServices: [],
  SupplyOrderUkrainePaymentDeliveryProtocols: [protocol],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/protocols/order-1']}>
          <Routes>
            <Route
              element={<SupplyUkrainePaymentProtocolsView />}
              path="/orders/ukraine/protocols/:netid"
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SupplyUkrainePaymentProtocolsView canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getSupplyOrderUkraineById).mockResolvedValue(order)
    vi.mocked(getSupplyOrderUkraineProtocolKeys).mockResolvedValue([{ Key: 'Платіж', NetUid: 'key-1' }])
    vi.mocked(getResponsibleUsers).mockResolvedValue([])
    vi.mocked(getLogisticPaymentTaskResponsibleUsers).mockResolvedValue([])
    vi.mocked(createSupplyOrderUkrainePaymentProtocol).mockResolvedValue(order)
    vi.mocked(deleteSupplyOrderUkrainePaymentProtocol).mockResolvedValue(order)
  })

  it('does not mount the page model without page.view', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getSupplyOrderUkraineById).not.toHaveBeenCalled()
  })

  it('loads only page details when no create capability is granted', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Page.View)
    renderPage()

    await waitFor(() => expect(getSupplyOrderUkraineById).toHaveBeenCalledWith('order-1'))
    expect(getSupplyOrderUkraineProtocolKeys).not.toHaveBeenCalled()
    expect(getResponsibleUsers).not.toHaveBeenCalled()
    expect(getLogisticPaymentTaskResponsibleUsers).not.toHaveBeenCalled()
  })

  it('rechecks order create-payment-task before the scoped create mutation', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Page.View)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.CreatePaymentTask)
    const view = renderPage()

    const button = await screen.findByRole('button', { name: 'Створити протокол' })
    await waitFor(() => expect(getSupplyOrderUkraineProtocolKeys).toHaveBeenCalledTimes(1))
    expect(getResponsibleUsers).toHaveBeenCalledTimes(1)
    expect(getLogisticPaymentTaskResponsibleUsers).not.toHaveBeenCalled()

    allowedPermissions.delete(PermissionKeys.OrdersUkraine.Order.CreatePaymentTask)
    fireEvent.click(button)
    expect(createSupplyOrderUkrainePaymentProtocol).not.toHaveBeenCalled()

    view.unmount()
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.CreatePaymentTask)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Створити протокол' }))
    await waitFor(() => expect(createSupplyOrderUkrainePaymentProtocol).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ Value: 500, Discount: 50 }),
    ))
  })

  it('keeps delete independent and rechecks it before the scoped mutation', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Page.View)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.LogisticWay.DeletePaymentTask)
    const view = renderPage()

    const button = await screen.findByRole('button', { name: 'Видалити протокол' })
    allowedPermissions.delete(PermissionKeys.OrdersUkraine.LogisticWay.DeletePaymentTask)
    fireEvent.click(button)
    expect(deleteSupplyOrderUkrainePaymentProtocol).not.toHaveBeenCalled()

    view.unmount()
    allowedPermissions.add(PermissionKeys.OrdersUkraine.LogisticWay.DeletePaymentTask)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Видалити протокол' }))
    await waitFor(() => expect(deleteSupplyOrderUkrainePaymentProtocol).toHaveBeenCalledWith(
      'order-1',
      protocol,
    ))
  })

  it('uses the logistic user façade only for logistic payment-task creation', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Page.View)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.LogisticWay.CreatePaymentTask)
    renderPage()

    await waitFor(() => expect(getLogisticPaymentTaskResponsibleUsers).toHaveBeenCalledTimes(1))
    expect(getResponsibleUsers).not.toHaveBeenCalled()
    expect(getSupplyOrderUkraineProtocolKeys).not.toHaveBeenCalled()
  })
})
