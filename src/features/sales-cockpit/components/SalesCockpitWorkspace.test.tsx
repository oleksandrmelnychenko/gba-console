import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.mocked(getDashboard).mockReset()
  })

  it('shows a compact actionable empty state for the task queue', () => {
    renderWithTheme(
      <CockpitTaskList
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
