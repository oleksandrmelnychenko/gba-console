import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
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

describe('Head dashboard unavailable data', () => {
  beforeEach(() => {
    vi.mocked(getEscalated).mockResolvedValue({ is_head: true, count: 0, requested_limit: 100, tasks: [] })
  })

  it('does not claim zero revenue, no escalations or live data before the first successful response', async () => {
    vi.mocked(getHeadTeam).mockRejectedValue(new Error('Team source unavailable'))
    render(<MemoryRouter><MantineProvider theme={theme}><HeadDashboardPage /></MantineProvider></MemoryRouter>)
    expect(screen.queryByText('Результат відділу')).toBeNull()
    expect(screen.queryByText('Ескалацій немає')).toBeNull()
    await screen.findByText('Team source unavailable')
    expect(screen.getByText('Не вдалося оновити')).toBeTruthy()
    expect(screen.queryByText('Результат відділу')).toBeNull()
    expect(screen.queryByText('Менеджерів немає')).toBeNull()
    expect(screen.queryByText('Наживо')).toBeNull()
  })
})
