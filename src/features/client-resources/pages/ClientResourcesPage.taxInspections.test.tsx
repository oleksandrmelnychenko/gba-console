import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ClientResourcesPage } from './ClientResourcesPage'

const { createMock, getTaxInspectionsMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getTaxInspectionsMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, cannot: () => false, isLoading: false, permissions: [] }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/clientResourcesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/clientResourcesApi')>(),
  createClientResourceTaxInspection: createMock,
  getClientResourceTaxInspections: getTaxInspectionsMock,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/clients/resources/tax-inspectation']}>
          <Routes>
            <Route path="/clients/resources/:step" element={<ClientResourcesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('tax inspections', () => {
  beforeEach(() => {
    createMock.mockReset()
    getTaxInspectionsMock.mockReset().mockResolvedValue([
      { Id: 1, NetUid: 'inspection-1', InspectionName: 'ДПІ у Шевченківському районі', InspectionNumber: '2650' },
    ])
  })

  it('requires Назва and Код ДПІ under their fields before creating', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Нова інспекція' }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    expect(within(dialog).getByText('Вкажіть назву інспекції')).toBeTruthy()
    expect(within(dialog).getByText('Вкажіть код ДПІ')).toBeTruthy()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('labels the row delete action in Ukrainian', async () => {
    renderPage()
    expect((await screen.findAllByLabelText('Видалити податкову інспекцію')).length).toBeGreaterThan(0)
    expect(screen.queryAllByLabelText('Видалити налогову інспекцію')).toHaveLength(0)
  })
})
