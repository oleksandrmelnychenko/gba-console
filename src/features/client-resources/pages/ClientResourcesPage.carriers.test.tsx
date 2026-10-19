import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ClientResourcesPage } from './ClientResourcesPage'

const {
  canMock,
  getRegionsMock,
  getTransportersMock,
  getTransporterTypesMock,
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getRegionsMock: vi.fn(),
  getTransportersMock: vi.fn(),
  getTransporterTypesMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: canMock,
    cannot: (permissionKey: string) => !canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/clientResourcesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clientResourcesApi')>()

  return {
    ...actual,
    getClientResourceRegions: getRegionsMock,
    getClientResourceTransporters: getTransportersMock,
    getClientResourceTransporterTypes: getTransporterTypesMock,
  }
})

function renderPage(path = '/clients/resources/regions') {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/clients/resources/:step"
              element={<ClientResourcesPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ClientResourcesPage carriers', () => {
  beforeEach(() => {
    canMock.mockReset()
    canMock.mockReturnValue(true)
    getRegionsMock.mockReset()
    getRegionsMock.mockResolvedValue([])
    getTransporterTypesMock.mockReset()
    getTransporterTypesMock.mockResolvedValue([
      { Id: 1, Name: 'Ukraine', NetUid: 'type-net-id' },
    ])
    getTransportersMock.mockReset()
    getTransportersMock.mockResolvedValue([
      {
        CssClass: 'nova_posta_item_class',
        ImageUrl: 'http://85.17.167.167:20001/Images/Products/nova.png',
        Name: 'Нова пошта',
        NetUid: 'nova-net-id',
        Priority: 1,
      },
      {
        CssClass: 'gunsel_item_class',
        Name: 'Гюнсел',
        NetUid: 'gunsel-net-id',
        Priority: 2,
      },
      {
        Name: 'Без логотипу',
        NetUid: 'plain-net-id',
        Priority: 3,
      },
    ])
  })

  it('shows the bundled carrier logos in the active carriers table', async () => {
    renderPage('/clients/resources/carrier')

    await screen.findByText('Без логотипу')
    const nova = screen.getByAltText('Нова пошта') as HTMLImageElement
    const gunsel = screen.getByAltText('Гюнсел') as HTMLImageElement
    expect(nova.getAttribute('src')).toContain('nova_posta')
    expect(gunsel.getAttribute('src')).toContain('gunsel')
    expect(screen.queryByAltText('Без логотипу')).toBeNull()
  })
})
