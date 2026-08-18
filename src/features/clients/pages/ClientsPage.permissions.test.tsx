import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ClientsPage } from './ClientsPage'

const { canMock, getClientsMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getClientsMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: canMock,
    cannot: (permissionKey: string) => !canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/clientsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clientsApi')>()
  return { ...actual, getClients: getClientsMock }
})

describe('ClientsPage permissions', () => {
  it('does not mount the clients registry without the canonical page permission', () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey !== PermissionKeys.Clients.Page.View,
    )

    render(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/clients?roleIds=1']}>
            <ClientsPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.getByText('Недостатньо прав для перегляду клієнтів')).toBeTruthy()
    expect(getClientsMock).not.toHaveBeenCalled()
  })
})
