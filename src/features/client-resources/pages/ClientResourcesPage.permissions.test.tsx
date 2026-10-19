import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ClientResourcesPage } from './ClientResourcesPage'

const {
  canMock,
  getRegionsMock,
  getClientTypesMock,
  getTransportersMock,
  getTransporterTypesMock,
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getRegionsMock: vi.fn(),
  getClientTypesMock: vi.fn(),
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
    getClientResourceClientTypes: getClientTypesMock,
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
    getClientTypesMock.mockReset()
    getClientTypesMock.mockResolvedValue([])
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

  it('opens the selected region from the shared edit action', async () => {
    canMock.mockReturnValue(true)
    getRegionsMock.mockResolvedValue([
      { Id: 1, NetUid: 'region-bl', Name: 'BL', RegionCodes: [{ Id: 1, Value: 'BL001' }] },
      { Id: 2, NetUid: 'region-ce', Name: 'CE', RegionCodes: [{ Id: 2, Value: 'CE001' }] },
    ])

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^CE/ }))
    expect(screen.getByRole('button', { name: /^CE/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('button', { name: 'Редагувати регіон' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати регіон' }))
    const editor = await screen.findByRole('dialog')
    expect((within(editor).getByRole('textbox', { name: /Назва/ }) as HTMLInputElement).value).toBe('CE')
  })

  it('hides selected-region actions without their permissions', async () => {
    const denied = new Set<string>([
      PermissionKeys.ClientResources.Region.Edit,
      PermissionKeys.ClientResources.Region.Delete,
      PermissionKeys.ClientResources.RegionCode.Create,
    ])
    canMock.mockImplementation((key) => !denied.has(key))
    getRegionsMock.mockResolvedValue([{ Id: 1, NetUid: 'region-bl', Name: 'BL', RegionCodes: [] }])
    renderPage()
    await screen.findByRole('button', { name: /^BL/ })
    expect(screen.queryByRole('button', { name: 'Редагувати регіон' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити регіон' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Додати код' })).toBeNull()
  })

  it('loads the selected reserve days and discards canceled changes on reopen', async () => {
    canMock.mockReturnValue(true)
    getClientTypesMock.mockResolvedValue([{ Type: 0, ClientTypeRoles: [
      { Id: 1, Name: 'Покупці Україна', OrderExpireDays: 3 },
    ] }])
    renderPage('/clients/resources/product-reserve')
    fireEvent.click(await screen.findByLabelText('Редагувати резерв'))
    let dialog = await screen.findByRole('dialog')
    let input = within(dialog).getByRole('spinbutton', { name: /Днів резерву/ }) as HTMLInputElement
    expect(input.value).toBe('3')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
    fireEvent.click(screen.getByLabelText('Редагувати резерв'))
    dialog = await screen.findByRole('dialog')
    input = within(dialog).getByRole('spinbutton', { name: /Днів резерву/ }) as HTMLInputElement
    expect(input.value).toBe('3')
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
