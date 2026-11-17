import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getUsers } from '../api/usersApi'
import { UsersPage } from './UsersPage'

vi.mock('../api/usersApi', () => ({ getUsers: vi.fn() }))
vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({ DataTable: () => <div data-testid="users-table" /> }))

function renderAt(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/users', state }]}>
      <MantineProvider>
        <I18nProvider>
          <UsersPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('UsersPage refresh after a user sheet changed data', () => {
  beforeEach(() => {
    vi.mocked(getUsers).mockReset()
    vi.mocked(getUsers).mockResolvedValue([])
  })

  it('reloads the list when a sheet returns with { mutated: true }', async () => {
    renderAt({ mutated: true })
    await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(2))
  })

  it('loads once when nothing changed', async () => {
    renderAt(null)
    await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(getUsers).toHaveBeenCalledTimes(1)
  })
})
