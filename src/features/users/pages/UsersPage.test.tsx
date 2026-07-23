import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getUsers } from '../api/usersApi'
import type { UserProfile } from '../types'
import { UsersPage } from './UsersPage'

vi.mock('../api/usersApi', () => ({
  getUsers: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    height,
  }: {
    data: UserProfile[]
    height?: number | string
  }) => (
    <div
      data-height={String(height)}
      data-row-count={String(data.length)}
      data-testid="users-table"
    />
  ),
}))

const USERS: UserProfile[] = [
  {
    Email: 'admin-one@example.com',
    FirstName: 'Олена',
    LastName: 'Коваль',
    NetUid: 'admin-one',
    UserRole: { Name: 'Адміністратор' },
  },
  {
    Email: 'admin-two@example.com',
    FirstName: 'Іван',
    LastName: 'Бондар',
    NetUid: 'admin-two',
    UserRole: { Name: 'Адміністратор' },
  },
  {
    Email: 'manager@example.com',
    FirstName: 'Марія',
    LastName: 'Лисенко',
    NetUid: 'manager',
    UserRole: { Name: 'Менеджер' },
  },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <MantineProvider>
        <I18nProvider>
          <UsersPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getUsers).mockReset()
  vi.mocked(getUsers).mockResolvedValue(USERS)
})

describe('UsersPage role rail', () => {
  it('keeps the headerless patterned rail and framed roster in one grid workspace', async () => {
    const { container } = renderPage()

    await screen.findByRole('button', { name: /Адміністратор/ })

    const workspace = container.querySelector('.users-workspace')
    const rail = workspace?.querySelector(':scope > .users-role-rail')
    const roster = workspace?.querySelector(':scope > .users-roster')
    const scroll = rail?.querySelector(':scope > .users-role-scroll')

    expect(workspace).not.toBeNull()
    expect(rail?.querySelector('.app-section-title')).toBeNull()
    expect(scroll?.querySelector('.users-role-list')).not.toBeNull()
    expect(roster?.contains(screen.getByTestId('users-table'))).toBe(true)
    expect(screen.getByTestId('users-table').getAttribute('data-height')).toBe('100%')

    const allUsers = screen.getByRole('button', { name: /Всі користувачі/ })
    const adminRole = screen.getByRole('button', { name: /Адміністратор/ })

    expect(allUsers.classList.contains('is-active')).toBe(true)
    expect(allUsers.getAttribute('aria-pressed')).toBe('true')
    expect(allUsers.querySelector('.users-role-option-count')?.textContent).toBe('3')
    expect(adminRole.querySelector('.users-role-option-count')?.textContent).toBe('2')
    expect(
      adminRole.querySelector('.users-role-option-main > .users-role-option-chevron'),
    ).not.toBeNull()
  })

  it('preserves role filtering while moving the active rail state', async () => {
    renderPage()

    const adminRole = await screen.findByRole('button', { name: /Адміністратор/ })
    fireEvent.click(adminRole)

    await waitFor(() => {
      expect(screen.getByTestId('users-table').getAttribute('data-row-count')).toBe('2')
    })

    expect(adminRole.classList.contains('is-active')).toBe(true)
    expect(adminRole.getAttribute('aria-pressed')).toBe('true')
    expect(
      screen
        .getByRole('button', { name: /Всі користувачі/ })
        .classList.contains('is-active'),
    ).toBe(false)
  })
})
