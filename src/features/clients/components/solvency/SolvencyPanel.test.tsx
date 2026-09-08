import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { SolvencyCharts, SolvencyScore } from '../../solvencyTypes'

const getClientSolvencyScore = vi.fn()
const getClientSolvencyCharts = vi.fn()

vi.mock('../../api/clientSolvencyApi', () => ({
  getClientSolvencyScore: (...args: unknown[]) => getClientSolvencyScore(...args),
  getClientSolvencyCharts: (...args: unknown[]) => getClientSolvencyCharts(...args),
}))

import { SolvencyPanel } from './SolvencyPanel'

function renderPanel(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider theme={theme}>
        <I18nProvider>{children}</I18nProvider>
      </MantineProvider>
    ),
  })
}

const notApplicableScore: SolvencyScore = {
  client_id: 7,
  client_net_uid: null,
  applicable: false,
  score: null,
  rating: null,
  risk_90d: null,
  forward_risk_status: 'not_applicable',
  forward_risk_reason: 'client has no buyer role',
  sub_factors: null,
  caps_applied: [],
  debt_load_source: 'debt_table',
  raw_score: null,
  currency_breakdown: null,
  source_history_start: '2025-01-01',
  effective_start: '2025-01-01',
  history_complete: false,
  as_of_date: '2025-01-01',
  state_basis: 'current_observation',
  business_timezone: 'Europe/Kyiv',
  fx_date: '2025-01-01',
  window_months: 12,
  model_version: 'v1',
}

const v3Score: SolvencyScore = {
  client_id: 411780,
  client_net_uid: '11111111-1111-1111-1111-111111111111',
  applicable: true,
  score: 46,
  rating: 'D',
  pd: 0.649,
  contributions: [
    { feature: 'n_open_debt_lines', value: 3, points: 3.77 },
    { feature: 'months_with_debt_last12', value: 12, points: 1.02 },
    { feature: 'turnover_eur_12mo', value: 90000, points: -2.4 },
    { feature: 'overdue_eur_180plus', value: 0, points: 0 },
  ],
  risk_90d: {
    horizon_days: 90,
    threshold_days: 90,
    band: 'critical',
    exposure_eur: 12345.67,
    reason_code: 'already_90_plus',
  },
  forward_risk: null,
  forward_risk_status: 'not_applicable',
  forward_risk_reason: 'replaced_by_operational_90d',
  sub_factors: null,
  caps_applied: [],
  debt_load_source: null,
  raw_score: null,
  currency_breakdown: null,
  source_history_start: '2025-01-01',
  effective_start: '2025-06-25',
  history_complete: true,
  as_of_date: '2026-06-25',
  state_basis: 'current_observation',
  business_timezone: 'Europe/Kyiv',
  fx_date: '2026-06-25',
  window_months: 12,
  model_version: 'creditscore-v3',
}

afterEach(() => {
  getClientSolvencyScore.mockReset()
  getClientSolvencyCharts.mockReset()
})

describe('SolvencyPanel', () => {
  it('renders the not-a-buyer N/A state and no charts when applicable is false', async () => {
    getClientSolvencyScore.mockResolvedValue(notApplicableScore)
    getClientSolvencyCharts.mockResolvedValue(null)

    const { findByText, container } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    expect(await findByText(/не покупець/i)).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelector('.mantine-RingProgress-root')).toBeNull()
    })
    expect(getClientSolvencyCharts).not.toHaveBeenCalled()
  })

  it('renders the v3 score, contributions and exact 90-day debt control', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText, queryByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    // does NOT fall into the not-a-buyer N/A state
    expect(queryByText(/не покупець/i)).toBeNull()
    // score gauge value, band, a contribution label and the operational debt control are present
    expect(await findByText('46')).toBeTruthy()
    expect(await findByText(/Відкритих боргових позицій/i)).toBeTruthy()
    expect(await findByText(/критичний/i)).toBeTruthy()
    expect(await findByText(/Борг уже прострочений понад 90 днів/i)).toBeTruthy()
    expect(await findByText(/12.*345,67 EUR/i)).toBeTruthy()
    // Current-state PD remains; the retired forward PD is no longer shown.
    expect(await findByText(/PD 64\.9%/)).toBeTruthy()
    expect(queryByText(/99\.7%/)).toBeNull()
  })

  it('shows source-bounded insufficient data and does not request charts', async () => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      score: null,
      rating: null,
      pd: null,
      contributions: null,
      risk_90d: null,
      forward_risk: null,
      forward_risk_status: 'not_applicable',
      forward_risk_reason: 'no available evidence',
      data_sufficiency: 'insufficient',
      data_sufficiency_reason: 'no available evidence',
    })

    const { findByText, queryByText } = renderPanel(
      <SolvencyPanel clientNetId="abc" />,
    )

    expect(await findByText(/Недостатньо даних для оцінки/i)).toBeTruthy()
    expect(await findByText(/01\.01\.2025/)).toBeTruthy()
    expect(queryByText('46')).toBeNull()
    expect(getClientSolvencyCharts).not.toHaveBeenCalled()
  })

  it('shows a clear fallback while 90-day control is not calculated', async () => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      risk_90d: null,
    })
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    expect(await findByText(/контроль ще не розрахований/i)).toBeTruthy()
  })

  it('color-codes risk-increasing vs risk-reducing contributions by sign and drops zero-point ones', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText, queryByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    // risk-reducing (negative points) renders as a signed value without a leading '+'
    const reducing = await findByText('-2.4')
    expect(reducing).toBeTruthy()
    // risk-increasing (positive points) keeps the leading '+'
    expect(await findByText('+3.8')).toBeTruthy()
    // zero-point contribution is filtered out of the drivers list
    expect(queryByText(/Прострочено 180\+ днів/i)).toBeNull()
  })
})


