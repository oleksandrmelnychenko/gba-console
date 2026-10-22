import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getCompleteCockpitInbox, getCockpitTarget } from '../api/salesCockpitApi'
import type { CockpitTask } from '../types'
import { SalesCockpitPage } from './SalesCockpitPage'

const mocks = vi.hoisted(() => ({ translate: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.translate }) }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true, isLoading: false }) }))
vi.mock('../hooks/useCockpitRealtimeReload', () => ({ useCockpitRealtimeReload: (reload: () => void) => reload }))
vi.mock('../api/salesCockpitApi', () => ({
  getCompleteCockpitInbox: vi.fn(), getCockpitTarget: vi.fn(), regenerateCockpit: vi.fn(),
  setTaskStatus: vi.fn(), addTaskNote: vi.fn(),
}))
vi.mock('../components/MyClientsPanel', () => ({ MyClientsPanel: () => null }))
vi.mock('../components/MyOffersPanel', () => ({ MyOffersPanel: () => null }))
vi.mock('../components/CockpitDashboardPanel', () => ({ CockpitDashboardPanel: () => null }))
vi.mock('../components/CockpitTaskList', () => ({
  CockpitTaskList: ({ isLoading, tasks }: { isLoading: boolean; tasks: CockpitTask[] }) => <div><div role="status">{isLoading ? 'Loading tasks' : 'Tasks ready'}</div>{tasks.map((task) => <p key={task.task_key}>{task.title}</p>)}</div>,
}))

describe('Sales cockpit workday filters', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompleteCockpitInbox).mockResolvedValue({ count: 0, tasks: [] })
    vi.mocked(getCockpitTarget).mockResolvedValue({
      manager_id: 1, manager_name: null, month: '2026-10', as_of: '2026-10-22',
      working_days: 22, working_days_elapsed: 16,
      source_history_start: '2025-01-01', effective_start: '2026-10-01', history_complete: true,
      shipped: { target: 0, mtd: 0, daily_pace: 0, expected_to_date: 0, gap: 0, today_needed: 0, attainment_pct: 0, pace_status: 'no_target' },
      paid: { target: 0, mtd: 0, daily_pace: 0, expected_to_date: 0, gap: 0, today_needed: 0, attainment_pct: 0, pace_status: 'no_target' },
    })
  })

  it('keeps the queue ready when resetting local filters without a snapshot date', async () => {
    render(<MantineProvider theme={theme}><SalesCockpitPage /></MantineProvider>)
    await screen.findByText('Tasks ready')
    fireEvent.click(screen.getByLabelText(/Сьогодні/))
    fireEvent.click(screen.getByRole('button', { name: 'Скинути фільтри' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Tasks ready'))
  })
  it('finds the critical task beyond the old 50-task cap and the first 200-task page', async () => {
    vi.mocked(getCompleteCockpitInbox).mockResolvedValue({
      count: 201, total: 201,
      tasks: Array.from({ length: 201 }, (_, index) => ({ task_key: `task-${index}`, title: `Work item ${index}`, urgency: index === 200 ? 'critical' : 'normal', task_type: 'reorder_due', status: 'open' })),
    })
    render(<MantineProvider theme={theme}><SalesCockpitPage /></MantineProvider>)
    await screen.findByText('Tasks ready')
    const urgencyInput = screen.getByRole('combobox', { name: 'Терміновість' })
    fireEvent.click(urgencyInput)
    fireEvent.click(screen.getByText('Критично', { selector: '[role="option"] span' }))
    expect(screen.getAllByText('Work item 200')).toHaveLength(2)
    expect(screen.queryByText('Work item 1')).toBeNull()
  })

  it('labels historical plan calculations separately from the current queue', async () => {
    render(<MantineProvider theme={theme}><SalesCockpitPage /></MantineProvider>)
    await screen.findByText('Tasks ready')
    fireEvent.change(screen.getByLabelText('Дата розрахунку плану'), { target: { value: '2026-10-01' } })
    expect(screen.getByText('Черга задач — поточна')).toBeTruthy()
    await waitFor(() => expect(getCockpitTarget).toHaveBeenLastCalledWith('2026-10-01'))
  })

  it('does not overlap queue pagination with the next polling interval', async () => {
    vi.useFakeTimers()
    vi.mocked(getCompleteCockpitInbox).mockReturnValue(new Promise(() => {}))
    const view = render(<MantineProvider theme={theme}><SalesCockpitPage /></MantineProvider>)
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(getCompleteCockpitInbox).toHaveBeenCalledTimes(1)
    view.unmount()
  })

})
