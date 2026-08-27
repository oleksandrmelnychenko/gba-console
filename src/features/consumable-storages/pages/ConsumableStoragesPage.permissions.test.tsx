import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createDeprecatedConsumableOrder,
  getConsumableStorages,
  getDeprecatedConsumableOrders,
} from '../api/consumableStoragesApi'
import { ConsumableStoragesPage } from './ConsumableStoragesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({
    children,
    fallback = null,
    permissionKey,
  }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/consumableStoragesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/consumableStoragesApi')>(),
  createDeprecatedConsumableOrder: vi.fn(),
  getConsumableStorages: vi.fn(),
  getDeprecatedConsumableOrders: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>{children}</I18nProvider>
      </MantineProvider>
    </MemoryRouter>
  )
}

describe('consumable storage write-off permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.Warehouses.Premises.Page.View)
    allowedPermissions.add(PermissionKeys.Warehouses.Premises.WriteOff.Create)
    vi.clearAllMocks()
    vi.mocked(getConsumableStorages).mockResolvedValue([{
      ConsumableProducts: [],
      ConsumablesOrders: [],
      Name: 'Основний склад',
      NetUid: 'storage-1',
      PriceTotals: [],
    }])
    vi.mocked(getDeprecatedConsumableOrders).mockResolvedValue([])
  })

  it('rechecks write-off create after the editor has already opened', async () => {
    render(
      <Providers>
        <ConsumableStoragesPage />
      </Providers>,
    )

    fireEvent.click(await screen.findByText('Основний склад'))
    fireEvent.click(await screen.findByRole('tab', { name: 'Списані товари' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Списати' }))

    allowedPermissions.delete(PermissionKeys.Warehouses.Premises.WriteOff.Create)
    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти' }))

    expect(createDeprecatedConsumableOrder).not.toHaveBeenCalled()
    expect(await screen.findByText('Немає прав для збереження списання')).toBeTruthy()
  })
})
