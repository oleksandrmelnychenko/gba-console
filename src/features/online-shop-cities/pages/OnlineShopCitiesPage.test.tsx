import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOnlineShopCities } from '../api/onlineShopCitiesApi'
import type { OnlineShopCity } from '../types'
import { OnlineShopCitiesPage } from './OnlineShopCitiesPage'

vi.mock('../api/onlineShopCitiesApi', () => ({
  getOnlineShopCities: vi.fn(),
  saveOnlineShopCity: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data }: { data: OnlineShopCity[] }) => (
    <div data-count={data.length} data-testid="cities-table">
      {data.map((city) => (
        <span key={city.Id}>{city.NameUa}</span>
      ))}
    </div>
  ),
}))

const CITIES: OnlineShopCity[] = [
  { Deleted: false, Id: 1, IsLocalPayment: true, NameRu: 'Киев', NameUa: 'Київ' },
  { Deleted: false, Id: 2, IsLocalPayment: false, NameRu: 'Одесса', NameUa: 'Одеса' },
  { Deleted: true, Id: 3, IsLocalPayment: false, NameRu: 'Львов', NameUa: 'Львів' },
]

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <OnlineShopCitiesPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
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
