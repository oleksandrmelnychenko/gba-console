import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createConsumableStorage,
  getConsumableStorage,
  getConsumableStorageOrganizations,
  searchConsumableStorageUsers,
  updateConsumableStorage,
} from '../api/consumableStoragesApi'
import { ConsumableStorageFormPage } from './ConsumableStorageFormPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

/* The overlay dialog stays mounted while the route changes; a no-op navigate
   keeps the form on screen after a successful save, as in the browser. */
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => () => {},
}))

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

vi.mock('../api/consumableStoragesApi', () => ({
  createConsumableStorage: vi.fn(),
  getConsumableStorage: vi.fn(),
  getConsumableStorageOrganizations: vi.fn(),
  searchConsumableStorageUsers: vi.fn(),
  updateConsumableStorage: vi.fn(),
}))

const STORAGE_ID = '6f1c2a4e-1b2c-4d3e-8f90-123456789abc'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/storages/new" element={<ConsumableStorageFormPage />} />
            <Route path="/accounting/storages/edit/:id" element={<ConsumableStorageFormPage />} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('ConsumableStorageFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConsumableStorageOrganizations).mockResolvedValue([{ Id: 1, Name: 'QA Org', NetUid: 'org-1' }])
    vi.mocked(searchConsumableStorageUsers).mockResolvedValue([{ Id: 7, LastName: 'Комірник', NetUid: 'user-1' }])
  })

  it('limits Назва to 50 and Опис to 250 characters', async () => {
    renderAt('/accounting/storages/new')

    expect((await screen.findByLabelText(/Назва/)).getAttribute('maxlength')).toBe('50')
    expect(screen.getByLabelText('Опис').getAttribute('maxlength')).toBe('250')
  })

  it.each(['not-a-guid', '00000000-0000-0000-0000-000000000000'])('shows «Склад не знайдено» for the route id %s without a form', async (id) => {
    renderAt(`/accounting/storages/edit/${id}`)

    expect(await screen.findByText('Склад не знайдено.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(getConsumableStorage).not.toHaveBeenCalled()
  })

  it.each([
    ['an empty body', () => Promise.resolve(null)],
    ['a 404', () => Promise.reject(new ApiError('Склад не знайдено.', 404, null))],
  ])('shows «Склад не знайдено» when the server answers %s', async (_label, answer) => {
    vi.mocked(getConsumableStorage).mockImplementation(answer)
    renderAt(`/accounting/storages/edit/${STORAGE_ID}`)

    expect(await screen.findByText('Склад не знайдено.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })

  it('saves once when Enter is pressed again after the save succeeded', async () => {
    let resolveSave: (value: null) => void = () => {}
    vi.mocked(getConsumableStorage).mockResolvedValue({
      Name: 'Склад 1',
      NetUid: STORAGE_ID,
      Organization: { Id: 1, Name: 'QA Org', NetUid: 'org-1' },
      ResponsibleUser: { Id: 7, LastName: 'Комірник', NetUid: 'user-1' },
    })
    vi.mocked(updateConsumableStorage).mockImplementation(() => new Promise((resolve) => { resolveSave = resolve }))
    renderAt(`/accounting/storages/edit/${STORAGE_ID}`)

    const nameInput = await screen.findByDisplayValue('Склад 1')
    await waitFor(() => expect((nameInput as HTMLInputElement).disabled).toBe(false))

    const form = nameInput.closest('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    await act(async () => { resolveSave(null) })
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(updateConsumableStorage).toHaveBeenCalledTimes(1)
    expect(createConsumableStorage).not.toHaveBeenCalled()
  })

  it('focuses Назва and asks before closing with typed data (WH2-23)', async () => {
    renderAt('/accounting/storages/new')

    const nameInput = await screen.findByLabelText(/Назва/)
    await waitFor(() => expect(document.activeElement).toBe(nameInput))

    fireEvent.change(nameInput, { target: { value: 'Чернетка' } })
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

    expect(await screen.findByText('Закрити без збереження?')).toBeTruthy()
    expect(screen.getByDisplayValue('Чернетка')).toBeTruthy()
  })
})