describe('current-state display', () => {
  const explanation = 'Історію оцінки не збережено. Поточні борги та умови договорів не відновлюють стан минулих місяців.'
  const currentCharts: SolvencyCharts = {
    client_id: v3Score.client_id,
    applicable: true,
    state_basis: 'current_observation',
    business_timezone: 'Europe/Kyiv',
    as_of_date: v3Score.as_of_date,
    fx_date: v3Score.fx_date,
    window_months: 12,
    source_history_start: v3Score.source_history_start,
    effective_start: v3Score.effective_start,
    history_complete: true,
    model_version: v3Score.model_version,
    limit_utilization_gauge: { value: 0, threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization' },
    payment_discipline_donut: [],
    open_invoice_aging_bars: [],
    turnover_vs_exposure: [],
    turnover_trend: [],
    score_sparkline: [],
    score_sparkline_status: 'unavailable',
    score_sparkline_reason_code: 'historical_state_not_recorded',
    score_sparkline_reason: explanation,
    aging_over_time_heatmap: 'pending',
  }

  it.each([0, 46])('shows true score %i, captured date and the explicit history reason without a sparkline', async (value) => {
    getClientSolvencyScore.mockResolvedValue({ ...v3Score, score: value })
    getClientSolvencyCharts.mockResolvedValue(currentCharts)
    const { findByText, container } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText(String(value))).toBeTruthy()
    expect(await findByText(explanation)).toBeTruthy()
    expect(await findByText(/Оцінка за поточними записами станом на 25.06.2026/)).toBeTruthy()
    expect(await findByText(/Europe\/Kyiv.*Курс валют на 25.06.2026/)).toBeTruthy()
    expect(await findByText(/Вікно операцій.*12/)).toBeTruthy()
    expect(await findByText('0%')).toBeTruthy()
    expect(container.querySelector('.mantine-Sparkline-root')).toBeNull()
  })

  it('keeps a valid current score when chart contract fails and does not repair history for display', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('Некоректна відповідь AI Solvency (charts.score_sparkline): historical scores are not recorded'))
    const { findByText, queryByText, container } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText('46')).toBeTruthy()
    expect(await findByText(/charts.score_sparkline/)).toBeTruthy()
    expect(queryByText(explanation)).toBeNull()
    expect(container.querySelector('.mantine-Sparkline-root')).toBeNull()
  })

  it('clears the previous score when a subsequent client response lacks current-state proof', async () => {
    getClientSolvencyScore.mockResolvedValueOnce(v3Score)
    getClientSolvencyCharts.mockResolvedValueOnce(currentCharts)
    const { findByText, queryByText, rerender } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText('46')).toBeTruthy()
    getClientSolvencyScore.mockRejectedValueOnce(new Error('Некоректна відповідь AI Solvency (score.state_basis): must equal current_observation'))
    rerender(<SolvencyPanel clientNetId="other" />)
    expect(await findByText('Оцінка платоспроможності недоступна')).toBeTruthy()
    expect(await findByText(/score.state_basis/)).toBeTruthy()
    expect(queryByText('46')).toBeNull()
    expect(queryByText(explanation)).toBeNull()
    expect(getClientSolvencyCharts).toHaveBeenCalledTimes(1)
  })
})
