import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getResaleAvailabilities } from '../api/resalesApi'
import { RESALES_PAGE_PERMISSION, RESALE_CREATE_PERMISSION } from '../permissions'
import { NewResalePage } from './ResalesPage'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => permission === RESALES_PAGE_PERMISSION || permission === RESALE_CREATE_PERMISSION,
    isLoading: false,
  }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/resalesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/resalesApi')>(),
  getResaleAvailabilities: vi.fn().mockResolvedValue({ GroupReSaleAvailabilities: [] }),
  getResaleAvailabilityFilterOptions: vi.fn().mockResolvedValue({ ProductGroups: [], SpecificationCodes: [], Storages: [] }),
}))

const availabilityMock = vi.mocked(getResaleAvailabilities)

function renderNewResale() {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={['/resales/new']}>
          <Routes>
            <Route path="/resales/new" element={<NewResalePage />} />
            <Route path="/resales" element={<div>Список перепродажів</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

const sentAmounts = () => availabilityMock.mock.calls.map(([payload]) => payload.Amount)

describe('Новий перепродаж selection settings', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
  })

  beforeEach(() => {
    availabilityMock.mockClear()
  })

  it('never posts an out-of-range «Сума для рахунку», and reloads once per typing burst', async () => {
    const user = userEvent.setup()
    renderNewResale()
    await waitFor(() => expect(availabilityMock).toHaveBeenCalledTimes(1))
    const amount = screen.getByRole('textbox', { name: 'Сума для рахунку' })

    await user.type(amount, '99999999999')
    expect(screen.getByText('Не більше 1000000000')).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(sentAmounts().every((value) => value <= 1_000_000_000)).toBe(true)

    await user.clear(amount)
    await new Promise((resolve) => setTimeout(resolve, 700))
    availabilityMock.mockClear()

    await user.type(amount, '12500')
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(sentAmounts()).toEqual([12500])

    await user.type(amount, 'abc')
    expect((amount as HTMLInputElement).value).toBe('12500')
  })

  it('does not close the page on Escape', async () => {
    renderNewResale()
    expect(await screen.findByText('Новий перепродаж')).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'Escape' })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(screen.queryByText('Список перепродажів')).toBeNull()
    expect(screen.getByText('Новий перепродаж')).toBeTruthy()
  })
})
