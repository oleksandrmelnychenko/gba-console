import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getContacts, getContactHistory } from '../api/contactsApi'
import { getCompleteCockpitInbox, getCockpitTarget, regenerateCockpit, setTaskStatus } from '../api/salesCockpitApi'
import { getWorkday, getWorkdayTasks } from '../api/workdayApi'
import queueFixture from '../api/__fixtures__/workday-queue.json'
import activeFixture from '../api/__fixtures__/workday-tasks-active.json'
import historyFixture from '../api/__fixtures__/workday-tasks-history.json'
import type { WorkdayPage, WorkdayTasksPage } from '../workdayTypes'
import { SalesCockpitPage } from './SalesCockpitPage'

const mocks = vi.hoisted(() => ({ translate: (key: string) => key, can: (key: string) => Boolean(key) }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.translate }) }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }))
vi.mock('../hooks/useCockpitRealtimeReload', () => ({ useCockpitRealtimeReload: (reload: () => void) => reload }))
vi.mock('../api/salesCockpitApi', () => ({ getCompleteCockpitInbox: vi.fn(), getCockpitTarget: vi.fn(), regenerateCockpit: vi.fn(), setTaskStatus: vi.fn(), addTaskNote: vi.fn() }))
vi.mock('../api/workdayApi', () => ({ getWorkday: vi.fn(), getWorkdayTasks: vi.fn() }))
vi.mock('../api/contactsApi', () => ({ getContacts: vi.fn(), getContactHistory: vi.fn(), recordContact: vi.fn() }))
vi.mock('../components/MyClientsPanel', () => ({ MyClientsPanel: ({ onTasks }: { onTasks: (client: { client_id: number; client_name: string }) => void }) => <button onClick={() => onTasks({ client_id: 1, client_name: 'Клієнт без активних задач' })}>Завдання та історія</button> }))
vi.mock('../components/MyOffersPanel', () => ({ MyOffersPanel: () => null }))
vi.mock('../components/CockpitDashboardPanel', () => ({ CockpitDashboardPanel: () => null }))
const queue = queueFixture as WorkdayPage
const active = activeFixture as WorkdayTasksPage
const history = historyFixture as WorkdayTasksPage
function renderPage() { return render(<MantineProvider theme={theme}><SalesCockpitPage /></MantineProvider>) }

