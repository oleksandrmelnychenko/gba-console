import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getConsumableOrder,
  getConsumableOrderForPayment,
  getFinanceDirectorUsers,
} from '../api/consumableOrdersApi'
import {
  CONSUMABLE_ORDERS_PAGE_PERMISSION,
  CONSUMABLE_ORDER_CREATE_PERMISSION,
} from '../permissions'
import { ConsumableOrderFormPage } from './ConsumableOrderFormPage'
import { ConsumableOrderPayPage } from './ConsumableOrderPayPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/consumableOrdersApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/consumableOrdersApi')>(),
  getConsumableOrder: vi.fn().mockResolvedValue({
    ConsumablesOrderDocuments: [],
    ConsumablesOrderItems: [],
    NetUid: 'order-1',
    OutcomePaymentOrderConsumablesOrders: [],
  }),
  getConsumableOrderForPayment: vi.fn(),
  getFinanceDirectorUsers: vi.fn().mockResolvedValue([]),
  searchConsumableStorages: vi.fn().mockResolvedValue([]),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

function renderRoute(path: string, element: ReactNode, route: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  )
}

describe('consumable-order direct route permission boundaries', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
  })

  it('requires page access in addition to create permission for a direct new route', () => {
    allowedPermissions.add(CONSUMABLE_ORDER_CREATE_PERMISSION)

    renderRoute('/accounting/consumable-orders/new', <ConsumableOrderFormPage />, '/accounting/consumable-orders/new')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getFinanceDirectorUsers).not.toHaveBeenCalled()
  })

  it('opens an existing order read-only with page access but no edit permission', async () => {
    allowedPermissions.add(CONSUMABLE_ORDERS_PAGE_PERMISSION)

    renderRoute('/accounting/consumable-orders/edit/order-1', <ConsumableOrderFormPage />, '/accounting/consumable-orders/edit/:id')

    expect(await screen.findByText('Редагування прибуткової накладної')).toBeTruthy()
    expect(screen.getByText('Режим перегляду: для редагування накладної потрібне окреме право.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(getConsumableOrder).toHaveBeenCalledWith('order-1')
  })

  it('does not mount the payment data flow without pay permission', () => {
    renderRoute('/accounting/consumable-orders/pay/order-1', <ConsumableOrderPayPage />, '/accounting/consumable-orders/pay/:id')

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getConsumableOrderForPayment).not.toHaveBeenCalled()
  })
})
