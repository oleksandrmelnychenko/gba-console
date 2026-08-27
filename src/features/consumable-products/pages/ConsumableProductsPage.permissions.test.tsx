import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createConsumableProductCategory,
  getConsumableProductCategories,
} from '../api/consumableProductsApi'
import { ConsumableProductsPage } from './ConsumableProductsPage'

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
    hasPermission: (permission: string) =>
      allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/consumableProductsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/consumableProductsApi')>(),
  createConsumableProductCategory: vi.fn(),
  getConsumableProductCategories: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

describe('consumable product permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.ConsumableProducts.Page.View)
    vi.clearAllMocks()
    vi.mocked(getConsumableProductCategories).mockResolvedValue([])
  })

  it('rechecks category create after the editor has already opened', async () => {
    allowedPermissions.add(PermissionKeys.ConsumableProducts.Category.Create)

    render(
      <Providers>
        <ConsumableProductsPage />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Додати категорію' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Назва' }), {
      target: { value: 'Нова категорія' },
    })
    allowedPermissions.delete(PermissionKeys.ConsumableProducts.Category.Create)
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(createConsumableProductCategory).not.toHaveBeenCalled()
  })
})
