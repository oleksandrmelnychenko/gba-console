import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { AI_FLEET_SERVICES } from '../api/aiFleetApi'
import type { AiFleetServiceStatus } from '../types'
import { buildAiFleetObservation } from '../utils/aiFleetObservations'
import {
  buildAiFleetAnalytics,
  buildAiFleetServiceViews,
} from '../utils/aiFleetView'
import { AiFleetAnalyticsDashboard } from './AiFleetAnalyticsDashboard'

const chartMocks = vi.hoisted(() => ({
  areaChart: vi.fn(),
}))

vi.mock('@mantine/charts', () => ({
  AreaChart: (props: { data: unknown[] }) => {
    chartMocks.areaChart(props)

    return <div data-testid="ai-fleet-session-area-chart">{props.data.length} points</div>
  },
}))

const NOW_MS = new Date('2026-07-10T12:00:00.000Z').getTime()
const FRESH_FINISHED_AT = '2026-07-10T05:20:00.000Z'

const statuses: AiFleetServiceStatus[] = [
  healthyStatus('products'),
  healthyStatus('forecast'),
  {
    health: { message: '503', state: 'down' },
    serviceId: 'nba',
    warmup: {
      lastFinishedAtUtc: FRESH_FINISHED_AT,
      message: 'failed',
      state: 'down',
    },
  },
  {
    health: { state: 'healthy' },
    serviceId: 'procurement',
    warmup: {
      lastFinishedAtUtc: '2026-07-08T05:00:00.000Z',
      state: 'healthy',
    },
  },
  {
    health: { state: 'unknown' },
    serviceId: 'solvency',
    warmup: { state: 'unknown' },
  },
  healthyStatus('recommendations'),
  healthyStatus('pricing'),
]

function healthyStatus(serviceId: string): AiFleetServiceStatus {
  return {
    health: { state: 'healthy' },
    serviceId,
    warmup: {
      lastFinishedAtUtc: FRESH_FINISHED_AT,
      state: 'healthy',
    },
  }
}

function buildAnalytics() {
  const rows = buildAiFleetServiceViews(AI_FLEET_SERVICES, statuses, NOW_MS)

  return buildAiFleetAnalytics(rows, {
    lastFinishedAtUtc: FRESH_FINISHED_AT,
    lastStartedAtUtc: '2026-07-10T05:00:00.000Z',
    state: 'healthy',
  }, NOW_MS)
}

function renderDashboard(history = [buildAiFleetObservation(buildAnalytics(), NOW_MS)]) {
  return render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <AiFleetAnalyticsDashboard
          analytics={buildAnalytics()}
          history={history}
          isLoading={false}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  chartMocks.areaChart.mockReset()
})

describe('AiFleetAnalyticsDashboard', () => {
  it('presents a truthful accessible snapshot, service matrix, and operation thresholds', () => {
    renderDashboard()

    expect(screen.getByLabelText('Пройдено перевірок: 9 з 14')).toBeTruthy()
    expect(screen.getByText('9/14 перевірок пройдено')).toBeTruthy()
    expect(screen.getByRole('img', {
      name: 'Доступність API. OK: 5, Down: 1, Немає даних: 1',
    })).toBeTruthy()
    expect(screen.getByRole('img', {
      name: '05:00 warmup. Свіжий: 4, Застаріло: 1, Down: 1, Немає даних: 1',
    })).toBeTruthy()

    const matrix = screen.getByRole('table', {
      name: 'Стан API, 05:00 warmup, свіжість та кількість пройдених перевірок для кожного AI-сервісу',
    })
    expect(within(matrix).getAllByRole('row')).toHaveLength(8)

    const downRow = within(matrix).getByRole('row', { name: /gba-nba/ })
    expect(within(downRow).getAllByText('Down')).toHaveLength(2)
    expect(within(downRow).getByText('0/2')).toBeTruthy()

    const staleRow = within(matrix).getByRole('row', { name: /gba-procure/ })
    expect(within(staleRow).getByText('Застаріло')).toBeTruthy()
    expect(within(staleRow).getByText('1/2')).toBeTruthy()

    const unknownRow = within(matrix).getByRole('row', { name: /gba-solvency/ })
    expect(within(unknownRow).getAllByText('Немає даних')).toHaveLength(2)
    expect(within(unknownRow).getByText('Немає часу')).toBeTruthy()
    expect(within(unknownRow).getByText('0/2')).toBeTruthy()

    expect(screen.getByRole('img', {
      name: 'Тривалість останньої 05:00 задачі: 20 хв. ліміт 30 хв. У межах.',
    })).toBeTruthy()
    expect(screen.getByRole('img', {
      name: 'Вік останнього фінішу: 6,7 год. ліміт 30 год. У межах.',
    })).toBeTruthy()

    expect(screen.getByText('Збираємо live-історію')).toBeTruthy()
    expect(screen.getByText('1/2 знімків. Графік зʼявиться після наступного успішного оновлення.')).toBeTruthy()
    expect(screen.queryByTestId('ai-fleet-session-area-chart')).toBeNull()
    expect(chartMocks.areaChart).not.toHaveBeenCalled()
  })

  it('renders an accessible session trend after two successful observations', () => {
    const analytics = buildAnalytics()
    const history = [
      buildAiFleetObservation(analytics, NOW_MS - 60_000),
      buildAiFleetObservation(analytics, NOW_MS),
    ]

    renderDashboard(history)

    expect(screen.getByRole('img', {
      name: 'Динаміка перевірок у цій вкладці. Останнє спостереження: 9 OK, 1 застаріло, 2 Down, 2 без даних.',
    })).toBeTruthy()
    expect(screen.getByTestId('ai-fleet-session-area-chart').textContent).toBe('2 points')
    expect(chartMocks.areaChart).toHaveBeenCalledTimes(1)
    expect(chartMocks.areaChart).toHaveBeenCalledWith(expect.objectContaining({
      connectNulls: false,
      type: 'stacked',
      withGradient: false,
    }))
  })
})
