import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ClientResourceOrganization } from '../types'
import { ClientResourcesPage } from './ClientResourcesPage'

const {
  getCurrenciesMock,
  getOrganizationsMock,
  getStoragesMock,
  getTaxInspectionsMock,
  getVatRatesMock,
  updateOrganizationMock,
} = vi.hoisted(() => ({
  getCurrenciesMock: vi.fn(),
  getOrganizationsMock: vi.fn(),
  getStoragesMock: vi.fn(),
  getTaxInspectionsMock: vi.fn(),
  getVatRatesMock: vi.fn(),
  updateOrganizationMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    cannot: () => false,
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/clientResourcesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clientResourcesApi')>()

  return {
    ...actual,
    getClientResourceCurrencies: getCurrenciesMock,
    getClientResourceOrganizations: getOrganizationsMock,
    getClientResourceStorages: getStoragesMock,
    getClientResourceTaxInspections: getTaxInspectionsMock,
    getClientResourceVatRates: getVatRatesMock,
    updateClientResourceOrganization: updateOrganizationMock,
  }
})

const organization: ClientResourceOrganization = {
  Id: 7,
  Name: 'ТОВ Нова',
  NetUid: 'organization-new',
  PriceSourceIsAmg: false,
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/clients/resources/organizations']}>
          <Routes>
            <Route path="/clients/resources/:step" element={<ClientResourcesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

const warning = 'Світ цін визначає ціни й націнки для всіх договорів організації. Змінити його можна лише поки в організації немає документів.'

beforeEach(() => {
  getCurrenciesMock.mockReset().mockResolvedValue([])
  getOrganizationsMock.mockReset().mockResolvedValue([organization])
  getStoragesMock.mockReset().mockResolvedValue([])
  getTaxInspectionsMock.mockReset().mockResolvedValue([])
  getVatRatesMock.mockReset().mockResolvedValue([])
  updateOrganizationMock.mockReset().mockResolvedValue(organization)
})

describe('ClientResourcesPage organization price world', () => {
  it('warns before switching the price world and sends it with the organization', async () => {
    renderPage()
    fireEvent.click((await screen.findAllByLabelText('Редагувати організацію'))[0])
    const editor = await screen.findByRole('dialog')

    expect((within(editor).getByRole('radio', { name: 'Контех' }) as HTMLInputElement).checked).toBe(true)
    expect(within(editor).queryByText(warning)).toBeNull()

    fireEvent.click(within(editor).getByRole('radio', { name: 'AMG' }))
    expect(within(editor).getByText(warning)).toBeTruthy()

    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateOrganizationMock).toHaveBeenCalledTimes(1))
    expect(updateOrganizationMock.mock.calls[0][0]).toMatchObject({ NetUid: 'organization-new', PriceSourceIsAmg: true })
  })

  it('shows the server refusal when the organization already has documents', async () => {
    updateOrganizationMock.mockRejectedValue(new Error('Організація вже має документи — світ цін змінити не можна'))
    renderPage()
    fireEvent.click((await screen.findAllByLabelText('Редагувати організацію'))[0])
    const editor = await screen.findByRole('dialog')

    fireEvent.click(within(editor).getByRole('radio', { name: 'AMG' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))

    expect(await within(editor).findByText('Організація вже має документи — світ цін змінити не можна')).toBeTruthy()
  })
})
