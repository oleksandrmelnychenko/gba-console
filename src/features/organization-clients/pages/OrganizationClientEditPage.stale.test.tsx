import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrencies, getOrganizationClient, updateOrganizationClient } from '../api/organizationClientsApi'
import type { OrganizationClient } from '../types'
import { OrganizationClientEditPage } from './OrganizationClientEditPage'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))
vi.mock('../api/organizationClientsApi', () => ({
  deleteOrganizationClient: vi.fn(),
  getCurrencies: vi.fn(),
  getOrganizationClient: vi.fn(),
  updateOrganizationClient: vi.fn(),
}))
vi.mock('../components/OrganizationClientForm', () => ({ OrganizationClientForm: () => <div>organization-form</div> }))
vi.mock('../components/OrganizationClientAgreementsPanel', () => ({ OrganizationClientAgreementsPanel: () => null }))
vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => <section>{children}{footer}</section>,
}))

const ORGANIZATION: OrganizationClient = {
  Address: 'Main street',
  City: 'Kraków',
  Country: 'Polska',
  FullName: 'Acme',
  MarginAmount: 10,
  NetUid: 'organization-1',
  NIP: '1234563218',
  OrganizationClientAgreements: [{ Currency: { Id: 1 }, FromDate: '2026-11-17', Number: '1' }],
  Updated: '2026-11-17T10:00:00',
}

function renderCard() {
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/organization-clients/edit/organization-1']}>
          <Routes>
            <Route path="/organization-clients/edit/:netId" element={<OrganizationClientEditPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('organization card stale and deleted states', () => {
  beforeEach(() => {
    vi.mocked(getCurrencies).mockResolvedValue([])
    vi.mocked(getOrganizationClient).mockReset().mockResolvedValue(ORGANIZATION)
    vi.mocked(updateOrganizationClient).mockReset()
  })

  it('sends the loaded Updated back and offers a reload on 409', async () => {
    vi.mocked(updateOrganizationClient).mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }))
    renderCard()
    await screen.findByText('organization-form')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateOrganizationClient).toHaveBeenCalledWith(
      expect.objectContaining({ Updated: '2026-11-17T10:00:00' }),
    ))
    expect(await screen.findByText(/Організацію змінив інший користувач/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Перезавантажити' }))
    await waitFor(() => expect(getOrganizationClient).toHaveBeenCalledTimes(2))
  })

  it('shows a deleted organization without a form or actions', async () => {
    vi.mocked(getOrganizationClient).mockResolvedValue({ ...ORGANIZATION, Deleted: true })
    renderCard()

    expect(await screen.findByText('Організацію видалено')).toBeTruthy()
    expect(screen.queryByText('organization-form')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
  })

  it('switches to the deleted state when a save answers 404', async () => {
    vi.mocked(updateOrganizationClient).mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
    renderCard()
    await screen.findByText('organization-form')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Організацію видалено')).toBeTruthy()
  })
})
