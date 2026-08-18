import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ClientsStructureTreePage } from './ClientsStructureTreePage'

const { canMock, getClientsForStructureMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getClientsForStructureMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../api/clientsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clientsApi')>()
  return {
    ...actual,
    getClientsForStructure: getClientsForStructureMock,
  }
})

describe('ClientsStructureTreePage permissions', () => {
  it('does not mount the structure model without both page and structure rights', () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey === PermissionKeys.Clients.Page.View,
    )

    render(
      <MantineProvider>
        <I18nProvider>
          <ClientsStructureTreePage />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.getByText('Недостатньо прав для перегляду структури клієнтів')).toBeTruthy()
    expect(getClientsForStructureMock).not.toHaveBeenCalled()
  })
})
