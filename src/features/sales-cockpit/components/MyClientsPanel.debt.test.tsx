import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCockpitClients } from '../api/salesCockpitApi'
import { clientFixture, clientsPage } from '../clientSegments.testData'
import type { CockpitClient } from '../types'
import { MyClientsPanel } from './MyClientsPanel'

vi.mock('../api/salesCockpitApi', () => ({ getCockpitClients: vi.fn() }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => false }) }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
vi.mock('../../sales-ukraine/components/new-sale-wizard/NewSaleWizard', () => ({ NewSaleWizard: () => null }))
vi.mock('../../sales-offers/useOfferFromRecommendations', () => ({ useOfferFromRecommendations: () => ({}) }))
vi.mock('./ClientRepeatEvidence', () => ({ ClientRepeatEvidence: () => null }))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data }: { columns: { id: string; cell?: (row: CockpitClient) => ReactNode }[]; data: CockpitClient[] }) => (
    <div>
      {data.map((client) => (
        <div data-testid={`overdue-${client.client_id}`} key={client.client_id}>
          {columns.find((column) => column.id === 'overdue')?.cell?.(client)}
        </div>
      ))}
    </div>
  ),
}))

const getClients = vi.mocked(getCockpitClients)

describe('overdue debt column of my clients', () => {
  beforeEach(() => {
    getClients.mockReset()
  })

  it('shows unknown-date debt apart from the overdue amount and states the single rule', async () => {
    getClients.mockResolvedValue(clientsPage({
      count: 2,
      clients: [
        { ...clientFixture(1), overdue_eur: 1200, max_days_past_terms: 400, debt_unknown_date_count: 2, debt_unknown_date_eur: 310 },
        { ...clientFixture(2), overdue_eur: 50, max_days_past_terms: 3 },
      ],
    }))
    render(<MantineProvider env="test"><I18nProvider><MemoryRouter><MyClientsPanel /></MemoryRouter></I18nProvider></MantineProvider>)

    const first = await screen.findByTestId('overdue-1')
    expect(first.textContent).toContain('€1')
    expect(first.textContent).toContain('Дата документа не визначена: 2 · €310')
    const title = first.querySelector('.app-money')?.getAttribute('title') ?? ''
    expect(title).toContain('без обмеження давності')
    expect(title).toContain('за курсом на дату розрахунку')
    expect(title).not.toContain('365')
    expect(title).toContain('Прострочено понад терміни: 400')

    const second = screen.getByTestId('overdue-2')
    expect(second.textContent).not.toContain('Дата документа не визначена')
  })

  it('shows an opening-balance group when the service sends one and nothing when it is empty', async () => {
    getClients.mockResolvedValue(clientsPage({
      count: 2,
      clients: [
        { ...clientFixture(1), overdue_eur: 900, max_days_past_terms: 40, debt_opening_balance_count: 3, debt_opening_balance_eur: 450 } as CockpitClient,
        { ...clientFixture(2), overdue_eur: 50, max_days_past_terms: 3, debt_opening_balance_count: 0, debt_opening_balance_eur: 0 } as CockpitClient,
      ],
    }))
    render(<MantineProvider env="test"><I18nProvider><MemoryRouter><MyClientsPanel /></MemoryRouter></I18nProvider></MantineProvider>)

    const first = await screen.findByTestId('overdue-1')
    expect(first.textContent).toContain('У тому числі ввід залишків: 3 · €450')
    expect(first.textContent).not.toContain('Дата документа не визначена')
    expect(screen.getByTestId('overdue-2').textContent).not.toContain('ввід залишків')
  })
})
