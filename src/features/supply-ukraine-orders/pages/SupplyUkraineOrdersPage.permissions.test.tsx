import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { SupplyUkraineOrdersPage } from './SupplyUkraineOrdersPage'

const {
  canMock,
  getDirectSupplyUkraineOrdersMock,
  getSupplyOrderCurrenciesMock,
  getSupplyUkraineOrdersMock,
  hasPermissionMock,
  translateMock,
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getDirectSupplyUkraineOrdersMock: vi.fn(),
  getSupplyOrderCurrenciesMock: vi.fn(),
  getSupplyUkraineOrdersMock: vi.fn(),
  hasPermissionMock: vi.fn<(permissionKey: string) => boolean>(),
  translateMock: (value: string) => value,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: hasPermissionMock }),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: translateMock }),
}))

vi.mock('../../../shared/realtime/events', () => ({
  realtimeEvents: {
    supplyOrderAdded: 'supply-order-added',
    supplyOrderNotification: 'supply-order-notification',
  },
  useRealtimeEvent: vi.fn(),
}))

vi.mock('../api/supplyUkraineOrdersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/supplyUkraineOrdersApi')>()),
  getDirectSupplyUkraineOrders: getDirectSupplyUkraineOrdersMock,
  getSupplyOrderCurrencies: getSupplyOrderCurrenciesMock,
  getSupplyUkraineOrders: getSupplyUkraineOrdersMock,
}))

describe('SupplyUkraineOrdersPage permissions', () => {
  beforeEach(() => {
    canMock.mockReset()
    getSupplyUkraineOrdersMock.mockReset()
    getDirectSupplyUkraineOrdersMock.mockReset()
    getSupplyOrderCurrenciesMock.mockReset()
    hasPermissionMock.mockReset()
  })

  it('blocks the page and all registry requests without the canonical page right', () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey !== PermissionKeys.OrdersUkraine.Page.View,
    )

    render(
      <MantineProvider>
        <MemoryRouter>
          <SupplyUkraineOrdersPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(screen.getByText('Недостатньо прав для перегляду замовлень України')).not.toBeNull()
    expect(getSupplyUkraineOrdersMock).not.toHaveBeenCalled()
    expect(getDirectSupplyUkraineOrdersMock).not.toHaveBeenCalled()
    expect(getSupplyOrderCurrenciesMock).not.toHaveBeenCalled()
  })

  it('shows supply creation only with open-arrival while keeping other create actions independent', async () => {
    canMock.mockReturnValue(true)
    hasPermissionMock.mockImplementation(
      (permissionKey) => permissionKey === PermissionKeys.OrdersUkraine.Order.OpenArrival,
    )
    getSupplyUkraineOrdersMock.mockResolvedValue({ items: [], totalQty: 0 })
    getDirectSupplyUkraineOrdersMock.mockResolvedValue({ items: [], totalQty: 0 })
    getSupplyOrderCurrenciesMock.mockResolvedValue([])

    render(
      <MantineProvider>
        <MemoryRouter>
          <SupplyUkraineOrdersPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    await waitFor(() => expect(getSupplyUkraineOrdersMock).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Поставка' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Нове замовлення' })).toBeNull()
  })

  it('shows direct creation with page and open-order access without requiring logistic-way access', async () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey === PermissionKeys.OrdersUkraine.Page.View,
    )
    hasPermissionMock.mockImplementation(
      (permissionKey) => permissionKey === PermissionKeys.OrdersUkraine.Order.OpenOrder,
    )
    getSupplyUkraineOrdersMock.mockResolvedValue({ items: [], totalQty: 0 })
    getDirectSupplyUkraineOrdersMock.mockResolvedValue({ items: [], totalQty: 0 })
    getSupplyOrderCurrenciesMock.mockResolvedValue([])

    render(
      <MantineProvider>
        <MemoryRouter>
          <SupplyUkraineOrdersPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    await waitFor(() => expect(getDirectSupplyUkraineOrdersMock).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Нове замовлення' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Поставка' })).toBeNull()
  })
})
