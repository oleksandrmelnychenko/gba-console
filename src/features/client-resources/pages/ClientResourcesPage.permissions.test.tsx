import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
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

describe('ClientResourcesPage permissions', () => {
  beforeEach(() => {
    canMock.mockReset()
    getRegionsMock.mockReset()
    getRegionsMock.mockResolvedValue([])
    getTransporterTypesMock.mockReset()
    getTransporterTypesMock.mockResolvedValue([
      { Id: 1, Name: 'Ukraine', NetUid: 'type-net-id' },
    ])
    getTransportersMock.mockReset()
    getTransportersMock.mockResolvedValue([
      {
        CssClass: 'regular',
        Name: 'Тестовий перевізник',
        NetUid: 'transporter-net-id',
        Priority: 1,
      },
    ])
  })

  it('does not mount resource data calls without the canonical page permission', () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey !== PermissionKeys.ClientResources.Page.View,
    )

    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.getByText('Недостатньо прав для перегляду ресурсів компанії')).toBeTruthy()
    expect(getRegionsMock).not.toHaveBeenCalled()
  })

  it('hides each reviewed transporter control without its own permission', async () => {
    const denied = new Set<string>([
      PermissionKeys.ClientResources.Transporter.Create,
      PermissionKeys.ClientResources.Transporter.Edit,
      PermissionKeys.ClientResources.Transporter.Delete,
    ])
    canMock.mockImplementation(
      (permissionKey) => !denied.has(permissionKey),
    )

    renderPage('/clients/resources/carrier')

    await screen.findByText('Тестовий перевізник')
    expect(
      screen.queryByRole('button', { name: 'Перевізник' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Редагувати перевізника' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Архівувати перевізника' }),
    ).toBeNull()
  })
})