describe('Sales cockpit server workday queue', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can = () => true
    vi.mocked(getWorkday).mockImplementation(async (bucket, search, offset) => ({ ...queue, bucket, search, offset }))
    vi.mocked(getWorkdayTasks).mockImplementation(async (_key, scope) => scope === 'active' ? active : history)
    vi.mocked(getContactHistory).mockResolvedValue({ manager_id: 1, manager_net_uid: 'manager', client_id: 1, offset: 0, limit: 20, count: 0, total: 0, events: [] })
    vi.mocked(getCockpitTarget).mockResolvedValue({
      manager_id: 1, manager_name: null, month: '2026-10', as_of: '2026-10-22', working_days: 22, working_days_elapsed: 16,
      source_history_start: '2025-01-01', effective_start: '2026-10-01', history_complete: true,
      shipped: { target: 0, mtd: 0, daily_pace: 0, expected_to_date: 0, gap: 0, today_needed: 0, attainment_pct: 0, pace_status: 'no_target' },
      paid: { target: 0, mtd: 0, daily_pace: 0, expected_to_date: 0, gap: 0, today_needed: 0, attainment_pct: 0, pace_status: 'no_target' },
    })
  })
  it('shows one card per client with grouped task counts, prior contact author and contact-only work', async () => {
    renderPage()
    expect(await screen.findByText('Клієнт 1')).toBeTruthy()
    expect(screen.getAllByText('Клієнт 1')).toHaveLength(1)
    expect(screen.getByText(/Активних задач: 2/)).toBeTruthy()
    expect(screen.getAllByText(/Останній контакт:.*Автор/)[0]).toBeTruthy()
    expect(screen.getByText('Клієнт 2')).toBeTruthy()
    expect(getCompleteCockpitInbox).not.toHaveBeenCalled()
    expect(getWorkday).toHaveBeenCalledTimes(1)
  })
  it('uses full server counts and reaches client 201 without fetching earlier pages', async () => {
    vi.mocked(getWorkday).mockImplementation(async (bucket, search, offset) => ({
      ...queue, bucket, search, offset, count: offset === 200 ? 1 : 20, total: 201,
      counts: { all: 201, today: 201, overdue: 0, upcoming: 0, in_progress: 0, unscheduled: 0 },
      rows: Array.from({ length: offset === 200 ? 1 : 20 }, (_, index) => ({ ...queue.rows[0], key: `client:${offset + index + 1}`, client_id: offset + index + 1, client_name: `Work client ${offset + index + 1}` })),
    }))
    renderPage()
    await screen.findByText('Work client 1')
    expect(screen.getByRole('button', { name: 'Сьогодні (201)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '11' }))
    expect(await screen.findByText('Work client 201')).toBeTruthy()
    expect(getWorkday).toHaveBeenCalledTimes(2)
    expect(getWorkday).toHaveBeenLastCalledWith('all', '', 200, expect.any(AbortSignal))
    expect(screen.queryByText('Work client 1')).toBeNull()
  })
  it('sends filter/search to server and resetting does not leave queue loading', async () => {
    renderPage()
    await screen.findByText('Клієнт 1')
    fireEvent.change(screen.getByLabelText('Пошук у робочій черзі'), { target: { value: ' A.*[ ' } })
    await waitFor(() => expect(getWorkday).toHaveBeenLastCalledWith('all', 'A.*[', 0, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: /^Сьогодні/ }))
    await waitFor(() => expect(getWorkday).toHaveBeenLastCalledWith('today', 'A.*[', 0, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: 'Скинути фільтри черги' }))
    await waitFor(() => expect(getWorkday).toHaveBeenLastCalledWith('all', '', 0, expect.any(AbortSignal)))
    expect(await screen.findByText('Клієнт 1')).toBeTruthy()
    expect(screen.queryByLabelText('Завантаження робочої черги')).toBeNull()
  })
  it('keeps workday usable when KPI fails and historical date affects only plan, not task generation', async () => {
    vi.mocked(getCockpitTarget).mockRejectedValue(new Error('Target unavailable'))
    renderPage()
    await screen.findByText('Target unavailable')
    expect(screen.getByText('Клієнт 1')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Дата розрахунку плану'), { target: { value: '2026-10-01' } })
    expect(screen.getByTitle('Черга задач — поточна')).toBeTruthy()
    await waitFor(() => expect(getCockpitTarget).toHaveBeenLastCalledWith('2026-10-01'))
    expect(getWorkday).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Згенерувати завдання' }))
    await waitFor(() => expect(regenerateCockpit).toHaveBeenCalledWith())
  })
  it('opens commitments independently of failed workday or target', async () => {
    vi.mocked(getWorkday).mockRejectedValue(new Error('Queue unavailable'))
    vi.mocked(getCockpitTarget).mockRejectedValue(new Error('Target unavailable'))
    vi.mocked(getContacts).mockResolvedValue({ manager_id: 1, manager_net_uid: 'manager', as_of: '2026-10-22', timezone: 'Europe/Kyiv', bucket: 'today', search: '', offset: 0, limit: 20, count: 0, total: 0, counts: { all: 0, today: 0, overdue: 0, upcoming: 0, unscheduled: 0 }, contacts: [] })
    renderPage()
    await screen.findByText('Queue unavailable')
    fireEvent.click(screen.getByRole('tab', { name: 'Контакти та домовленості' }))
    expect(await screen.findByText('Контактів за цими умовами немає')).toBeTruthy()
  })
  it('keeps closed task history accessible from My Clients after the last active task disappears', async () => {
    vi.mocked(getWorkday).mockResolvedValue({ ...queue, total: 0, count: 0, rows: [], counts: { all: 0, overdue: 0, today: 0, in_progress: 0, upcoming: 0, unscheduled: 0 } })
    vi.mocked(getWorkdayTasks).mockImplementation(async (_key, scope) => scope === 'active' ? { ...active, total: 0, count: 0, tasks: [] } : history)
    renderPage()
    await screen.findByText(/За цими умовами роботи немає/)
    fireEvent.click(screen.getByRole('tab', { name: 'Мої клієнти' }))
    fireEvent.click(screen.getByRole('button', { name: 'Завдання та історія' }))
    await screen.findByText('Активних завдань немає')
    fireEvent.click(screen.getByRole('button', { name: 'Історія завдань' }))
    expect(await screen.findByText('Завдань: 1')).toBeTruthy()
    expect(getWorkdayTasks).toHaveBeenLastCalledWith('client:1', 'history', 0, expect.any(AbortSignal))
  })
  it('does not overlap polling requests', async () => {
    vi.useFakeTimers()
    vi.mocked(getWorkday).mockReturnValue(new Promise(() => {}))
    const view = renderPage()
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(getWorkday).toHaveBeenCalledTimes(1)
    view.unmount()
  })
  it('opens all client tasks, preserves action keys, refreshes after mutation, and offers read-only closed history', async () => {
    renderPage()
    await screen.findByText('Клієнт 1')
    fireEvent.click(screen.getAllByRole('button', { name: 'Завдання та історія' })[0])
    await screen.findByText('Завдань: 2')
    fireEvent.click(screen.getAllByRole('button', { name: 'Взяти в роботу' })[0])
    await waitFor(() => expect(setTaskStatus).toHaveBeenCalledWith(active.tasks[0].task_key, { To: 'in_progress' }))
    await waitFor(() => expect(vi.mocked(getWorkdayTasks).mock.calls.length).toBeGreaterThan(1))
    fireEvent.click(screen.getByRole('button', { name: 'Історія завдань' }))
    await screen.findByText('Завдань: 1')
    expect(screen.queryByRole('button', { name: 'Взяти в роботу' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Виконано' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Нотатка' })).toBeNull()
    expect(screen.getByText(/Продаж зі слів менеджера/)).toBeTruthy()
  })
  it('places a nested note editor above task details and closes only that editor', async () => {
    renderPage()
    await screen.findByText('Клієнт 1')
    fireEvent.click(screen.getAllByRole('button', { name: 'Завдання та історія' })[0])
    await screen.findByText('Завдань: 2')
    const detail = screen.getByRole('dialog', { name: 'Завдання клієнта: Клієнт 1' })
    fireEvent.click(within(detail).getAllByRole('button', { name: 'Нотатка' })[0])
    const note = screen.getByRole('dialog', { name: 'Додати нотатку' })
    const detailLayer = Number(getComputedStyle(detail.closest('.mantine-Modal-root')!).getPropertyValue('--mb-z-index'))
    const noteLayer = Number(getComputedStyle(note.closest('.mantine-Modal-root')!).getPropertyValue('--mb-z-index'))
    expect(noteLayer).toBeGreaterThan(detailLayer)
    fireEvent.change(within(note).getByRole('textbox', { name: 'Нотатка' }), { target: { value: 'Draft stays in the foreground' } })
    expect((within(note).getByRole('textbox', { name: 'Нотатка' }) as HTMLTextAreaElement).value).toBe('Draft stays in the foreground')
    fireEvent.click(within(note).getByRole('button', { name: 'Скасувати' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати нотатку' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Завдання клієнта: Клієнт 1' })).toBeTruthy()
    expect(setTaskStatus).not.toHaveBeenCalled()
  })
  it('keeps task actions and contact recording behind independent permissions', async () => {
    mocks.can = (key) => key.endsWith('.view')
    renderPage()
    await screen.findByText('Клієнт 1')
    expect(screen.queryByRole('button', { name: 'Записати контакт та історія' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Історія контактів' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Завдання та історія' })[0])
    await screen.findByText('Завдань: 2')
    expect(screen.queryByRole('button', { name: 'Взяти в роботу' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Виконано' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Записати контакт' })).toBeNull()
  })
})
