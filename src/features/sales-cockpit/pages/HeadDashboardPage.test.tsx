import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getEscalated, getHeadTeam } from '../api/salesCockpitApi'
import { HeadDashboardPage } from './HeadDashboardPage'

const mocks = vi.hoisted(() => ({ translate: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.translate }) }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true, isLoading: false }) }))
vi.mock('../hooks/useCockpitRealtimeReload', () => ({ useCockpitRealtimeReload: (reload: () => void) => reload }))
vi.mock('../api/salesCockpitApi', () => ({ getEscalated: vi.fn(), getHeadTeam: vi.fn() }))
vi.mock('../components/HeadAiFleetStatus', () => ({ HeadAiFleetStatus: () => null }))
vi.mock('../components/HeadTaskBoard', () => ({ HeadTaskBoard: () => null }))
vi.mock('../components/HeadDashboardChartsPanel', () => ({ HeadDashboardChartsPanel: () => null }))

function teamPayload() {
    const metric = { target: 0, mtd: 0, expected_to_date: 0, attainment_pct: 0, pace_status: 'no_target' as const }
    const tasks = { active: 2, new: 0, in_progress: 0, snoozed: 0, critical: 0, generated_month: 0, done_month: 0, sold_month: 0, dismissed_month: 0, revenue_month: 0, close_rate: 0, conversion_rate: 0 }
    return {
      is_head: true, as_of: '2026-11-13', expected_manager_count: 1, returned_manager_count: 1,
      degraded: true, degraded_reasons: ['unverified_orders'], unverified_orders: 4,
      team: [{ manager_id: 7, manager_name: 'Олена', degraded: true, unverified_orders: 4, target: { shipped: metric, paid: metric }, tasks }],
      totals: { shipped_target: 0, shipped_mtd: 0, paid_target: 0, paid_mtd: 0, generated_month: 0, done_month: 0, sold_month: 0, dismissed_month: 0, revenue_month: 0, close_rate: 0, conversion_rate: 0 },
    }
}

describe('Head dashboard unavailable data', () => {
  beforeEach(() => {
    vi.mocked(getEscalated).mockResolvedValue({ is_head: true, count: 0, requested_limit: 100, tasks: [] })
  })

  it('does not claim zero revenue or live data when the team block fails, and still loads escalations', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(getHeadTeam).mockRejectedValue(new Error('Team source unavailable'))
    render(<MemoryRouter><MantineProvider theme={theme}><HeadDashboardPage /></MantineProvider></MemoryRouter>)
    expect(screen.queryByText('Результат відділу')).toBeNull()
    expect(screen.queryByText('Ескалацій немає')).toBeNull()
    const block = await screen.findByTestId('head-team-error')
    expect(block.textContent).toContain('Не вдалося завантажити показники команди. Спробуйте пізніше.')
    expect(block.querySelector('details')?.open).toBe(false)
    expect(block.querySelector('details')?.textContent).toContain('Team source unavailable')
    expect(within(block).getByRole('button', { name: 'Повторити' })).toBeTruthy()
    expect(screen.getByText('Не вдалося оновити')).toBeTruthy()
    expect(screen.getByText('Ескалацій немає')).toBeTruthy()
    expect(screen.queryByText('Результат відділу')).toBeNull()
    expect(screen.queryByText('Менеджерів немає')).toBeNull()
    expect(screen.queryByText('Наживо')).toBeNull()
  })

  it('keeps the team block when only escalations fail and retries on demand', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(getHeadTeam).mockResolvedValue(teamPayload() as never)
    vi.mocked(getEscalated).mockRejectedValueOnce(new Error('CheNbaApi: Escalated response contains an invalid, duplicate, or non-escalated task'))
    render(<MemoryRouter><MantineProvider theme={theme}><HeadDashboardPage /></MantineProvider></MemoryRouter>)
    const block = await screen.findByTestId('head-escalated-error')
    expect(within(block).getByText('Не вдалося завантажити ескальовані задачі. Спробуйте пізніше.')).toBeTruthy()
    expect(screen.getByText('Результат відділу')).toBeTruthy()
    expect(screen.queryByTestId('head-team-error')).toBeNull()
    fireEvent.click(within(block).getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByText('Ескалацій немає')).toBeTruthy()
    expect(screen.queryByTestId('head-escalated-error')).toBeNull()
  })

  it('shows the degraded marker of the team and of a manager', async () => {
    vi.mocked(getHeadTeam).mockResolvedValue(teamPayload() as never)
    render(<MemoryRouter><MantineProvider theme={theme}><HeadDashboardPage /></MantineProvider></MemoryRouter>)

    expect((await screen.findByTestId('head-team-degraded')).textContent)
      .toBe('Неповні дані: накладні без підтвердженої дати не враховано — 4')
    expect(screen.getByText('неповні дані: 4')).toBeTruthy()
  })
})
