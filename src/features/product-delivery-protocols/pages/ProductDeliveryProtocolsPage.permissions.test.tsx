import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ProductDeliveryProtocolsPage } from './ProductDeliveryProtocolsPage'

const { canMock, getProtocolsMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getProtocolsMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: canMock,
    cannot: (permissionKey: string) => !canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/productDeliveryProtocolsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/productDeliveryProtocolsApi')>()
  return { ...actual, getProtocols: getProtocolsMock }
})

describe('ProductDeliveryProtocolsPage permissions', () => {
  it('does not mount registry data without the canonical page permission', () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey !== PermissionKeys.ProductDeliveryProtocols.Page.View,
    )

    render(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/product-delivery-protocols']}>
            <ProductDeliveryProtocolsPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.getByText('Недостатньо прав для перегляду протоколів доставки')).toBeTruthy()
    expect(getProtocolsMock).not.toHaveBeenCalled()
  })
})
