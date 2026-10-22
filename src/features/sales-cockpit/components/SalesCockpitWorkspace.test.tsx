import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getDashboard } from '../api/salesCockpitApi'
import type { CockpitDashboard } from '../types'
import { CockpitDashboardPanel } from './CockpitDashboardPanel'
import { CockpitTaskList } from './CockpitTaskList'

const mocks = vi.hoisted(() => ({
  translate: (key: string) => key,
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.translate }),
}))

vi.mock('../api/salesCockpitApi', () => ({
  getDashboard: vi.fn(),
}))

vi.mock('../../../shared/ui/charts/AgingBars', () => ({
  AgingBars: () => <div data-testid="aging-chart" />,
}))

vi.mock('../../../shared/ui/charts/TaskTypeDonut', () => ({
  TaskTypeDonut: () => <div data-testid="task-type-chart" />,
}))

vi.mock('../../../shared/ui/charts/UrgencyDonut', () => ({
  UrgencyDonut: () => <div data-testid="urgency-chart" />,
}))

describe('Sales cockpit workspace', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.mocked(getDashboard).mockReset()
  })

  it('shows a compact actionable empty state for the task queue', () => {
    renderWithTheme(
      <CockpitTaskList
        canAddNote
        canComplete
        canDismiss
        canSnooze
        canTakeInProgress
        isLoading={false}
        pendingTaskKey={null}
        tasks={[]}
        onAddNote={vi.fn()}
        onDismiss={vi.fn()}
        onDone={vi.fn()}
        onSnooze={vi.fn()}
        onTakeInProgress={vi.fn()}
      />,
    )

    expect(screen.getByText('Поточні завдання')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Активних завдань немає')
    expect(screen.getByRole('status').textContent).toContain(
      'Змініть фільтри або згенеруйте нову AI-чергу',
    )
  })

  it('does not render a duplicate analytics section for an empty dashboard', async () => {
    vi.mocked(getDashboard).mockResolvedValue(dashboard())

    renderWithTheme(<CockpitDashboardPanel reloadKey={0} />)

    expect(screen.getByTestId('urgency-chart')).not.toBeNull()
    await waitFor(() => expect(screen.queryByTestId('urgency-chart')).toBeNull())

    expect(screen.queryByText('Дашборд завдань')).toBeNull()
    expect(screen.queryByTestId('urgency-chart')).toBeNull()
    expect(screen.queryByTestId('task-type-chart')).toBeNull()
    expect(screen.queryByTestId('aging-chart')).toBeNull()
  })

  it('refreshes task analytics on polling and after a task mutation', async () => {
    vi.useFakeTimers()
    vi.mocked(getDashboard).mockResolvedValue(dashboard({ value_at_risk_eur: 500 }))
    const view = renderWithTheme(<CockpitDashboardPanel reloadKey={0} />)
    await act(async () => {})
    expect(getDashboard).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(getDashboard).toHaveBeenCalledTimes(2)

    view.rerender(<MantineProvider theme={theme}><CockpitDashboardPanel reloadKey={1} /></MantineProvider>)
    await act(async () => {})
    expect(getDashboard).toHaveBeenCalledTimes(3)
    view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(getDashboard).toHaveBeenCalledTimes(3)
  })

  it('renders all analytics when the dashboard has useful data', async () => {
    vi.mocked(getDashboard).mockResolvedValue(
      dashboard({
        debt_aging: [{ amount_eur: 500, bucket: '0-30', count: 2 }],
        urgency_mix: [{ count: 2, urgency: 'critical' }],
      }),
    )

    renderWithTheme(<CockpitDashboardPanel reloadKey={0} />)

    expect(await screen.findByTestId('urgency-chart')).not.toBeNull()
    expect(screen.getByTestId('task-type-chart')).not.toBeNull()
    expect(screen.getByTestId('aging-chart')).not.toBeNull()
  })

  it('keeps unknown payment terms separate even when there is no known overdue debt', async () => {
    vi.mocked(getDashboard).mockResolvedValue(dashboard({ debt_unknown_terms_count: 2, debt_unknown_terms_eur: 125.5 }))
    renderWithTheme(<CockpitDashboardPanel reloadKey={0} />)
    expect(await screen.findByText(/Термін оплати не визначено/)).toBeTruthy()
    expect(screen.getByText(/Ці документи показано окремо від відомого простроченого боргу/)).toBeTruthy()
  })
})

function renderWithTheme(node: React.ReactNode) {
  return render(<MantineProvider theme={theme}>{node}</MantineProvider>)
}

function dashboard(overrides: Partial<CockpitDashboard> = {}): CockpitDashboard {
  return {
    as_of: '2026-07-24',
    source_history_start: '2025-01-01',
    effective_start: '2025-07-24',
    history_complete: true,
    completed_vs_open: [],
    debt_aging: [],
    manager_id: 1,
    task_type_mix: [],
    urgency_mix: [],
    value_at_risk_eur: 0,
    ...overrides,
  }
}
