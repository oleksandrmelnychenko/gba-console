import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCompanyCarForEdit, getCompanyCarOrganizations, updateCompanyCar } from '../api/companyCarsApi'
import { CompanyCarFormPage } from './CompanyCarFormPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

/* The overlay dialog stays mounted while the route changes. */
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => () => {},
}))

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

vi.mock('../api/companyCarsApi', () => ({
  createCompanyCar: vi.fn(),
  deleteCompanyCar: vi.fn(),
  getCompanyCarForEdit: vi.fn(),
  getCompanyCarOrganizations: vi.fn(),
  updateCompanyCar: vi.fn(),
}))

const CAR_ID = '3a8f0c1e-5b6d-4e7f-8a9b-0c1d2e3f4a5b'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/company-cars/new" element={<CompanyCarFormPage />} />
            <Route path="/accounting/company-cars/edit/:id" element={<CompanyCarFormPage />} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('CompanyCarFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyCarOrganizations).mockResolvedValue([])
  })

  it.each(['not-a-guid', '00000000-0000-0000-0000-000000000000'])('shows «Автомобіль не знайдено» for %s', async (id) => {
    renderAt(`/accounting/company-cars/edit/${id}`)

    expect(await screen.findByText('Автомобіль не знайдено.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(getCompanyCarForEdit).not.toHaveBeenCalled()
  })

  it.each([
    ['an empty body', () => Promise.resolve(null)],
    ['a 404', () => Promise.reject(new ApiError('Автомобіль не знайдено.', 404, null))],
  ])('shows «Автомобіль не знайдено» when the server answers %s', async (_label, answer) => {
    vi.mocked(getCompanyCarForEdit).mockImplementation(answer)
    renderAt(`/accounting/company-cars/edit/${CAR_ID}`)

    expect(await screen.findByText('Автомобіль не знайдено.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })

  it('blocks a new car with an over-full tank and shows the error inline', async () => {
    renderAt('/accounting/company-cars/new')

    fireEvent.change(await screen.findByLabelText(/№ Авто/), { target: { value: 'AA0001QA' } })
    fireEvent.change(screen.getByLabelText(/Вмістимість баку/), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/Кількість пального/), { target: { value: '60' } })

    expect(await screen.findByText('Кількість пального не може перевищувати вмістимість баку')).toBeTruthy()
  })

  it('saves once even when submitted again after the save succeeded', async () => {
    let resolveSave: (value: null) => void = () => {}
    vi.mocked(getCompanyCarForEdit).mockResolvedValue({
      CarBrand: 'Skoda',
      FuelAmount: 30,
      LicensePlate: 'AA0001QA',
      Mileage: 1200,
      NetUid: CAR_ID,
      TankCapacity: 50,
    })
    vi.mocked(updateCompanyCar).mockImplementation(() => new Promise((resolve) => { resolveSave = resolve }))
    renderAt(`/accounting/company-cars/edit/${CAR_ID}`)

    const plate = await screen.findByDisplayValue('AA0001QA')
    await waitFor(() => expect((plate as HTMLInputElement).disabled).toBe(false))
    const form = plate.closest('form') as HTMLFormElement

    fireEvent.submit(form)
    fireEvent.submit(form)
    await act(async () => { resolveSave(null) })
    fireEvent.submit(form)

    expect(updateCompanyCar).toHaveBeenCalledTimes(1)
  })
})
