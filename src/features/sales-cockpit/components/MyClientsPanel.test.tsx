import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCockpitClients } from '../api/salesCockpitApi'
import { clientFixture, clientsPage } from '../clientSegments.testData'
import type { CockpitClient } from '../types'
import { MyClientsPanel } from './MyClientsPanel'
import { ClientRepeatEvidence } from './ClientRepeatEvidence'

vi.mock('../api/salesCockpitApi', () => ({ getCockpitClients: vi.fn() }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => false }) }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
vi.mock('../../sales-ukraine/components/new-sale-wizard/NewSaleWizard', () => ({ NewSaleWizard: () => null }))
vi.mock('../../sales-offers/useOfferFromRecommendations', () => ({ useOfferFromRecommendations: () => ({}) }))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, emptyText }: { data: CockpitClient[]; emptyText: string }) => <div data-testid="clients-table">{data.length ? data.map((c) => <div key={c.client_id}>{c.name}</div>) : emptyText}</div>,
}))
const getClients = vi.mocked(getCockpitClients)
function show(revision = 0) {
  return render(<MantineProvider env="test"><I18nProvider><MemoryRouter><MyClientsPanel revision={revision} /></MemoryRouter></I18nProvider></MantineProvider>)
}

describe('full-population client segments', () => {
  beforeEach(() => {
    getClients.mockReset()
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('shows server totals and requests the second page instead of slicing local clients', async () => {
    getClients.mockImplementation(async (query) => clientsPage({
      count: query?.offset ? 1 : 50, total: 51, population_count: 51, offset: query?.offset ?? 0,
      segment_counts: { all: 51, reorder_due: 0, reorder_overdue: 51, reactivation: 0, new_client: 0 },
      clients: query?.offset ? [clientFixture(51)] : Array.from({ length: 50 }, (_, i) => clientFixture(i + 1)),
    }))
    show()
    await screen.findByText('Клієнт 1')
    expect(screen.getByText(/У вибраному сегменті: 51/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await screen.findByText('Клієнт 51')
    expect(getClients).toHaveBeenLastCalledWith({ segment: 'all', search: '', offset: 50, limit: 50 })
    expect(screen.queryByText('Клієнт 1')).toBeNull()
  })

  it('sends segment and debounced search to the server and refreshes after a contact revision', async () => {
    getClients.mockImplementation(async (query) => clientsPage({ segment: query?.segment ?? 'all', search: query?.search ?? '' }))
    const view = show()
    await screen.findByText('Клієнт 1')
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Сегмент клієнтів' }))
    await user.click(await screen.findByRole('option', { name: 'Прострочена повторна покупка (1)' }))
    await waitFor(() => expect(getClients).toHaveBeenLastCalledWith({ segment: 'reorder_overdue', search: '', offset: 0, limit: 50 }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук клієнта' }), { target: { value: 'Клієнт' } })
    await waitFor(() => expect(getClients).toHaveBeenLastCalledWith({ segment: 'reorder_overdue', search: 'Клієнт', offset: 0, limit: 50 }))
    const before = getClients.mock.calls.length
    view.rerender(<MantineProvider env="test"><I18nProvider><MemoryRouter><MyClientsPanel revision={1} /></MemoryRouter></I18nProvider></MantineProvider>)
    await waitFor(() => expect(getClients).toHaveBeenCalledTimes(before + 1))
  })

  it('does not leave previous rows or counts visible after a source failure', async () => {
    getClients.mockResolvedValueOnce(clientsPage()).mockRejectedValueOnce(new Error('Source unavailable'))
    show()
    await screen.findByText('Клієнт 1')
    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
    await screen.findByText('Source unavailable')
    expect(screen.queryByText('Клієнт 1')).toBeNull()
    expect(screen.queryByText(/У вибраному сегменті:/)).toBeNull()
  })

  it('returns to the remaining page when a contact removes the final segmented client', async () => {
    let total = 51
    getClients.mockImplementation(async (query) => {
      const offset = query?.offset ?? 0
      const count = Math.min(50, Math.max(0, total - offset))
      return clientsPage({ count, total, population_count: total, offset,
        segment_counts: { all: total, reorder_due: 0, reorder_overdue: total, reactivation: 0, new_client: 0 },
        clients: Array.from({ length: count }, (_, i) => clientFixture(offset + i + 1)) })
    })
    const view = show()
    await screen.findByText('Клієнт 1')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await screen.findByText('Клієнт 51')
    total = 50
    view.rerender(<MantineProvider env="test"><I18nProvider><MemoryRouter><MyClientsPanel revision={1} /></MemoryRouter></I18nProvider></MantineProvider>)
    await screen.findByText('Клієнт 1')
    expect(getClients).toHaveBeenLastCalledWith({ segment: 'all', search: '', offset: 0, limit: 50 })
    expect(screen.queryByText('Клієнт 51')).toBeNull()
  })

  it('shows documentary cycle, partial history, out-of-stock and contact cooldown separately', () => {
    const client = clientFixture()
    client.contact_cooldown = { active: true, reason: 'scheduled_contact', event_id: 'event', contacted_at: '2026-10-22T09:00:00Z', next_contact_at: '2026-10-24T10:00:00Z', next_action: 'Обговорити поставку' }
    client.segments = []
    render(<MantineProvider env="test"><I18nProvider><ClientRepeatEvidence client={client} /></I18nProvider></MantineProvider>)
    expect(screen.getByText(/Історія неповна:/)).toBeTruthy()
    expect(screen.getByText(/Наступний контакт заплановано:/)).toBeTruthy()
    expect(screen.getByText('Обговорити поставку')).toBeTruthy()
    expect(screen.getByText('Немає в наявності')).toBeTruthy()
    expect(screen.getByText('30 дн')).toBeTruthy()
    expect(screen.getByText(/Очікувана дата:/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
