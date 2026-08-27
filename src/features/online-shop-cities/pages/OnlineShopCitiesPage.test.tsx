import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOnlineShopCities } from '../api/onlineShopCitiesApi'
import type { OnlineShopCity } from '../types'
import { OnlineShopCitiesPage } from './OnlineShopCitiesPage'

const { canMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: canMock,
    cannot: (permissionKey: string) => !canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/onlineShopCitiesApi', () => ({
  getOnlineShopCities: vi.fn(),
  saveOnlineShopCity: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    onRowClick,
  }: {
    columns: Array<{ cell?: (city: OnlineShopCity) => React.ReactNode }>
    data: OnlineShopCity[]
    onRowClick?: (city: OnlineShopCity) => void
  }) => (
    <div data-count={data.length} data-testid="cities-table">
      {data.map((city) => (
        <div key={city.Id} role="row" onClick={() => onRowClick?.(city)}>
          {columns.map((column, index) => (
            <span key={index}>{column.cell?.(city)}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const CITIES: OnlineShopCity[] = [
  { Deleted: false, Id: 1, IsLocalPayment: true, NameRu: 'Киев', NameUa: 'Київ' },
  { Deleted: false, Id: 2, IsLocalPayment: false, NameRu: 'Одесса', NameUa: 'Одеса' },
  { Deleted: true, Id: 3, IsLocalPayment: false, NameRu: 'Львов', NameUa: 'Львів' },
]

function renderPage(allowed?: string[]) {
  const permissions = allowed ? new Set(allowed) : null
  canMock.mockImplementation((permissionKey) => permissions?.has(permissionKey) ?? true)

  return render(
    <MantineProvider>
      <I18nProvider>
        <OnlineShopCitiesPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  canMock.mockReset()
  vi.mocked(getOnlineShopCities).mockReset()
  vi.mocked(getOnlineShopCities).mockResolvedValue(CITIES)
})

describe('OnlineShopCitiesPage rail', () => {
  it('uses a headerless rail inside the framed workspace', async () => {
    const { container } = renderPage()

    await screen.findByText('Київ')

    const workspace = container.querySelector('.online-shop-cities-layout')
    const rail = within(workspace as HTMLElement).getByRole('complementary', { name: 'Міста' })
    const roster = workspace?.querySelector('.online-shop-cities-roster')

    expect(workspace).not.toBeNull()
    expect(rail.querySelector('.app-section-title')).toBeNull()
    expect(rail.querySelector(':scope > .online-shop-cities-filter-scroll')).not.toBeNull()
    expect(roster?.classList.contains('console-table-body')).toBe(true)
  })

  it('keeps counts on the right and filters the grid from the flat navigation items', async () => {
    renderPage()

    await screen.findByText('Київ')

    const rail = screen.getByRole('complementary', { name: 'Міста' })
    const allCities = within(rail).getByRole('button', { name: /Всі міста/ })
    const archived = within(rail).getByRole('button', { name: /Архів/ })

    expect(allCities.classList.contains('is-active')).toBe(true)
    expect(allCities.getAttribute('aria-pressed')).toBe('true')
    expect(
      allCities.querySelector('.online-shop-cities-filter-label')?.lastElementChild?.classList.contains(
        'online-shop-cities-filter-chevron',
      ),
    ).toBe(true)
    expect(allCities.querySelector('.online-shop-cities-filter-count')).not.toBeNull()
    expect(
      allCities.lastElementChild?.classList.contains('online-shop-cities-filter-marker'),
    ).toBe(true)
    expect(allCities.querySelector('.online-shop-cities-filter-count')?.textContent).toBe('3')

    fireEvent.click(archived)

    await waitFor(() => {
      expect(screen.getByTestId('cities-table').getAttribute('data-count')).toBe('1')
    })
    expect(archived.classList.contains('is-active')).toBe(true)
    expect(archived.getAttribute('aria-pressed')).toBe('true')
    expect(allCities.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Львів')).not.toBeNull()
    expect(screen.queryByText('Київ')).toBeNull()
  })
})

describe('OnlineShopCitiesPage business permissions', () => {
  it('does not expose create, edit or archive through technical UI without their rights', async () => {
    renderPage([])

    const city = await screen.findByText('Київ')
    expect(screen.queryByRole('button', { name: 'Нове місто' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Архівувати' })).toBeNull()
    fireEvent.click(city)
    expect(screen.queryByText('Редагування міста')).toBeNull()
  })

  it('keeps create, edit and archive independent', async () => {
    const { unmount } = renderPage([PermissionKeys.OnlineShopCities.City.Create])
    expect(await screen.findByRole('button', { name: 'Нове місто' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Архівувати' })).toBeNull()
    unmount()

    renderPage([PermissionKeys.OnlineShopCities.City.Edit])
    const city = await screen.findByText('Київ')
    fireEvent.click(city)
    expect(await screen.findByText('Редагування міста')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Архівувати' })).toBeNull()
  })
})
