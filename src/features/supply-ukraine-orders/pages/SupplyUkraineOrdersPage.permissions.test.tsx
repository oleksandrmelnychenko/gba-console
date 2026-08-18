import { render, screen } from '@testing-library/react'
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
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getDirectSupplyUkraineOrdersMock: vi.fn(),
  getSupplyOrderCurrenciesMock: vi.fn(),
  getSupplyUkraineOrdersMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (value: string) => value }),
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
})
