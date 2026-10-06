import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SupplyUkraineDirectOrderCreatePage } from './SupplyUkraineDirectOrderCreatePage'

const apiMocks = vi.hoisted(() => ({
  getSupplyOrderOrganizations: vi.fn(),
  getSupplyOrderCreateSuppliers: vi.fn(),
  uploadDirectSupplyOrderFromFile: vi.fn(),
  uploadSupplyOrderUkraineFromSupplierFile: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/supplyUkraineOrdersApi', () => apiMocks)

const organization = { Id: 1, Name: 'Фенікс', Culture: 'uk-UA' }
const supplier = {
  Id: 2,
  FullName: 'Тестовий постачальник',
  ClientAgreements: [{ Id: 3, Agreement: { Id: 4, Name: 'Тестовий договір', Organization: organization } }],
}

function renderPage() {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/all/new']}>
          <SupplyUkraineDirectOrderCreatePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

function field(name: string): HTMLInputElement {
  return screen.getByRole('combobox', { name }) as HTMLInputElement
}

async function choose(name: string, option: string) {
  fireEvent.click(field(name))
  fireEvent.click(await screen.findByRole('option', { name: option }))
}

describe('direct Ukraine order creation defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    apiMocks.getSupplyOrderOrganizations.mockResolvedValue([organization])
    apiMocks.getSupplyOrderCreateSuppliers.mockResolvedValue([supplier])
  })

  it('leaves supplier, organization, and agreement empty after dictionaries load', async () => {
    renderPage()

    await waitFor(() => expect(field('Постачальник').disabled).toBe(false))
    expect(field('Постачальник').value).toBe('')
    expect(field('Організація').value).toBe('')
    expect(field('Договір').value).toBe('')
  })

  it('requires deliberate choices for the organization and agreement after choosing a supplier', async () => {
    renderPage()
    await waitFor(() => expect(field('Постачальник').disabled).toBe(false))

    await choose('Постачальник', 'Тестовий постачальник')
    expect(field('Організація').value).toBe('')
    expect(field('Договір').value).toBe('')

    await choose('Організація', 'Фенікс')
    expect(field('Договір').value).toBe('')

    await choose('Договір', 'Тестовий договір')
    expect(field('Постачальник').value).toBe('Тестовий постачальник')
    expect(field('Організація').value).toBe('Фенікс')
    expect(field('Договір').value).toBe('Тестовий договір')
  })
})
